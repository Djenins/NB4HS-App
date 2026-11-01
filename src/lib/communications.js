// communications.js -- the Communications module (c1_communications
// migration): the client communications log across every client, messages
// sent to clients through the outbound queue, their templates, and staff
// announcements.
//
// The log rows are the same `communications` table the client profile's
// Communications tab shows; follow-ups are closed through
// set_communication_follow_up_done(). Messages are queued by
// send_client_message(), which checks the client's consent (contact_consents,
// the same append-only rows SNAP records) and writes the log entry itself;
// the send-outbound Edge Function delivers them once a provider is set up.
import { supabase } from "./supabase.js";
import { normalizeContent, newsletterText } from "../../supabase/functions/send-outbound/newsletterLayout.js";

export var LOG_METHODS = ["phone", "email", "sms", "inperson"];
export var LOG_DIRECTIONS = ["outbound", "inbound"];
export var MESSAGE_CHANNELS = ["sms", "email"];
export var MESSAGE_PURPOSES = ["appointment_reminders", "program_updates"];
export var MESSAGE_LANGUAGES = ["en", "ht", "fr"];
export var MESSAGE_STATUSES = ["queued", "sending", "sent", "failed", "cancelled"];
export var SMS_MAX = 480;
export var BODY_MAX = 2000;
export var SUBJECT_MAX = 150;
export var ANNOUNCEMENT_TITLE_MAX = 120;
export var ANNOUNCEMENT_BODY_MAX = 4000;

// Two foreign keys from communications to profiles since c1, so the embed
// names the one it means.
var LOG_SELECT = "*, profiles!communications_created_by_fkey(name)";

export function logEntryFromRow(row) {
  return {
    id: row.id, clientId: row.client_id, date: row.contact_date, createdAt: row.created_at,
    staffName: row.profiles ? row.profiles.name : "", createdBy: row.created_by || null,
    method: row.method || "", direction: row.direction || "", summary: row.summary || "",
    followUpRequired: !!row.follow_up_required, followUpDoneAt: row.follow_up_done_at || null,
    followUpDoneBy: row.follow_up_done_by || null, outboundMessageId: row.outbound_message_id || null
  };
}

function messageFromRow(row) {
  return {
    id: row.id, clientId: row.client_id, channel: row.channel, toAddress: row.to_address,
    subject: row.subject || "", body: row.body || "", status: row.status, attempts: row.attempts || 0,
    lastError: row.last_error || "", sentAt: row.sent_at || null, createdAt: row.created_at,
    queuedBy: row.queued_by || null, queuedByName: row.queued_by_name || ""
  };
}

function templateFromRow(row) {
  return {
    id: row.id, name: row.name, channel: row.channel, purpose: row.purpose, language: row.language,
    subject: row.subject || "", body: row.body, active: !!row.active, updatedAt: row.updated_at
  };
}
function templateToRow(fields) {
  return {
    name: fields.name.trim(), channel: fields.channel, purpose: fields.purpose, language: fields.language,
    subject: fields.channel === "email" ? (fields.subject || "").trim() || null : null,
    body: fields.body.trim(), active: fields.active !== false
  };
}

function announcementFromRow(row) {
  return {
    id: row.id, title: row.title, body: row.body, priority: row.priority, pinned: !!row.pinned,
    expiresOn: row.expires_on || "", createdBy: row.created_by || null,
    authorName: row.author ? row.author.name || "" : "", archivedAt: row.archived_at || null,
    createdAt: row.created_at, updatedAt: row.updated_at
  };
}

// ---------- pure helpers ----------

export function clientName(client) {
  if (!client) return "";
  return ((client.firstName || "") + " " + (client.lastName || "")).trim();
}

export function isOpenFollowUp(entry) {
  return !!entry.followUpRequired && !entry.followUpDoneAt;
}

// YYYY-MM-DD `days` before `today` (also YYYY-MM-DD), in calendar days.
function daysBefore(today, days) {
  var d = new Date(today + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

// The log page's filters. `clientsById` lets the search match the client's
// name and NB ID, which the log rows themselves don't carry.
//   filters: { q, method, direction, staff, followUp: "" | "open" | "done", days: "" | "7" | "30" | "90" }
export function filterLog(entries, filters, clientsById, today) {
  var f = filters || {};
  var q = String(f.q || "").trim().toLowerCase();
  var since = f.days ? daysBefore(today, Number(f.days)) : "";
  return (entries || []).filter(function (e) {
    if (f.method && e.method !== f.method) return false;
    if (f.direction && e.direction !== f.direction) return false;
    if (f.staff && e.staffName !== f.staff) return false;
    if (f.followUp === "open" && !isOpenFollowUp(e)) return false;
    if (f.followUp === "done" && !(e.followUpRequired && e.followUpDoneAt)) return false;
    if (since && (e.date || "") < since) return false;
    if (!q) return true;
    var c = (clientsById || {})[e.clientId];
    return e.summary.toLowerCase().indexOf(q) !== -1 ||
      clientName(c).toLowerCase().indexOf(q) !== -1 ||
      ((c && c.nbId) || "").toLowerCase().indexOf(q) !== -1 ||
      (e.staffName || "").toLowerCase().indexOf(q) !== -1;
  });
}

// Open follow-ups, oldest first: the ones waiting longest come first.
export function openFollowUps(entries) {
  return (entries || []).filter(isOpenFollowUp).sort(function (a, b) {
    return String(a.date || "").localeCompare(String(b.date || "")) || String(a.createdAt).localeCompare(String(b.createdAt));
  });
}

export function logSummaryCounts(entries, today) {
  var weekAgo = daysBefore(today, 7);
  var out = { total: 0, lastWeek: 0, openFollowUps: 0, inbound: 0 };
  (entries || []).forEach(function (e) {
    out.total++;
    if ((e.date || "") >= weekAgo) out.lastWeek++;
    if (isOpenFollowUp(e)) out.openFollowUps++;
    if (e.direction === "inbound") out.inbound++;
  });
  return out;
}

// What send_client_message() will do with {first_name}, for the preview.
export function fillTemplate(text, client) {
  return String(text || "").split("{first_name}").join(((client && client.firstName) || "").trim());
}

// A text's length in SMS segments: 160 characters per part (153 once split),
// or 70 (67) when it needs Unicode -- Kreyòl's ò and French accents do.
export function smsSegments(text) {
  var s = String(text || "");
  if (!s) return 0;
  var unicode = /[^\x00-\x7F]/.test(s);
  var single = unicode ? 70 : 160;
  var multi = unicode ? 67 : 153;
  var len = Array.from(s).length;
  return len <= single ? 1 : Math.ceil(len / multi);
}

// Mirrors normalize_phone() in the migration: can this number take a text?
export function textablePhone(phone) {
  var raw = String(phone || "").trim();
  var d = raw.replace(/\D/g, "");
  if (raw.charAt(0) === "+") return /^[1-9]\d{7,14}$/.test(d) ? "+" + d : null;
  if (/^\d{10}$/.test(d)) return "+1" + d;
  if (/^1\d{10}$/.test(d)) return "+" + d;
  return null;
}

export function validEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || "").trim());
}

// Where a message to this client would go, or null if the record has no
// usable address for that channel.
export function messageAddress(client, channel) {
  if (!client) return null;
  if (channel === "sms") return textablePhone(client.phone);
  return validEmail(client.email) ? String(client.email).trim().toLowerCase() : null;
}

// Why the compose form can't send yet, as an i18n key -- null when it can.
export function composeProblem(fields, client, consentGranted) {
  if (!client) return "commsProblemClient";
  if (!messageAddress(client, fields.channel)) return fields.channel === "sms" ? "commsProblemNoPhone" : "commsProblemNoEmail";
  if (!consentGranted) return "commsProblemConsent";
  if (fields.channel === "email" && !String(fields.subject || "").trim()) return "commsProblemSubject";
  var body = fillTemplate(fields.body, client).trim();
  if (!body) return "commsProblemBody";
  if (body.length > (fields.channel === "sms" ? SMS_MAX : BODY_MAX)) return "commsProblemTooLong";
  return null;
}

// Current announcements: not archived, not past their last day. Pinned
// first, then important, then newest.
export function currentAnnouncements(list, today) {
  return (list || []).filter(function (a) {
    return !a.archivedAt && (!a.expiresOn || a.expiresOn >= today);
  }).sort(function (a, b) {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    if (a.priority !== b.priority) return a.priority === "important" ? -1 : 1;
    return String(b.createdAt).localeCompare(String(a.createdAt));
  });
}

export function unreadCount(list, readIds, today) {
  return currentAnnouncements(list, today).filter(function (a) { return !readIds.has(a.id); }).length;
}

// The database's refusals, as i18n keys the page can show.
export function sendErrorKey(error) {
  var hint = error && error.hint;
  if (hint === "consent_required") return "commsProblemConsent";
  if (hint === "no_address") return "commsProblemNoAddress";
  if (hint === "rate_limited") return "commsRateLimited";
  if (error && error.code === "42501") return "commsNoPermission";
  return "commsSendFailed";
}

// ---------- data: the log ----------

// The newest entries across every client. The table only holds short notes,
// so a generous cap covers the page; older ones stay on each client profile.
export var LOG_LIMIT = 1000;

export async function fetchCommunicationLog() {
  const { data, error } = await supabase.from("communications").select(LOG_SELECT)
    .order("contact_date", { ascending: false }).order("created_at", { ascending: false }).limit(LOG_LIMIT);
  if (error) throw error;
  return data.map(logEntryFromRow);
}

export async function fetchClientCommunications(clientId) {
  const { data, error } = await supabase.from("communications").select(LOG_SELECT).eq("client_id", clientId)
    .order("created_at", { ascending: false });
  if (error) { console.warn("fetchClientCommunications failed", error); return []; }
  return data.map(logEntryFromRow);
}

export async function logCommunication(clientId, fields) {
  const { data, error } = await supabase.from("communications").insert({
    client_id: clientId, contact_date: fields.date || null, method: fields.method || "",
    direction: fields.direction || "", summary: fields.summary || "", follow_up_required: !!fields.followUpRequired
  }).select(LOG_SELECT).single();
  if (error) throw error;
  return logEntryFromRow(data);
}

export async function setFollowUpDone(id, done) {
  const { data, error } = await supabase.rpc("set_communication_follow_up_done", { p_id: id, p_done: done !== false });
  if (error) throw error;
  return data;
}

// ---------- data: client messages ----------

export async function fetchClientMessages(clientId) {
  const { data, error } = await supabase.rpc("client_messages", { p_client_id: clientId || null, p_limit: 300 });
  if (error) throw error;
  return (data || []).map(messageFromRow);
}

export async function fetchMessagingHealth() {
  const { data, error } = await supabase.rpc("client_messaging_health");
  if (error) { console.warn("fetchMessagingHealth failed", error); return []; }
  return (data || []).map(function (r) {
    return { channel: r.channel, queued: r.queued, oldestQueuedAt: r.oldest_queued_at, failed7d: r.failed_7d, sent7d: r.sent_7d };
  });
}

// Resolves to the new log entry; throws the database error (see sendErrorKey).
export async function sendClientMessage(clientId, fields) {
  const { data, error } = await supabase.rpc("send_client_message", {
    p_client_id: clientId, p_channel: fields.channel, p_purpose: fields.purpose, p_language: fields.language,
    p_subject: fields.channel === "email" ? fields.subject || "" : null, p_body: fields.body,
    p_template_id: fields.templateId || null
  });
  if (error) throw error;
  return logEntryFromRow(data);
}

export async function cancelClientMessage(id) {
  const { error } = await supabase.rpc("cancel_client_message", { p_id: id });
  if (error) throw error;
}

// ---------- data: templates ----------

export async function fetchTemplates() {
  const { data, error } = await supabase.from("message_templates").select("*").order("name");
  if (error) throw error;
  return data.map(templateFromRow);
}

export async function saveTemplate(id, fields) {
  const query = id
    ? supabase.from("message_templates").update(templateToRow(fields)).eq("id", id)
    : supabase.from("message_templates").insert(templateToRow(fields));
  const { data, error } = await query.select().single();
  if (error) throw error;
  return templateFromRow(data);
}

// ---------- data: announcements ----------

var ANNOUNCEMENT_SELECT = "*, author:profiles!staff_announcements_created_by_fkey(name)";

export async function fetchAnnouncements() {
  const { data, error } = await supabase.from("staff_announcements").select(ANNOUNCEMENT_SELECT)
    .order("created_at", { ascending: false }).limit(200);
  if (error) throw error;
  return data.map(announcementFromRow);
}

export async function fetchAnnouncementReads() {
  const { data, error } = await supabase.from("staff_announcement_reads").select("announcement_id");
  if (error) { console.warn("fetchAnnouncementReads failed", error); return new Set(); }
  return new Set(data.map(function (r) { return r.announcement_id; }));
}

export async function markAnnouncementRead(id) {
  const { error } = await supabase.from("staff_announcement_reads").upsert({ announcement_id: id }, { onConflict: "announcement_id,user_id", ignoreDuplicates: true });
  if (error) throw error;
}

function announcementToRow(fields) {
  return {
    title: fields.title.trim(), body: fields.body.trim(), priority: fields.priority || "normal",
    pinned: !!fields.pinned, expires_on: fields.expiresOn || null
  };
}

export async function postAnnouncement(fields) {
  const { error } = await supabase.from("staff_announcements").insert(announcementToRow(fields));
  if (error) throw error;
}

export async function updateAnnouncement(id, fields) {
  const { error } = await supabase.from("staff_announcements").update(announcementToRow(fields)).eq("id", id);
  if (error) throw error;
}

export async function setAnnouncementArchived(id, archived) {
  const { error } = await supabase.from("staff_announcements")
    .update({ archived_at: archived ? new Date().toISOString() : null }).eq("id", id);
  if (error) throw error;
}

export function subscribeAnnouncements(onChange) {
  const channel = supabase
    .channel("staff-announcements-" + Math.random().toString(36).slice(2))
    .on("postgres_changes", { event: "*", schema: "public", table: "staff_announcements" }, onChange)
    .subscribe();
  return () => supabase.removeChannel(channel);
}

// ---------- data: newsletters (c2_newsletters) ----------

export var NEWSLETTER_AUDIENCES = ["all", "case_management", "workforce", "students", "food_distribution", "snap"];
export var NEWSLETTER_SUBJECT_MAX = 150;
export var NEWSLETTER_BODY_MAX = 10000;

function newsletterFromRow(row) {
  return {
    id: row.id, subject: row.subject, body: row.body, language: row.language, audience: row.audience,
    status: row.status, recipientCount: row.recipient_count || 0, sentAt: row.sent_at || null,
    authorName: row.author ? row.author.name || "" : "", createdAt: row.created_at, updatedAt: row.updated_at,
    layout: row.layout || "plain", content: row.content || null
  };
}

export async function fetchNewsletters() {
  const { data, error } = await supabase.from("newsletters").select("*, author:profiles!newsletters_created_by_fkey(name)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data.map(newsletterFromRow);
}

// { [newsletterId]: { waiting, sent, failed, cancelled, unsubscribed } }
export async function fetchNewsletterStats() {
  const { data, error } = await supabase.rpc("newsletter_stats");
  if (error) { console.warn("fetchNewsletterStats failed", error); return {}; }
  const out = {};
  (data || []).forEach((r) => { out[r.newsletter_id] = { waiting: r.waiting, sent: r.sent, failed: r.failed, cancelled: r.cancelled, unsubscribed: r.unsubscribed }; });
  return out;
}

// A layout newsletter's body is its plain-text version (newsletterText), which
// is also the email's text part; the layout and its content go alongside.
export async function saveNewsletter(id, fields) {
  const layout = fields.layout || "plain";
  const row = {
    subject: fields.subject.trim(), language: fields.language, audience: fields.audience, layout,
    body: layout === "plain" ? fields.body.trim() : (newsletterText(fields.content, layout) || fields.subject.trim()),
    content: layout === "plain" ? null : normalizeContent(fields.content, layout)
  };
  const query = id ? supabase.from("newsletters").update(row).eq("id", id) : supabase.from("newsletters").insert(row);
  const { data, error } = await query.select("id").single();
  if (error) throw error;
  return data.id;
}

export async function deleteNewsletter(id) {
  const { error } = await supabase.from("newsletters").delete().eq("id", id);
  if (error) throw error;
}

export async function newsletterAudienceCount(audience) {
  const { data, error } = await supabase.rpc("newsletter_audience_count", { p_audience: audience });
  if (error) throw error;
  return data || 0;
}

export async function sendNewsletter(id) {
  const { data, error } = await supabase.rpc("send_newsletter", { p_id: id });
  if (error) throw error;
  return data;
}

export async function cancelNewsletter(id) {
  const { data, error } = await supabase.rpc("cancel_newsletter", { p_id: id });
  if (error) throw error;
  return data || 0;
}

export function newsletterErrorKey(error) {
  var hint = error && error.hint;
  if (hint === "no_mailing_address") return "nlNoAddress";
  if (hint === "no_recipients") return "nlNoRecipients";
  if (hint === "too_many") return "nlTooMany";
  if (hint === "already_sent") return "nlAlreadySent";
  return "userActionError";
}

// Public: the unsubscribe page. Resolves to the newsletter's language, or
// null when the link isn't recognised.
export async function unsubscribeNewsletter(token) {
  const { data, error } = await supabase.rpc("unsubscribe_newsletter", { p_token: token });
  if (error) throw error;
  return data || null;
}

// Pictures for layout newsletters (c3): a public bucket, because an email can
// only show an image at a public address. Never upload client photos or
// documents here. Resolves to the image's public URL.
export var NEWSLETTER_IMAGE_BUCKET = "newsletter-images";
export var NEWSLETTER_IMAGE_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp"];
export var NEWSLETTER_IMAGE_MAX = 2 * 1024 * 1024;

export function newsletterImageProblem(file) {
  if (!file) return "nlImageMissing";
  if (NEWSLETTER_IMAGE_TYPES.indexOf(file.type) === -1) return "nlImageType";
  if (file.size > NEWSLETTER_IMAGE_MAX) return "nlImageSize";
  return null;
}

export async function uploadNewsletterImage(file) {
  const ext = { "image/png": "png", "image/jpeg": "jpg", "image/gif": "gif", "image/webp": "webp" }[file.type];
  const path = (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(36).slice(2)) + "." + ext;
  const { error } = await supabase.storage.from(NEWSLETTER_IMAGE_BUCKET).upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw error;
  return supabase.storage.from(NEWSLETTER_IMAGE_BUCKET).getPublicUrl(path).data.publicUrl;
}
