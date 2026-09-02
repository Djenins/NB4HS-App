// checkinData.js -- Supabase-backed replacement for the slice of `data`
// that used to be `data.visits`/`data.students`/`data.classes` in the
// localStorage blob. Phase 1 of the Supabase migration (see
// plans/wobbly-munching-rose.md): every function here maps snake_case
// Postgres rows to/from the exact camelCase shapes the rest of the app
// (CheckIn*/CheckOut/Dashboard/Search/Students/Assessments/Manage) already
// expects, so those pages keep reading `visit.firstName`/`student.classKey`/
// etc. unchanged -- only their *write* call sites change, from
// `setData(prev => ...)` patches to calling the functions below.
import { supabase } from "./supabase.js";
import { masterToRow } from "./clientsData.js";

// ---------- mapping: DB row (snake_case) <-> app shape (camelCase) ----------

function classFromRow(row) {
  return { key: row.key, name: row.name, days: row.days || [], service: row.service, staff: row.staff, active: row.active, custom: row.custom };
}
function classToRow(fields) {
  const row = {};
  if (fields.key !== undefined) row.key = fields.key;
  if (fields.name !== undefined) row.name = fields.name;
  if (fields.days !== undefined) row.days = fields.days;
  if (fields.service !== undefined) row.service = fields.service;
  if (fields.staff !== undefined) row.staff = fields.staff;
  if (fields.active !== undefined) row.active = fields.active;
  if (fields.custom !== undefined) row.custom = fields.custom;
  return row;
}

function studentFromRow(row) {
  return {
    id: row.id, clientId: row.client_id, nbId: row.clients ? row.clients.nb_id : undefined,
    studentId: row.student_display_id, firstName: row.first_name, lastName: row.last_name,
    phone: row.phone || "", email: row.email || "", street: row.street || "", city: row.city || "",
    zip: row.zip || "", state: row.state || "RI", classKey: row.class_key, active: row.active,
    pretestReading: row.pretest_reading || "", posttestReading: row.posttest_reading || "",
    droppedOut: row.dropped_out, dropoutDate: row.dropout_date, outcome: row.outcome,
    waitlistedForClassKey: row.waitlisted_for_class_key || null, waitlistedAt: row.waitlisted_at || null
  };
}
function studentToRow(fields) {
  const row = {};
  if (fields.clientId !== undefined) row.client_id = fields.clientId;
  if (fields.studentId !== undefined) row.student_display_id = fields.studentId;
  if (fields.firstName !== undefined) row.first_name = fields.firstName;
  if (fields.lastName !== undefined) row.last_name = fields.lastName;
  if (fields.phone !== undefined) row.phone = fields.phone;
  if (fields.email !== undefined) row.email = fields.email;
  if (fields.street !== undefined) row.street = fields.street;
  if (fields.city !== undefined) row.city = fields.city;
  if (fields.zip !== undefined) row.zip = fields.zip;
  if (fields.state !== undefined) row.state = fields.state;
  if (fields.classKey !== undefined) row.class_key = fields.classKey;
  if (fields.active !== undefined) row.active = fields.active;
  if (fields.pretestReading !== undefined) row.pretest_reading = fields.pretestReading;
  if (fields.posttestReading !== undefined) row.posttest_reading = fields.posttestReading;
  if (fields.droppedOut !== undefined) row.dropped_out = fields.droppedOut;
  if (fields.dropoutDate !== undefined) row.dropout_date = fields.dropoutDate;
  if (fields.outcome !== undefined) row.outcome = fields.outcome;
  if (fields.waitlistedForClassKey !== undefined) row.waitlisted_for_class_key = fields.waitlistedForClassKey;
  if (fields.waitlistedAt !== undefined) row.waitlisted_at = fields.waitlistedAt;
  return row;
}

function visitFromRow(row) {
  return {
    id: row.id, firstName: row.first_name || "", lastName: row.last_name || "", phone: row.phone || "",
    email: row.email || "", address: row.street || "", city: row.city || "", state: row.state || "RI",
    zip: row.zip || "", service: row.service || "", serviceOther: row.service_other || "",
    staff: row.staff || "", staffOther: row.staff_other || "", notes: row.notes || "",
    date: row.visit_date, timeIn: row.time_in, timeOut: row.time_out,
    studentId: row.student_id, className: row.class_name || ""
  };
}
// Partial mapper for updateVisit() below -- unlike visitToRow() (which
// always builds a full insert payload for createVisit()), this only
// forwards fields the caller actually passed, same undefined-check idiom as
// studentToRow()/classToRow(). Deliberately excludes date/timeIn/timeOut/
// studentId/className: those are check-in/check-out mechanics, not part of
// Search.jsx's edit-visit form.
function visitPatchToRow(patch) {
  const row = {};
  if (patch.firstName !== undefined) row.first_name = patch.firstName;
  if (patch.lastName !== undefined) row.last_name = patch.lastName;
  if (patch.phone !== undefined) row.phone = patch.phone || null;
  if (patch.email !== undefined) row.email = patch.email || null;
  if (patch.address !== undefined) row.street = patch.address || null;
  if (patch.city !== undefined) row.city = patch.city || null;
  if (patch.state !== undefined) row.state = patch.state || null;
  if (patch.zip !== undefined) row.zip = patch.zip || null;
  if (patch.service !== undefined) row.service = patch.service || null;
  if (patch.serviceOther !== undefined) row.service_other = patch.serviceOther || null;
  if (patch.staff !== undefined) row.staff = patch.staff || null;
  if (patch.staffOther !== undefined) row.staff_other = patch.staffOther || null;
  if (patch.notes !== undefined) row.notes = patch.notes || null;
  return row;
}
function visitToRow(record) {
  // Deliberately never forwards `record.id` -- CheckIn*.jsx build that id
  // client-side via uid() (a short non-UUID string, fine for the rest of
  // the still-local `data` blob) purely as a placeholder; `visits.id` is a
  // real Postgres uuid, so callers must use the id on the row *returned*
  // from createVisit(), not the one they passed in.
  return {
    first_name: record.firstName, last_name: record.lastName, phone: record.phone || null,
    email: record.email || null, street: record.address || null, city: record.city || null,
    state: record.state || "RI", zip: record.zip || null, service: record.service || null,
    service_other: record.serviceOther || null, staff: record.staff || null, staff_other: record.staffOther || null,
    notes: record.notes || null, visit_date: record.date, time_in: record.timeIn,
    student_id: record.studentId || null, class_name: record.className || null
  };
}

// ---------- classes ----------

export async function fetchClasses() {
  const { data, error } = await supabase.from("classes").select("*").order("key");
  if (error) { console.warn("fetchClasses failed", error); return []; }
  return data.map(classFromRow);
}
export async function createClass(fields) {
  const { data, error } = await supabase.from("classes").insert(classToRow(fields)).select().single();
  if (error) throw error;
  return classFromRow(data);
}
export async function updateClass(key, patch) {
  const { data, error } = await supabase.from("classes").update(classToRow(patch)).eq("key", key).select().single();
  if (error) throw error;
  return classFromRow(data);
}
export async function deleteClass(key) {
  const { error } = await supabase.from("classes").delete().eq("key", key);
  if (error) throw error;
}

// ---------- students ----------

export async function fetchStudents() {
  const { data, error } = await supabase.from("students").select("*, clients(nb_id)").order("last_name");
  if (error) { console.warn("fetchStudents failed", error); return []; }
  return data.map(studentFromRow);
}
// Deliberately never forwards `fields.id` (see the same note on visitToRow
// above) -- `students.id` is a real Postgres uuid, generated server-side;
// callers must use the id on the row *returned* here.
export async function createStudent(fields) {
  const { data, error } = await supabase.from("students").insert(studentToRow(fields)).select("*, clients(nb_id)").single();
  if (error) throw error;
  return studentFromRow(data);
}
// Same "match an existing master client, or create a new one" shape as
// createCaseClient()/createJobClient()/createFoodClient() (clientsData.js) --
// used by Students.jsx's enroll form when the duplicate-match dialog fires.
// Unlike plain createStudent() above (which expects fields.clientId to
// already be resolved, e.g. ClientProfile.jsx's "add to program" flow), this
// one does the clients-row lookup/insert itself via the create_student()
// RPC, since student enrollment previously had no server-side path for that
// at all -- it only ever patched local React state, which the Supabase
// migration silently turned into a no-op.
export async function createStudentWithClient(masterFields, programFields, matchedClientId) {
  const { data, error } = await supabase.rpc("create_student", {
    master_fields: masterToRow(masterFields), program_fields: studentToRow(programFields), matched_client_id: matchedClientId || null
  });
  if (error) throw error;
  return { clientId: data.client_id, row: studentFromRow(data.row) };
}
export async function updateStudent(id, patch) {
  const { data, error } = await supabase.from("students").update(studentToRow(patch)).eq("id", id).select("*, clients(nb_id)").single();
  if (error) throw error;
  return studentFromRow(data);
}
export async function deleteStudent(id) {
  const { error } = await supabase.from("students").delete().eq("id", id);
  if (error) throw error;
}
// ---------- visits ----------

export async function fetchVisits() {
  const { data, error } = await supabase.from("visits").select("*").order("time_in", { ascending: false });
  if (error) { console.warn("fetchVisits failed", error); return []; }
  return data.map(visitFromRow);
}
export async function createVisit(record) {
  const { data, error } = await supabase.from("visits").insert(visitToRow(record)).select().single();
  if (error) throw error;
  return visitFromRow(data);
}
// Search.jsx's edit-visit action -- staff-only (see the visits_update RLS
// policy: `authenticated` only, unlike visits_insert/visits_select which are
// `public` for the anonymous kiosk session).
export async function updateVisit(id, patch) {
  const { data, error } = await supabase.from("visits").update(visitPatchToRow(patch)).eq("id", id).select().single();
  if (error) throw error;
  return visitFromRow(data);
}
// Goes through the check_out_visit() RPC (SECURITY DEFINER, only ever sets
// time_out on an open visit) rather than a raw UPDATE -- see the RLS
// policies in the migration for why: it's the one write an anonymous kiosk
// client is allowed to make to an existing row.
export async function checkOutVisit(id) {
  const { data, error } = await supabase.rpc("check_out_visit", { visit_id: id });
  if (error) throw error;
  return data ? visitFromRow(data) : null;
}

// ---------- realtime ----------

// Subscribes to INSERT/UPDATE/DELETE on `table` and calls `onChange` with
// the full changed row (already `select()`ed server-side isn't available on
// the payload, so callers refetch or patch their local list from
// payload.new/payload.old -- see AppContext.jsx for the patch logic).
// Returns an unsubscribe function.
export function subscribeTable(table, onChange) {
  const channel = supabase
    .channel(table + "-changes")
    .on("postgres_changes", { event: "*", schema: "public", table }, onChange)
    .subscribe();
  return () => supabase.removeChannel(channel);
}
