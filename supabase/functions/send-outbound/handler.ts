// send-outbound -- sends the email queued in outbound_messages
// (p6b_outbound_email; plans/staff-reporting-architecture.md §6, "R3").
//
// pg_cron calls this every 5 minutes through invoke_send_outbound(), with
// the shared CRON_SECRET as a bearer token. Each run claims up to 20 queued
// messages (claim_outbound_messages, FOR UPDATE SKIP LOCKED, so two runs
// never send the same one), sends each through the provider and reports the
// result (complete_outbound_message): "sent" only when the provider answers
// 2xx -- accepted, not delivered -- otherwise the database retries with
// backoff and gives up after 5 attempts.
//
// Without a provider key nothing is claimed, so messages stay queued
// ("email pending" in the app) until RESEND_API_KEY is set.
//
// Emails name the person, the period and link to the app. They never carry
// report content, reviewer comments or participant details -- the queue
// payload doesn't hold any, and the templates below only read the fields
// they need.

// deno-lint-ignore no-explicit-any
type Any = any;

export interface Message {
  id: string;
  to_address: string;
  template: string;
  payload: Record<string, unknown>;
}

export interface Deps {
  // The service-role client (claim_outbound_messages / complete_outbound_message).
  admin: Any;
  // POSTs one email to the provider; resolves to the provider's answer.
  send(email: { to: string; subject: string; html: string; text: string }): Promise<{ ok: boolean; id?: string; error?: string }>;
  cronSecret?: string;
  appUrl: string;
  providerConfigured: boolean;
}

const DEFAULT_APP = "https://nb4hs-app.vercel.app";

export function escapeHtml(value: unknown) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

// Only in-app paths, so a payload can never send someone off-site.
export function appLink(appUrl: string, path: unknown) {
  const p = typeof path === "string" && /^\/[A-Za-z0-9/_-]*$/.test(path) ? path : "/";
  return (appUrl || DEFAULT_APP).replace(/\/+$/, "") + p;
}

function layout(heading: string, lines: string[], button: string, href: string) {
  const html = `<!doctype html><html><body style="margin:0;padding:24px;background:#f4f6fa;font-family:Arial,Helvetica,sans-serif;color:#0b1f3a">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;padding:28px">
<tr><td><p style="margin:0 0 4px;font-size:13px;color:#5b6b82">New Beginnings for Haitian Seniors</p>
<h1 style="margin:0 0 16px;font-size:20px">${escapeHtml(heading)}</h1>
${lines.map((l) => `<p style="margin:0 0 10px;font-size:15px;line-height:1.5">${l}</p>`).join("\n")}
<p style="margin:22px 0 8px"><a href="${escapeHtml(href)}" style="display:inline-block;background:#1d4ed8;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:bold">${escapeHtml(button)}</a></p>
<p style="margin:16px 0 0;font-size:12px;color:#5b6b82">You need to sign in to the NB4HS app to see the report. This email does not contain its content.</p>
</td></tr></table></td></tr></table></body></html>`;
  return html;
}

// One template per queued kind. Text versions mirror the HTML.
export function renderEmail(template: string, payload: Record<string, unknown>, appUrl: string) {
  const href = appLink(appUrl, payload.link);
  const period = String(payload.period ?? "");
  if (template === "staff_report_submitted") {
    const name = String(payload.staff_name ?? "A staff member");
    const when = String(payload.submitted_at ?? "");
    return {
      subject: `New NB4HS Biweekly Report — ${name}`,
      html: layout("New biweekly report", [
        `<strong>${escapeHtml(name)}</strong> submitted their biweekly report for <strong>${escapeHtml(period)}</strong>.`,
        when ? `Submitted ${escapeHtml(when)}.` : ""
      ].filter(Boolean), "Review report", href),
      text: `${name} submitted their biweekly report for ${period}.${when ? `\nSubmitted ${when}.` : ""}\n\nReview report: ${href}\n\nSign in to the NB4HS app to see the report. This email does not contain its content.`
    };
  }
  if (template === "staff_report_revision_requested") {
    return {
      subject: "Your NB4HS biweekly report needs a revision",
      html: layout("Revision requested", [`Your biweekly report for <strong>${escapeHtml(period)}</strong> was sent back for a revision. The reviewer's note is in the app.`], "Open your report", href),
      text: `Your biweekly report for ${period} was sent back for a revision. The reviewer's note is in the app.\n\nOpen your report: ${href}`
    };
  }
  if (template === "staff_report_acknowledged") {
    return {
      subject: "Your NB4HS biweekly report was acknowledged",
      html: layout("Report acknowledged", [`Your biweekly report for <strong>${escapeHtml(period)}</strong> was acknowledged.`], "Open your report", href),
      text: `Your biweekly report for ${period} was acknowledged.\n\nOpen your report: ${href}`
    };
  }
  return null;
}

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

export function createHandler(deps: Deps) {
  return async function handle(req: Request): Promise<Response> {
    if (req.method !== "POST") return json(405, { error: "method_not_allowed" });
    const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    if (!deps.cronSecret || token !== deps.cronSecret) return json(401, { error: "unauthorized" });
    if (!deps.providerConfigured) return json(200, { skipped: "no_provider", sent: 0 });

    const { data, error } = await deps.admin.rpc("claim_outbound_messages", { p_limit: 20 });
    if (error) return json(500, { error: "claim_failed", detail: error.message });
    const messages: Message[] = data || [];

    let sent = 0;
    let failed = 0;
    for (const m of messages) {
      const email = renderEmail(m.template, m.payload || {}, deps.appUrl);
      let result: { ok: boolean; id?: string; error?: string };
      if (!email) {
        result = { ok: false, error: "unknown template " + m.template };
      } else {
        try {
          result = await deps.send({ to: m.to_address, subject: email.subject, html: email.html, text: email.text });
        } catch (e) {
          result = { ok: false, error: e instanceof Error ? e.message : String(e) };
        }
      }
      await deps.admin.rpc("complete_outbound_message", {
        p_id: m.id, p_ok: result.ok, p_provider_id: result.id || null, p_error: result.ok ? null : result.error || "send failed"
      });
      if (result.ok) sent++; else failed++;
    }
    return json(200, { claimed: messages.length, sent, failed });
  };
}

// The Resend API (https://resend.com/docs/api-reference/emails/send-email).
export function resendSender(apiKey: string, from: string, fetchImpl: typeof fetch = fetch) {
  return async function send(email: { to: string; subject: string; html: string; text: string }) {
    const res = await fetchImpl("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [email.to], subject: email.subject, html: email.html, text: email.text })
    });
    let body: Any = null;
    try { body = await res.json(); } catch (_) { body = null; }
    if (res.ok) return { ok: true, id: body && body.id ? String(body.id) : undefined };
    return { ok: false, error: `provider ${res.status}${body && body.message ? ": " + body.message : ""}` };
  };
}
