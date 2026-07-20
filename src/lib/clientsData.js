// clientsData.js -- Supabase-backed replacement for the Case Management/
// Job Developer/Food Distribution/unified-client slice of the old
// localStorage `data` blob. Phase 2 of the Supabase migration (see
// plans/wobbly-munching-rose.md) -- same "map DB row <-> app shape" idiom
// as checkinData.js from Phase 1, so the pages that only *read* this data
// keep working with minimal changes; only the *write* call sites change.
import { supabase } from "./supabase.js";

// ---------- storage (documents/resumes) ----------

const DOCS_BUCKET = "client-documents";

export async function uploadClientFile(clientId, file) {
  const path = clientId + "/" + Date.now() + "-" + file.name;
  const { error } = await supabase.storage.from(DOCS_BUCKET).upload(path, file);
  if (error) throw error;
  return path;
}
export async function getFileSignedUrl(path) {
  if (!path) return null;
  const { data, error } = await supabase.storage.from(DOCS_BUCKET).createSignedUrl(path, 60 * 60);
  if (error) { console.warn("getFileSignedUrl failed", error); return null; }
  return data.signedUrl;
}
export async function deleteClientFile(path) {
  if (!path) return;
  await supabase.storage.from(DOCS_BUCKET).remove([path]);
}

// ---------- mapping: DB row (snake_case) <-> app shape (camelCase) ----------

function masterFromRow(row) {
  return {
    id: row.id, nbId: row.nb_id, firstName: row.first_name || "", lastName: row.last_name || "",
    phone: row.phone || "", email: row.email || "", dob: row.dob || "", street: row.street || "",
    city: row.city || "", zip: row.zip || "", state: row.state || "RI", intakeDate: row.intake_date || "",
    status: row.status, createdAt: row.created_at, updatedAt: row.updated_at,
    raceEthnicity: row.race_ethnicity || "", gender: row.gender || "",
    householdIncomeBracket: row.household_income_bracket || "", householdSize: row.household_size || "",
    intakeForm: row.intake_form || null, intakeFormSavedAt: row.intake_form_saved_at || null
  };
}
export function masterToRow(fields) {
  const row = {};
  if (fields.firstName !== undefined) row.first_name = fields.firstName;
  if (fields.lastName !== undefined) row.last_name = fields.lastName;
  if (fields.phone !== undefined) row.phone = fields.phone;
  if (fields.email !== undefined) row.email = fields.email;
  if (fields.dob !== undefined) row.dob = fields.dob || null;
  if (fields.street !== undefined) row.street = fields.street;
  if (fields.city !== undefined) row.city = fields.city;
  if (fields.zip !== undefined) row.zip = fields.zip;
  if (fields.intakeDate !== undefined) row.intake_date = fields.intakeDate || null;
  if (fields.status !== undefined) row.status = fields.status;
  if (fields.raceEthnicity !== undefined) row.race_ethnicity = fields.raceEthnicity;
  if (fields.gender !== undefined) row.gender = fields.gender;
  if (fields.householdIncomeBracket !== undefined) row.household_income_bracket = fields.householdIncomeBracket;
  if (fields.householdSize !== undefined) row.household_size = fields.householdSize ? Number(fields.householdSize) || null : null;
  if (fields.intakeForm !== undefined) row.intake_form = fields.intakeForm;
  if (fields.intakeFormSavedAt !== undefined) row.intake_form_saved_at = fields.intakeFormSavedAt;
  return row;
}

function caseClientFromRow(row) {
  return {
    id: row.id, nbId: row.clients ? row.clients.nb_id : undefined,
    firstName: row.first_name || "", lastName: row.last_name || "", phone: row.phone || "", email: row.email || "",
    street: row.street || "", city: row.city || "", zip: row.zip || "", state: row.state || "RI",
    intakeDate: row.intake_date || "", immigrationStatus: row.immigration_status || "", dob: row.dob || "",
    services: row.services || [], active: row.active
  };
}
function caseClientToRow(fields) {
  const row = {};
  if (fields.firstName !== undefined) row.first_name = fields.firstName;
  if (fields.lastName !== undefined) row.last_name = fields.lastName;
  if (fields.phone !== undefined) row.phone = fields.phone;
  if (fields.email !== undefined) row.email = fields.email;
  if (fields.street !== undefined) row.street = fields.street;
  if (fields.city !== undefined) row.city = fields.city;
  if (fields.zip !== undefined) row.zip = fields.zip;
  if (fields.intakeDate !== undefined) row.intake_date = fields.intakeDate || null;
  if (fields.immigrationStatus !== undefined) row.immigration_status = fields.immigrationStatus;
  if (fields.dob !== undefined) row.dob = fields.dob || null;
  if (fields.services !== undefined) row.services = fields.services;
  if (fields.active !== undefined) row.active = fields.active;
  return row;
}

function caseClientNoteFromRow(row) {
  return { id: row.id, text: row.content, date: row.note_date };
}

function jobClientFromRow(row) {
  return {
    id: row.id, nbId: row.clients ? row.clients.nb_id : undefined,
    firstName: row.first_name || "", lastName: row.last_name || "", phone: row.phone || "", email: row.email || "",
    street: row.street || "", city: row.city || "", zip: row.zip || "", state: row.state || "RI",
    intakeDate: row.intake_date || "",
    workPermit: row.work_permit, workPermitExpiration: row.work_permit_expiration || "",
    hasResume: row.has_resume, resumeStoragePath: row.resume_storage_path || "", resumeFileName: row.resume_file_name || "",
    employmentStatus: row.employment_status || "not_started", pipelineStage: row.pipeline_stage || "resume",
    workAuthorization: row.work_authorization || "", workAuthorizationExpiration: row.work_authorization_expiration || "",
    transportation: row.transportation || "", preferredLanguage: row.preferred_language || "", secondaryLanguage: row.secondary_language || "",
    barriers: row.barriers || [], servicesProvided: row.services_provided || [], skills: row.skills || [], active: row.active
  };
}
function jobClientToRow(fields) {
  const row = {};
  if (fields.firstName !== undefined) row.first_name = fields.firstName;
  if (fields.lastName !== undefined) row.last_name = fields.lastName;
  if (fields.phone !== undefined) row.phone = fields.phone;
  if (fields.email !== undefined) row.email = fields.email;
  if (fields.street !== undefined) row.street = fields.street;
  if (fields.city !== undefined) row.city = fields.city;
  if (fields.zip !== undefined) row.zip = fields.zip;
  if (fields.intakeDate !== undefined) row.intake_date = fields.intakeDate || null;
  if (fields.workPermit !== undefined) row.work_permit = fields.workPermit;
  if (fields.workPermitExpiration !== undefined) row.work_permit_expiration = fields.workPermitExpiration || null;
  if (fields.hasResume !== undefined) row.has_resume = fields.hasResume;
  if (fields.resumeStoragePath !== undefined) row.resume_storage_path = fields.resumeStoragePath;
  if (fields.resumeFileName !== undefined) row.resume_file_name = fields.resumeFileName;
  if (fields.employmentStatus !== undefined) row.employment_status = fields.employmentStatus;
  if (fields.pipelineStage !== undefined) row.pipeline_stage = fields.pipelineStage;
  if (fields.workAuthorization !== undefined) row.work_authorization = fields.workAuthorization;
  if (fields.workAuthorizationExpiration !== undefined) row.work_authorization_expiration = fields.workAuthorizationExpiration || null;
  if (fields.transportation !== undefined) row.transportation = fields.transportation;
  if (fields.preferredLanguage !== undefined) row.preferred_language = fields.preferredLanguage;
  if (fields.secondaryLanguage !== undefined) row.secondary_language = fields.secondaryLanguage;
  if (fields.barriers !== undefined) row.barriers = fields.barriers;
  if (fields.servicesProvided !== undefined) row.services_provided = fields.servicesProvided;
  if (fields.skills !== undefined) row.skills = fields.skills;
  if (fields.active !== undefined) row.active = fields.active;
  return row;
}

function applicationFromRow(row) {
  return {
    id: row.id, company: row.company || "", position: row.position || "", appliedDate: row.applied_date || "",
    status: row.status || "applied", nextStepDate: row.next_step_date || "", nextStepNote: row.next_step_note || "",
    interviewDate: row.interview_date || "", interviewNotes: row.interview_notes || ""
  };
}
function applicationToRow(fields) {
  return {
    company: fields.company, position: fields.position, applied_date: fields.appliedDate || null,
    status: fields.status || "applied", next_step_date: fields.nextStepDate || null, next_step_note: fields.nextStepNote || "",
    interview_date: fields.interviewDate || null, interview_notes: fields.interviewNotes || ""
  };
}

function foodClientFromRow(row) {
  return {
    id: row.id, nbId: row.clients ? row.clients.nb_id : undefined,
    firstName: row.first_name || "", lastName: row.last_name || "", phone: row.phone || "", email: row.email || "",
    street: row.street || "", city: row.city || "", zip: row.zip || "", state: row.state || "RI",
    intakeDate: row.intake_date || "", householdSize: row.household_size || "", active: row.active
  };
}
function foodClientToRow(fields) {
  const row = {};
  if (fields.firstName !== undefined) row.first_name = fields.firstName;
  if (fields.lastName !== undefined) row.last_name = fields.lastName;
  if (fields.phone !== undefined) row.phone = fields.phone;
  if (fields.email !== undefined) row.email = fields.email;
  if (fields.street !== undefined) row.street = fields.street;
  if (fields.city !== undefined) row.city = fields.city;
  if (fields.zip !== undefined) row.zip = fields.zip;
  if (fields.intakeDate !== undefined) row.intake_date = fields.intakeDate || null;
  if (fields.householdSize !== undefined) row.household_size = fields.householdSize;
  if (fields.active !== undefined) row.active = fields.active;
  return row;
}

function distributionFromRow(row) {
  return { id: row.id, date: row.visit_date, items: row.items || "", quantity: row.quantity || "" };
}

function appointmentFromRow(row) {
  return {
    id: row.id, clientId: row.client_id, firstName: row.first_name || "", lastName: row.last_name || "",
    phone: row.phone || "", email: row.email || "", date: row.appt_date || "", time: row.appt_time || "",
    reason: row.reason || "", assignedEmail: row.assigned_email || "", meetingWith: row.meeting_with,
    status: row.status, source: row.source, createdAt: row.created_at
  };
}
function appointmentToRow(fields) {
  return {
    client_id: fields.clientId || null, first_name: fields.firstName, last_name: fields.lastName,
    phone: fields.phone, email: fields.email, appt_date: fields.date || null, appt_time: fields.time || null,
    reason: fields.reason || "", assigned_email: fields.assignedEmail || "", meeting_with: fields.meetingWith,
    status: fields.status || (fields.source === "client" ? "requested" : "scheduled"), source: fields.source || "staff"
  };
}

function noteFromRow(row) {
  return {
    id: row.id, clientId: row.client_id, date: row.note_date, time: row.created_at,
    staffName: row.profiles ? row.profiles.name : "", department: row.department || "general",
    type: row.type || "general", visibility: row.visibility || "all", content: row.content
  };
}
function documentFromRow(row) {
  return {
    id: row.id, clientId: row.client_id, fileName: row.file_name, category: row.category || "other",
    storagePath: row.storage_path, uploadedAt: row.created_at,
    uploadedBy: row.profiles ? row.profiles.name : "", program: row.program
  };
}
function communicationFromRow(row) {
  return {
    id: row.id, clientId: row.client_id, date: row.contact_date,
    staffName: row.profiles ? row.profiles.name : "", method: row.method || "", direction: row.direction || "",
    summary: row.summary || "", followUpRequired: row.follow_up_required
  };
}

function customOptionFromRow(row) {
  return { key: row.key, en: row.en, ht: row.ht, fr: row.fr, custom: true };
}

// ---------- clients (master) ----------

export async function fetchClients() {
  const { data, error } = await supabase.from("clients").select("*").order("last_name");
  if (error) { console.warn("fetchClients failed", error); return []; }
  return data.map(masterFromRow);
}
export async function updateClientRecord(id, patch) {
  const { data, error } = await supabase.from("clients").update(Object.assign({}, masterToRow(patch), { updated_at: new Date().toISOString() })).eq("id", id).select().single();
  if (error) throw error;
  return masterFromRow(data);
}

// ---------- case clients + notes (privacy-restricted) ----------

export async function fetchCaseClients() {
  const { data, error } = await supabase.from("case_clients").select("*, clients(nb_id)").order("last_name");
  if (error) { console.warn("fetchCaseClients failed", error); return []; }
  return data.map(caseClientFromRow);
}
export async function createCaseClient(masterFields, programFields, matchedClientId) {
  const { data, error } = await supabase.rpc("create_case_client", {
    master_fields: masterToRow(masterFields), program_fields: caseClientToRow(programFields), matched_client_id: matchedClientId || null
  });
  if (error) throw error;
  return { clientId: data.client_id, row: caseClientFromRow(data.row) };
}
export async function updateCaseClient(id, patch) {
  const { data, error } = await supabase.from("case_clients").update(caseClientToRow(patch)).eq("id", id).select("*, clients(nb_id)").single();
  if (error) throw error;
  return caseClientFromRow(data);
}
export async function deleteCaseClient(id) {
  const { error } = await supabase.from("case_clients").delete().eq("id", id);
  if (error) throw error;
}
export async function fetchCaseClientNotes(caseClientId) {
  const { data, error } = await supabase.from("case_client_notes").select("*").eq("case_client_id", caseClientId).order("note_date", { ascending: false });
  if (error) { console.warn("fetchCaseClientNotes failed", error); return []; }
  return data.map(caseClientNoteFromRow);
}
export async function createCaseClientNote(caseClientId, text) {
  const { data: auth } = await supabase.auth.getUser();
  const { data, error } = await supabase.from("case_client_notes").insert({
    case_client_id: caseClientId, content: text, created_by: auth.user ? auth.user.id : null
  }).select().single();
  if (error) throw error;
  return caseClientNoteFromRow(data);
}

// ---------- job clients + applications ----------

export async function fetchJobClients() {
  const { data, error } = await supabase.from("job_clients").select("*, clients(nb_id)").order("last_name");
  if (error) { console.warn("fetchJobClients failed", error); return []; }
  return data.map(jobClientFromRow);
}
export async function createJobClient(masterFields, programFields, matchedClientId) {
  const { data, error } = await supabase.rpc("create_job_client", {
    master_fields: masterToRow(masterFields), program_fields: jobClientToRow(programFields), matched_client_id: matchedClientId || null
  });
  if (error) throw error;
  return { clientId: data.client_id, row: jobClientFromRow(data.row) };
}
export async function updateJobClient(id, patch) {
  const { data, error } = await supabase.from("job_clients").update(jobClientToRow(patch)).eq("id", id).select("*, clients(nb_id)").single();
  if (error) throw error;
  return jobClientFromRow(data);
}
export async function deleteJobClient(id) {
  const { error } = await supabase.from("job_clients").delete().eq("id", id);
  if (error) throw error;
}
export async function fetchApplications(jobClientId) {
  const { data, error } = await supabase.from("job_applications").select("*").eq("job_client_id", jobClientId).order("created_at", { ascending: false });
  if (error) { console.warn("fetchApplications failed", error); return []; }
  return data.map(applicationFromRow);
}
export async function createApplication(jobClientId, fields) {
  const row = Object.assign({ job_client_id: jobClientId }, applicationToRow(fields));
  const { data, error } = await supabase.from("job_applications").insert(row).select().single();
  if (error) throw error;
  return applicationFromRow(data);
}
export async function deleteApplication(id) {
  const { error } = await supabase.from("job_applications").delete().eq("id", id);
  if (error) throw error;
}
// Aggregate stat for the Job Developer KPI row -- applications live in their
// own table now (not embedded on job_clients), so this is a small dedicated
// count query rather than pulling every application into global state.
export async function countApplicationsWithInterview() {
  const { count, error } = await supabase.from("job_applications").select("id", { count: "exact", head: true }).not("interview_date", "is", null);
  if (error) { console.warn("countApplicationsWithInterview failed", error); return 0; }
  return count || 0;
}

// ---------- food clients + distributions ----------

export async function fetchFoodClients() {
  const { data, error } = await supabase.from("food_clients").select("*, clients(nb_id)").order("last_name");
  if (error) { console.warn("fetchFoodClients failed", error); return []; }
  return data.map(foodClientFromRow);
}
export async function createFoodClient(masterFields, programFields, matchedClientId) {
  const { data, error } = await supabase.rpc("create_food_client", {
    master_fields: masterToRow(masterFields), program_fields: foodClientToRow(programFields), matched_client_id: matchedClientId || null
  });
  if (error) throw error;
  return { clientId: data.client_id, row: foodClientFromRow(data.row) };
}
export async function deleteFoodClient(id) {
  const { error } = await supabase.from("food_clients").delete().eq("id", id);
  if (error) throw error;
}
export async function fetchDistributions(foodClientId) {
  const { data, error } = await supabase.from("food_distributions").select("*").eq("food_client_id", foodClientId).order("visit_date", { ascending: false });
  if (error) { console.warn("fetchDistributions failed", error); return []; }
  return data.map(distributionFromRow);
}
export async function createDistribution(foodClientId, entry) {
  const { data, error } = await supabase.from("food_distributions").insert({
    food_client_id: foodClientId, visit_date: entry.date || null, items: entry.items, quantity: entry.quantity
  }).select().single();
  if (error) throw error;
  return distributionFromRow(data);
}
// Every household's distribution log, flat, each row tagged with its
// household id -- lets FoodDistribution.jsx reconstruct the old
// `foodClients[].distributions[]` shape (via a simple filter/group) so the
// existing lastDistributionDate()/allDistributions()/export helpers in
// lib/clients.js keep working unchanged instead of being rewritten to
// query Supabase directly.
export async function fetchAllDistributions() {
  const { data, error } = await supabase.from("food_distributions").select("*");
  if (error) { console.warn("fetchAllDistributions failed", error); return []; }
  return data.map((row) => ({ id: row.id, foodClientId: row.food_client_id, date: row.visit_date, items: row.items || "", quantity: row.quantity || "" }));
}

// ---------- appointments ----------

export async function fetchAppointments() {
  const { data, error } = await supabase.from("appointments").select("*").order("created_at", { ascending: false });
  if (error) { console.warn("fetchAppointments failed", error); return []; }
  return data.map(appointmentFromRow);
}
// No .select() chained here -- the anon kiosk appointment-request flow
// inserts as an unauthenticated client, and the `appointments_select` RLS
// policy is authenticated-only, so a chained .select().single() would fail
// to read the just-inserted row back and Postgrest reports that as an RLS
// violation on the whole request even though the insert itself succeeded.
// Neither caller (ApptRequest.jsx, AppointmentsSection.jsx) uses the
// returned row, so skipping the read-back avoids the false failure.
export async function createAppointment(fields) {
  const { error } = await supabase.from("appointments").insert(appointmentToRow(fields));
  if (error) throw error;
}
export async function updateAppointmentStatus(id, status) {
  const { data, error } = await supabase.from("appointments").update({ status }).eq("id", id).select().single();
  if (error) throw error;
  return appointmentFromRow(data);
}
// Reschedule (new date/time) and/or reassign (new assignedEmail) an existing
// appointment -- re-setting assigned_email re-fires the DB trigger that
// notifies whoever it's newly assigned to (see notify_appointment_assignment
// in the notifications migration).
export async function updateAppointment(id, patch) {
  const row = {};
  if (patch.date !== undefined) row.appt_date = patch.date || null;
  if (patch.time !== undefined) row.appt_time = patch.time || null;
  if (patch.assignedEmail !== undefined) row.assigned_email = patch.assignedEmail || "";
  if (patch.status !== undefined) row.status = patch.status;
  const { data, error } = await supabase.from("appointments").update(row).eq("id", id).select().single();
  if (error) throw error;
  return appointmentFromRow(data);
}
export async function deleteAppointment(id) {
  const { error } = await supabase.from("appointments").delete().eq("id", id);
  if (error) throw error;
}

// Public-safe staff picker for the kiosk/client-facing appointment request
// form (no login) -- reads the `staff_directory` view (name/email/role only,
// active case managers + job developers), not the full `profiles` table.
export async function fetchStaffDirectory() {
  const { data, error } = await supabase.from("staff_directory").select("*").order("name");
  if (error) { console.warn("fetchStaffDirectory failed", error); return []; }
  return data;
}

// ---------- unified notes / documents / communications ----------

// department scopes a client's notes to the program that wrote them --
// "case" (Case Manager) and "job" (Job Developer) are kept as two separate
// note streams even though both live in the same client_notes table, since
// a client can be enrolled in both programs at once.
export async function fetchClientNotes(clientId, department) {
  let query = supabase.from("client_notes").select("*, profiles(name)").eq("client_id", clientId);
  if (department) query = query.eq("department", department);
  const { data, error } = await query.order("created_at", { ascending: false });
  if (error) { console.warn("fetchClientNotes failed", error); return []; }
  return data.map(noteFromRow);
}
export async function createClientNote(clientId, fields) {
  const { data: auth } = await supabase.auth.getUser();
  const { data, error } = await supabase.from("client_notes").insert({
    client_id: clientId, content: (fields.content || "").trim(), department: fields.department || "general",
    type: fields.type || "general", visibility: fields.visibility || "all",
    created_by: auth.user ? auth.user.id : null
  }).select("*, profiles(name)").single();
  if (error) throw error;
  return noteFromRow(data);
}

export async function fetchClientDocuments(clientId) {
  const { data, error } = await supabase.from("client_documents").select("*, profiles(name)").eq("client_id", clientId).order("created_at", { ascending: false });
  if (error) { console.warn("fetchClientDocuments failed", error); return []; }
  return data.map(documentFromRow);
}
export async function createClientDocument(clientId, fields) {
  const { data: auth } = await supabase.auth.getUser();
  const { data, error } = await supabase.from("client_documents").insert({
    client_id: clientId, file_name: fields.fileName, category: fields.category || "other",
    storage_path: fields.storagePath, program: fields.program || null,
    uploaded_by: auth.user ? auth.user.id : null
  }).select("*, profiles(name)").single();
  if (error) throw error;
  return documentFromRow(data);
}

export async function fetchCommunications(clientId) {
  const { data, error } = await supabase.from("communications").select("*, profiles(name)").eq("client_id", clientId).order("created_at", { ascending: false });
  if (error) { console.warn("fetchCommunications failed", error); return []; }
  return data.map(communicationFromRow);
}
export async function createCommunication(clientId, fields) {
  const { data: auth } = await supabase.auth.getUser();
  const { data, error } = await supabase.from("communications").insert({
    client_id: clientId, contact_date: fields.date || null, method: fields.method || "",
    direction: fields.direction || "", summary: fields.summary || "",
    follow_up_required: !!fields.followUpRequired, created_by: auth.user ? auth.user.id : null
  }).select("*, profiles(name)").single();
  if (error) throw error;
  return communicationFromRow(data);
}

// ---------- custom / disabled options (Manage Lists) ----------

export async function fetchCustomOptions(optionType) {
  const { data, error } = await supabase.from("custom_options").select("*").eq("option_type", optionType).order("en");
  if (error) { console.warn("fetchCustomOptions failed", error); return []; }
  return data.map(customOptionFromRow);
}
export async function createCustomOption(optionType, fields) {
  const { data, error } = await supabase.from("custom_options").insert({
    option_type: optionType, key: fields.key, en: fields.en, ht: fields.ht, fr: fields.fr
  }).select().single();
  if (error) throw error;
  return customOptionFromRow(data);
}
export async function deleteCustomOption(optionType, key) {
  const { error } = await supabase.from("custom_options").delete().eq("option_type", optionType).eq("key", key);
  if (error) throw error;
}

export async function fetchDisabledOptionKeys(optionType) {
  const { data, error } = await supabase.from("disabled_options").select("key").eq("option_type", optionType);
  if (error) { console.warn("fetchDisabledOptionKeys failed", error); return []; }
  return data.map((r) => r.key);
}
export async function setOptionDisabled(optionType, key, disabled) {
  if (disabled) {
    const { error } = await supabase.from("disabled_options").insert({ option_type: optionType, key });
    if (error) throw error;
  } else {
    const { error } = await supabase.from("disabled_options").delete().eq("option_type", optionType).eq("key", key);
    if (error) throw error;
  }
}

// ---------- realtime ----------

export function subscribeClientsTable(table, onChange) {
  const channel = supabase
    .channel(table + "-clients-changes")
    .on("postgres_changes", { event: "*", schema: "public", table }, onChange)
    .subscribe();
  return () => supabase.removeChannel(channel);
}
