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
// Staff report emails name the person, the period and link to the app. They
// never carry report content, reviewer comments or participant details --
// the queue payload doesn't hold any, and the templates below only read the
// fields they need.
//
// Client messages (c1_communications) are the one exception by design: a
// staff member wrote the text for that client, the database queued it only
// after checking the client's consent, and it goes out as written -- by
// email (Resend) or by text (Twilio). Each channel is claimed only when its
// provider is configured, so texts wait in the queue until Twilio is set up.

import { LAYOUTS, NEWSLETTER_FOOTER, newsletterText, renderNewsletterHtml } from "./newsletterLayout.js";

// deno-lint-ignore no-explicit-any
type Any = any;

export interface Message {
  id: string;
  channel?: string;
  to_address: string;
  template: string;
  payload: Record<string, unknown>;
}

export interface Email {
  to: string;
  subject: string;
  html: string;
  text: string;
  headers?: Record<string, string>;
}

export interface Deps {
  // The service-role client (claim_outbound_messages / complete_outbound_message).
  admin: Any;
  // POSTs one email to the provider; resolves to the provider's answer.
  send(email: Email): Promise<{ ok: boolean; id?: string; error?: string }>;
  // POSTs one text message; only called when smsConfigured.
  sendSms?(sms: { to: string; body: string }): Promise<{ ok: boolean; id?: string; error?: string }>;
  cronSecret?: string;
  appUrl: string;
  // The email provider (Resend) is configured.
  providerConfigured: boolean;
  smsConfigured?: boolean;
}

export type Lang = "en" | "ht" | "fr";

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
<tr><td><p style="margin:0 0 4px;font-size:13px;color:#5b6b82">New Bridges for Haitian Success</p>
<h1 style="margin:0 0 16px;font-size:20px">${escapeHtml(heading)}</h1>
${lines.map((l) => `<p style="margin:0 0 10px;font-size:15px;line-height:1.5">${l}</p>`).join("\n")}
<p style="margin:22px 0 8px"><a href="${escapeHtml(href)}" style="display:inline-block;background:#1d4ed8;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:bold">${escapeHtml(button)}</a></p>
<p style="margin:16px 0 0;font-size:12px;color:#5b6b82">You need to sign in to the NB4HS app to see the report. This email does not contain its content.</p>
</td></tr></table></td></tr></table></body></html>`;
  return html;
}

// Client-facing footer, in the language the message was written in.
// The Kreyòl and French wording needs a native speaker's check.
const CLIENT_FOOTER: Record<Lang, string> = {
  en: "This message was sent to you by New Bridges for Haitian Success. If you no longer want these messages, reply to this email or call us.",
  ht: "Se New Bridges for Haitian Success ki voye mesaj sa a ba ou. Si ou pa vle resevwa mesaj sa yo ankò, reponn imèl sa a oswa rele nou.",
  fr: "Ce message vous a été envoyé par New Bridges for Haitian Success. Si vous ne souhaitez plus recevoir ces messages, répondez à cet e-mail ou appelez-nous."
};

export function clientLang(value: unknown): Lang {
  return value === "ht" || value === "fr" ? value : "en";
}

// Staff typed plain text: escape it and keep their paragraphs and line breaks.
export function textToHtml(text: string) {
  return text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean)
    .map((p) => `<p style="margin:0 0 12px;font-size:15px;line-height:1.55">${escapeHtml(p).replace(/\n/g, "<br>")}</p>`)
    .join("\n");
}

export function renderClientEmail(payload: Record<string, unknown>) {
  const lang = clientLang(payload.language);
  const subject = String(payload.subject ?? "").trim() || "New Bridges for Haitian Success";
  const body = String(payload.body ?? "").trim();
  if (!body) return null;
  const footer = CLIENT_FOOTER[lang];
  const html = `<!doctype html><html lang="${lang}"><body style="margin:0;padding:24px;background:#f4f6fa;font-family:Arial,Helvetica,sans-serif;color:#0b1f3a">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;padding:28px">
<tr><td><p style="margin:0 0 16px;font-size:13px;color:#5b6b82">New Bridges for Haitian Success</p>
${textToHtml(body)}
<p style="margin:20px 0 0;font-size:12px;color:#5b6b82">${escapeHtml(footer)}</p>
</td></tr></table></td></tr></table></body></html>`;
  return { subject, html, text: `${body}\n\n—\n${footer}` };
}

// Newsletters (c2_newsletters): the same client layout, plus what US law
// (CAN-SPAM) asks of bulk email -- the organization's mailing address and a
// working unsubscribe link -- and a List-Unsubscribe header so mail apps
// show their own unsubscribe button. The link opens a page that asks before
// unsubscribing, so a mail scanner following it changes nothing. The
// footer's wording (NEWSLETTER_FOOTER) lives in newsletterLayout.js.

// The page opens in the newsletter's language (`l`).
export function unsubscribeLink(appUrl: string, token: unknown, lang?: unknown) {
  const tk = typeof token === "string" && /^[0-9a-f]{64}$/.test(token) ? token : "";
  return (appUrl || DEFAULT_APP).replace(/\/+$/, "") + "/unsubscribe?t=" + tk + "&l=" + clientLang(lang);
}

export function renderNewsletter(payload: Record<string, unknown>, appUrl: string) {
  const lang = clientLang(payload.language);
  const subject = String(payload.subject ?? "").trim();
  const body = String(payload.body ?? "").trim();
  const address = String(payload.mailing_address ?? "").trim();
  if (!subject || !body || !address || typeof payload.unsubscribe_token !== "string") return null;
  const href = unsubscribeLink(appUrl, payload.unsubscribe_token, lang);
  const f = (NEWSLETTER_FOOTER as Record<Lang, { why: string; stop: string }>)[lang];
  const headers = { "List-Unsubscribe": `<${href}>` };
  // A newsletter built from a layout (c3); "plain" ones keep the text email below.
  const layout = typeof payload.layout === "string" ? payload.layout : "plain";
  if (layout !== "plain" && Object.prototype.hasOwnProperty.call(LAYOUTS, layout)) {
    return {
      subject, headers,
      html: renderNewsletterHtml({
        layout, content: payload.content, language: lang, subject,
        footer: { brand: "New Bridges for Haitian Success", why: f.why, address, stopLabel: f.stop, href }
      }),
      text: `${subject}\n\n${newsletterText(payload.content, layout) || body}\n\n—\n${f.why}\n${address}\n${f.stop}: ${href}`
    };
  }
  const html = `<!doctype html><html lang="${lang}"><body style="margin:0;padding:24px;background:#f4f6fa;font-family:Arial,Helvetica,sans-serif;color:#0b1f3a">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;padding:28px">
<tr><td><p style="margin:0 0 16px;font-size:13px;color:#5b6b82">New Bridges for Haitian Success</p>
<h1 style="margin:0 0 16px;font-size:20px">${escapeHtml(subject)}</h1>
${textToHtml(body)}
<p style="margin:24px 0 4px;font-size:12px;color:#5b6b82">${escapeHtml(f.why)}</p>
<p style="margin:0 0 4px;font-size:12px;color:#5b6b82">${escapeHtml(address)}</p>
<p style="margin:0;font-size:12px"><a href="${escapeHtml(href)}" style="color:#1d4ed8">${escapeHtml(f.stop)}</a></p>
</td></tr></table></td></tr></table></body></html>`;
  return {
    subject, html,
    text: `${subject}\n\n${body}\n\n—\n${f.why}\n${address}\n${f.stop}: ${href}`,
    headers
  };
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
  async function deliver(m: Message): Promise<{ ok: boolean; id?: string; error?: string }> {
    if ((m.channel || "email") === "sms") {
      const body = m.template === "client_message" ? String((m.payload || {}).body ?? "").trim() : "";
      if (!body) return { ok: false, error: "unknown template " + m.template };
      return await deps.sendSms!({ to: m.to_address, body });
    }
    if (m.template === "newsletter") {
      const nl = renderNewsletter(m.payload || {}, deps.appUrl);
      if (!nl) return { ok: false, error: "incomplete newsletter payload" };
      return await deps.send({ to: m.to_address, subject: nl.subject, html: nl.html, text: nl.text, headers: nl.headers });
    }
    const email = m.template === "client_message" ? renderClientEmail(m.payload || {}) : renderEmail(m.template, m.payload || {}, deps.appUrl);
    if (!email) return { ok: false, error: "unknown template " + m.template };
    return await deps.send({ to: m.to_address, subject: email.subject, html: email.html, text: email.text });
  }

  return async function handle(req: Request): Promise<Response> {
    if (req.method !== "POST") return json(405, { error: "method_not_allowed" });
    const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    if (!deps.cronSecret || token !== deps.cronSecret) return json(401, { error: "unauthorized" });
    const channels = [deps.providerConfigured && "email", deps.smsConfigured && deps.sendSms && "sms"].filter(Boolean);
    if (!channels.length) return json(200, { skipped: "no_provider", sent: 0 });

    const { data, error } = await deps.admin.rpc("claim_outbound_messages", { p_limit: 20, p_channels: channels });
    if (error) return json(500, { error: "claim_failed", detail: error.message });
    const messages: Message[] = data || [];

    let sent = 0;
    let failed = 0;
    for (const m of messages) {
      let result: { ok: boolean; id?: string; error?: string };
      try {
        result = await deliver(m);
      } catch (e) {
        result = { ok: false, error: e instanceof Error ? e.message : String(e) };
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
  return async function send(email: Email) {
    const res = await fetchImpl("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(Object.assign(
        { from, to: [email.to], subject: email.subject, html: email.html, text: email.text },
        email.headers ? { headers: email.headers } : {}
      ))
    });
    let body: Any = null;
    try { body = await res.json(); } catch (_) { body = null; }
    if (res.ok) return { ok: true, id: body && body.id ? String(body.id) : undefined };
    return { ok: false, error: `provider ${res.status}${body && body.message ? ": " + body.message : ""}` };
  };
}

// The Twilio Messages API (https://www.twilio.com/docs/messaging/api/message-resource#create-a-message-resource).
// `from` is a Twilio number or a Messaging Service SID (MG...). Twilio
// handles STOP/START replies itself for US numbers.
export function twilioSender(accountSid: string, authToken: string, from: string, fetchImpl: typeof fetch = fetch) {
  return async function sendSms(sms: { to: string; body: string }) {
    const form = new URLSearchParams({ To: sms.to, Body: sms.body });
    form.set(from.startsWith("MG") ? "MessagingServiceSid" : "From", from);
    const res = await fetchImpl(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(accountSid)}/Messages.json`, {
      method: "POST",
      headers: { Authorization: "Basic " + btoa(accountSid + ":" + authToken), "Content-Type": "application/x-www-form-urlencoded" },
      body: form.toString()
    });
    let body: Any = null;
    try { body = await res.json(); } catch (_) { body = null; }
    if (res.ok) return { ok: true, id: body && body.sid ? String(body.sid) : undefined };
    return { ok: false, error: `provider ${res.status}${body && body.message ? ": " + body.message : ""}` };
  };
}
