// outreachContacts.js -- SNAP outreach contacts, their communication consent
// and the activity log (stage2a_outreach_contacts migration). Same
// row <-> app-shape idiom as clientsData.js. Every contact is a `clients`
// record (NB ID) with a SNAP layer on top; createOutreachContact() links an
// existing client or creates a minimal one, never both, never a merge.
//
// RLS is the control: any SNAP member reads every contact; workers edit only
// contacts assigned to them; consent and the activity log are append-only.
// The pure helpers here (filtering, current consent, who-can-edit) only
// decide what the UI offers.
import { supabase } from "./supabase.js";

export var CONTACT_LANGUAGES = ["en", "ht", "fr", "es", "pt"];
export var CONTACT_METHODS = ["phone", "sms", "email", "in_person", "mail"];
export var OUTREACH_SOURCES = ["walk_in", "phone", "event", "referral", "partner", "door_to_door", "social_media", "other"];
export var FOLLOW_UP_STATUSES = ["none", "needed", "scheduled", "done"];
export var INTERACTION_TYPES = ["call", "text", "email", "in_person", "event", "door_to_door", "tabling", "other"];
export var INTERACTION_DIRECTIONS = ["outbound", "inbound"];
export var INTERACTION_OUTCOMES = ["reached", "no_answer", "left_message", "info_provided", "follow_up_needed", "not_interested"];
export var CONSENT_CHANNELS = ["phone", "sms", "email", "mail"];
export var CONSENT_PURPOSES = ["program_updates", "appointment_reminders"];
export var CONSENT_METHODS = ["verbal", "written", "electronic"];
export var SUMMARY_MAX = 1000;

// ---------- mapping ----------

function contactFromRow(row) {
  var c = row.clients || {};
  return {
    id: row.id, program: row.program, clientId: row.client_id, nbId: c.nb_id || "",
    firstName: c.first_name || "", lastName: c.last_name || "", phone: c.phone || "", email: c.email || "",
    preferredLanguage: row.preferred_language || "", preferredContactMethod: row.preferred_contact_method || "",
    outreachSource: row.outreach_source || "", assignedTo: row.assigned_to || null, status: row.status,
    followUpStatus: row.follow_up_status, createdBy: row.created_by || null, createdAt: row.created_at
  };
}
function contactPatchToRow(patch) {
  var row = {};
  if (patch.preferredLanguage !== undefined) row.preferred_language = patch.preferredLanguage || null;
  if (patch.preferredContactMethod !== undefined) row.preferred_contact_method = patch.preferredContactMethod || null;
  if (patch.outreachSource !== undefined) row.outreach_source = patch.outreachSource || null;
  if (patch.assignedTo !== undefined) row.assigned_to = patch.assignedTo || null;
  if (patch.status !== undefined) row.status = patch.status;
  if (patch.followUpStatus !== undefined) row.follow_up_status = patch.followUpStatus;
  return row;
}
function consentFromRow(row) {
  return { id: row.id, clientId: row.client_id, channel: row.channel, purpose: row.purpose, status: row.status,
    method: row.method, capturedBy: row.captured_by || null, capturedAt: row.captured_at };
}
function interactionFromRow(row) {
  return { id: row.id, clientId: row.client_id, staffId: row.staff_id, type: row.type, direction: row.direction || "",
    outcome: row.outcome || "", summary: row.summary || "", occurredAt: row.occurred_at };
}

// ---------- pure helpers ----------

// Search box + "assigned to me" + status. Matches name, NB ID, phone digits
// or email, the same fields staff use to find a client elsewhere.
export function filterContacts(contacts, opts) {
  var q = String((opts && opts.q) || "").trim().toLowerCase();
  var digits = q.replace(/\D/g, "");
  return (contacts || []).filter(function (c) {
    if (opts && opts.mineOnly && c.assignedTo !== opts.userId) return false;
    if (opts && opts.status && c.status !== opts.status) return false;
    if (!q) return true;
    var name = (c.firstName + " " + c.lastName).toLowerCase();
    return name.indexOf(q) !== -1 || (c.nbId || "").toLowerCase().indexOf(q) !== -1 ||
      (c.email || "").toLowerCase().indexOf(q) !== -1 ||
      (digits.length >= 3 && (c.phone || "").replace(/\D/g, "").indexOf(digits) !== -1);
  });
}

// Existing NB4HS clients matching a free-text search -- the "find the person
// first" step before anyone creates a new record.
export function searchClients(clients, q, limit) {
  var term = String(q || "").trim().toLowerCase();
  if (term.length < 2) return [];
  var digits = term.replace(/\D/g, "");
  return (clients || []).filter(function (c) {
    var name = ((c.firstName || "") + " " + (c.lastName || "")).toLowerCase();
    return name.indexOf(term) !== -1 || (c.nbId || "").toLowerCase().indexOf(term) !== -1 ||
      (c.email || "").toLowerCase().indexOf(term) !== -1 ||
      (digits.length >= 3 && (c.phone || "").replace(/\D/g, "").indexOf(digits) !== -1);
  }).slice(0, limit || 8);
}

// The newest consent row per channel/purpose wins; anything never asked is
// absent. Returns { "sms:appointment_reminders": consentRow, ... }.
export function currentConsents(rows) {
  var out = {};
  (rows || []).slice().sort(function (a, b) { return String(a.capturedAt).localeCompare(String(b.capturedAt)); })
    .forEach(function (r) { out[r.channel + ":" + r.purpose] = r; });
  return out;
}

// True only when the person's latest answer for that channel and purpose is
// "granted" -- the rule any future message sender must check.
export function hasConsent(rows, channel, purpose) {
  var latest = currentConsents(rows)[channel + ":" + purpose];
  return !!latest && latest.status === "granted";
}

// Mirrors outreach_contacts_update: supervisors/program admins edit any
// contact, workers only those assigned to them; only the former reassign.
export function contactPermissions(contact, programRole, userId) {
  var lead = programRole === "supervisor" || programRole === "program_admin";
  return {
    canEdit: lead || (programRole === "worker" && !!contact && contact.assignedTo === userId),
    canReassign: lead
  };
}

// ---------- data ----------

export async function fetchOutreachContacts(program) {
  const { data, error } = await supabase.from("outreach_contacts")
    .select("*, clients(nb_id, first_name, last_name, phone, email)")
    .eq("program", program).order("created_at", { ascending: false });
  if (error) throw error;
  return data.map(contactFromRow);
}

// Links `matchedClientId` if given, otherwise creates a minimal clients
// record from masterFields ({ firstName, lastName, phone, email }).
export async function createOutreachContact(program, masterFields, contactFields, matchedClientId) {
  const { data, error } = await supabase.rpc("create_outreach_contact", {
    master_fields: {
      first_name: masterFields.firstName || "", last_name: masterFields.lastName || "",
      phone: masterFields.phone || "", email: masterFields.email || ""
    },
    contact_fields: {
      program, preferred_language: contactFields.preferredLanguage || "",
      preferred_contact_method: contactFields.preferredContactMethod || "",
      outreach_source: contactFields.outreachSource || ""
    },
    matched_client_id: matchedClientId || null
  });
  if (error) throw error;
  return { clientId: data.client_id, id: data.row.id };
}

export async function updateOutreachContact(id, patch) {
  const { data, error } = await supabase.from("outreach_contacts").update(contactPatchToRow(patch)).eq("id", id)
    .select("*, clients(nb_id, first_name, last_name, phone, email)").maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("not permitted");
  return contactFromRow(data);
}

export async function fetchConsents(clientId) {
  const { data, error } = await supabase.from("contact_consents").select("*").eq("client_id", clientId)
    .order("captured_at", { ascending: false });
  if (error) throw error;
  return data.map(consentFromRow);
}

export async function recordConsent(clientId, fields) {
  const { error } = await supabase.from("contact_consents").insert({
    client_id: clientId, channel: fields.channel, purpose: fields.purpose, status: fields.status, method: fields.method
  });
  if (error) throw error;
}

export async function fetchInteractions(clientId) {
  const { data, error } = await supabase.from("outreach_interactions").select("*").eq("client_id", clientId)
    .order("occurred_at", { ascending: false });
  if (error) throw error;
  return data.map(interactionFromRow);
}

export async function logInteraction(program, clientId, fields) {
  const { error } = await supabase.from("outreach_interactions").insert({
    program, client_id: clientId, type: fields.type, direction: fields.direction || null,
    outcome: fields.outcome || null, summary: (fields.summary || "").trim().slice(0, SUMMARY_MAX) || null
  });
  if (error) throw error;
}
