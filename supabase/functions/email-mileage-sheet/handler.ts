// email-mileage-sheet -- emails one month's mileage sheet (the PDF My
// Mileage builds in the browser, pages/Mileage.jsx) to staff the sender
// picks: themselves, a supervisor, whoever handles reimbursement.
//
// Rules, checked here before anything is sent:
//   * the caller is signed in and may read that person's mileage
//     (mileage_can_view(), called with the caller's own token -- the same
//     rule as the trips' RLS);
//   * every recipient is an active staff account with an email address --
//     never a typed address, so a sheet (which can list client addresses)
//     stays inside NB4HS;
//   * at most 5 recipients, a short optional note, and a real PDF under 4 MB.
//
// It sends right away through Resend with the PDF attached, replying to the
// sender. Until RESEND_API_KEY and EMAIL_FROM are set (the same secrets
// send-outbound uses), it answers 503 "email_not_configured" and the app
// says so. Nothing is stored: the PDF passes through and is gone.

export const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

export const MAX_RECIPIENTS = 5;
export const MAX_NOTE = 500;
export const MAX_PDF_BYTES = 4 * 1024 * 1024;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;

// deno-lint-ignore no-explicit-any
type Any = any;

export interface Attachment { filename: string; content: string }
export interface Email {
  to: string[];
  replyTo?: string;
  subject: string;
  html: string;
  text: string;
  attachments: Attachment[];
}

export interface Deps {
  // A client acting as whoever sent the request.
  callerFor(authHeader: string): Any;
  // The service-role client (recipient and sender profiles).
  admin: Any;
  send(email: Email): Promise<{ ok: boolean; id?: string; error?: string }>;
  providerConfigured: boolean;
}

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

export function escapeHtml(value: unknown) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
export function monthName(month: string) {
  return MONTHS[Number(month.slice(5, 7)) - 1] + " " + month.slice(0, 4);
}

// Decoded size of a base64 string, without decoding it.
export function base64Bytes(b64: string) {
  const pad = b64.endsWith("==") ? 2 : b64.endsWith("=") ? 1 : 0;
  return Math.floor((b64.length * 3) / 4) - pad;
}

// "%PDF-" in base64 starts "JVBERi0".
export function looksLikePdf(b64: string) {
  return b64.startsWith("JVBERi0");
}

// A safe attachment name: letters, digits, dashes, underscores, dots; .pdf.
export function safeFileName(name: unknown, month: string) {
  const base = String(name ?? "").replace(/\.pdf$/i, "").replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
  return (base || "mileage-" + month) + ".pdf";
}

export function renderEmail(o: { senderName: string; staffName: string; month: string; note: string }) {
  const own = o.senderName === o.staffName;
  const period = monthName(o.month);
  const subject = `Mileage sheet — ${o.staffName}, ${period}`;
  const lead = own
    ? `${o.senderName} sent you their mileage sheet for ${period}.`
    : `${o.senderName} sent you ${o.staffName}'s mileage sheet for ${period}.`;
  const noteHtml = o.note
    ? `<p style="margin:0 0 12px;font-size:15px;line-height:1.55;padding:12px 14px;background:#f4f6fa;border-radius:8px">${escapeHtml(o.note).replace(/\n/g, "<br>")}</p>`
    : "";
  const html = `<!doctype html><html><body style="margin:0;padding:24px;background:#f4f6fa;font-family:Arial,Helvetica,sans-serif;color:#0b1f3a">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;padding:28px">
<tr><td>
<h1 style="margin:0 0 16px;font-size:20px">Mileage sheet</h1>
<p style="margin:0 0 12px;font-size:15px;line-height:1.5">${escapeHtml(lead)}</p>
${noteHtml}
<p style="margin:0 0 12px;font-size:15px;line-height:1.5">The PDF is attached. Reply to this email to answer ${escapeHtml(own ? o.senderName : "the sender")}.</p>
<p style="margin:16px 0 0;font-size:12px;color:#5b6b82">The sheet can include addresses of the places staff visited. Keep it within NB4HS.</p>
</td></tr></table></td></tr></table></body></html>`;
  const text = `${lead}\n\n${o.note ? o.note + "\n\n" : ""}The PDF is attached.\n\nThe sheet can include addresses of the places staff visited. Keep it within NB4HS.`;
  return { subject, html, text };
}

export function createHandler(deps: Deps) {
  return async function handle(req: Request): Promise<Response> {
    if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
    if (req.method !== "POST") return json(405, { error: "method_not_allowed" });

    const authHeader = req.headers.get("Authorization") || "";
    if (!/^Bearer .+/.test(authHeader)) return json(401, { error: "not_signed_in" });
    const caller = deps.callerFor(authHeader);
    const { data: who, error: whoError } = await caller.auth.getUser(authHeader.slice(7));
    if (whoError || !who || !who.user) return json(401, { error: "not_signed_in" });
    const me = who.user.id as string;

    let body: Any;
    try { body = await req.json(); } catch (_) { return json(400, { error: "bad_request" }); }
    const staffId = String(body && body.staffId || "");
    const month = String(body && body.month || "");
    const note = String(body && body.note || "").trim();
    const pdf = String(body && body.pdf || "");
    const recipients: string[] = Array.isArray(body && body.recipients)
      ? Array.from(new Set((body.recipients as unknown[]).map((r) => String(r))))
      : [];

    if (!UUID.test(staffId) || !MONTH.test(month)) return json(400, { error: "bad_request" });
    if (!recipients.length || recipients.length > MAX_RECIPIENTS || !recipients.every((r) => UUID.test(r))) {
      return json(400, { error: "bad_recipients" });
    }
    if (note.length > MAX_NOTE) return json(400, { error: "note_too_long" });
    if (!pdf || !BASE64.test(pdf) || !looksLikePdf(pdf)) return json(400, { error: "bad_pdf" });
    if (base64Bytes(pdf) > MAX_PDF_BYTES) return json(413, { error: "pdf_too_large" });

    const { data: canView, error: viewError } = await caller.rpc("mileage_can_view", { p_staff: staffId });
    if (viewError) return json(500, { error: "check_failed" });
    if (!canView) return json(403, { error: "forbidden" });

    const ids = Array.from(new Set(recipients.concat([me, staffId])));
    const { data: rows, error: profError } = await deps.admin.from("profiles").select("id, name, email, active").in("id", ids);
    if (profError) return json(500, { error: "lookup_failed" });
    const byId: Record<string, Any> = {};
    (rows || []).forEach((p: Any) => { byId[p.id] = p; });
    const to = recipients.map((id) => byId[id]);
    if (to.some((p) => !p || p.active === false || !p.email)) return json(400, { error: "bad_recipients" });

    if (!deps.providerConfigured) return json(503, { error: "email_not_configured" });

    const sender = byId[me] || {};
    const staff = byId[staffId] || {};
    const senderName = String(sender.name || sender.email || "A staff member");
    const staffName = String(staff.name || staff.email || "A staff member");
    const email = renderEmail({ senderName, staffName, month, note });
    const result = await deps.send({
      to: to.map((p) => String(p.email)),
      replyTo: sender.email ? String(sender.email) : undefined,
      subject: email.subject,
      html: email.html,
      text: email.text,
      attachments: [{ filename: safeFileName(body.fileName, month), content: pdf }]
    });
    if (!result.ok) return json(502, { error: "send_failed", detail: result.error });
    return json(200, { sent: to.length, id: result.id || null });
  };
}

// The Resend API (https://resend.com/docs/api-reference/emails/send-email).
export function resendSender(apiKey: string, from: string, fetchImpl: typeof fetch = fetch) {
  return async function send(email: Email) {
    const res = await fetchImpl("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(Object.assign(
        { from, to: email.to, subject: email.subject, html: email.html, text: email.text, attachments: email.attachments },
        email.replyTo ? { reply_to: email.replyTo } : {}
      ))
    });
    let body: Any = null;
    try { body = await res.json(); } catch (_) { body = null; }
    if (res.ok) return { ok: true, id: body && body.id ? String(body.id) : undefined };
    return { ok: false, error: `provider ${res.status}${body && body.message ? ": " + body.message : ""}` };
  };
}
