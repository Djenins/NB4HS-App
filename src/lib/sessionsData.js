// sessionsData.js -- Supabase-backed replacement for the slice of `data`
// that used to be `data.currentSession`/`data.sessionHistory`/
// `data.pastSessionStudents` in the localStorage blob (Phase 3 of the
// Supabase migration). Same row<->shape mapping idiom as checkinData.js/
// clientsData.js. "Current session" and "history" are both just rows in
// `sessions` -- the only difference is the `is_current` flag, which
// `start_new_session()` flips atomically server-side (see the migration).
import { supabase } from "./supabase.js";

// ---------- mapping: DB row (snake_case) <-> app shape (camelCase) ----------

function sessionFromRow(row) {
  return { id: row.id, startDate: row.start_date, endDate: row.end_date, isCurrent: row.is_current };
}

function pastSessionStudentFromRow(row) {
  return {
    id: row.id, sessionId: row.session_id, firstName: row.first_name || "", lastName: row.last_name || "",
    phone: row.phone || "", email: row.email || "", street: row.street || "", city: row.city || "",
    zip: row.zip || "", state: row.state || "RI", classKey: row.class_key, className: row.class_name || ""
  };
}
function pastSessionStudentToRow(fields) {
  return {
    session_id: fields.sessionId, first_name: fields.firstName, last_name: fields.lastName,
    phone: fields.phone || null, email: fields.email || null, street: fields.street || null,
    city: fields.city || null, zip: fields.zip || null, state: fields.state || "RI",
    class_key: fields.classKey || null, class_name: fields.className || null
  };
}

// ---------- sessions ----------

export async function fetchCurrentSession() {
  const { data, error } = await supabase.from("sessions").select("*").eq("is_current", true).maybeSingle();
  if (error) { console.warn("fetchCurrentSession failed", error); return null; }
  return data ? sessionFromRow(data) : null;
}
export async function fetchSessionHistory() {
  const { data, error } = await supabase.from("sessions").select("*").eq("is_current", false).order("start_date", { ascending: false });
  if (error) { console.warn("fetchSessionHistory failed", error); return []; }
  return data.map(sessionFromRow);
}
// Manual "add past session" action (backfilling history, not the active
// session) -- a plain insert, always non-current.
export async function createPastSession(fields) {
  const { data, error } = await supabase.from("sessions").insert({
    start_date: fields.startDate, end_date: fields.endDate, is_current: false
  }).select().single();
  if (error) throw error;
  return sessionFromRow(data);
}
export async function deleteSession(id) {
  const { error } = await supabase.from("sessions").delete().eq("id", id);
  if (error) throw error;
}
// Atomically archives the current session (flips is_current off), inserts
// the new one, and clears every active student's classKey -- see the
// start_new_session() RPC in the migration for why this needs to be one
// round-trip instead of three separate client-side writes.
export async function startNewSession(startDate, endDate) {
  const { data, error } = await supabase.rpc("start_new_session", { new_start: startDate, new_end: endDate });
  if (error) throw error;
  return sessionFromRow(data);
}

// ---------- past session students ----------

export async function fetchPastSessionStudents() {
  const { data, error } = await supabase.from("past_session_students").select("*");
  if (error) { console.warn("fetchPastSessionStudents failed", error); return []; }
  return data.map(pastSessionStudentFromRow);
}
// Bulk insert for the past-session-roster CSV/Excel importer -- mirrors
// createStudents()'s bulk pattern in checkinData.js.
export async function createPastSessionStudents(rowsList) {
  if (!rowsList.length) return [];
  const { data, error } = await supabase.from("past_session_students").insert(rowsList.map(pastSessionStudentToRow)).select();
  if (error) throw error;
  return data.map(pastSessionStudentFromRow);
}
