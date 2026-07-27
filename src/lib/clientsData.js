// clientsData.js -- Supabase-backed replacement for the Case Management/
// Job Developer/Food Distribution/unified-client slice of the old
// localStorage `data` blob. Phase 2 of the Supabase migration (see
// plans/wobbly-munching-rose.md) -- same "map DB row <-> app shape" idiom
// as checkinData.js from Phase 1, so the pages that only *read* this data
// keep working with minimal changes; only the *write* call sites change.
import { supabase } from "./supabase.js";
import { CHECKIN_TYPES, checkinDueDate } from "./placements.js";

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
    id: row.id, jobClientId: row.job_client_id, company: row.company || "", position: row.position || "", appliedDate: row.applied_date || "",
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

function employerFromRow(row) {
  return {
    id: row.id, businessName: row.business_name || "", industry: row.industry || "", website: row.website || "",
    street: row.street || "", city: row.city || "", zip: row.zip || "", state: row.state || "RI",
    contactName: row.contact_name || "", contactPhone: row.contact_phone || "", contactEmail: row.contact_email || "",
    hrContactName: row.hr_contact_name || "", hrContactPhone: row.hr_contact_phone || "", hrContactEmail: row.hr_contact_email || "",
    preferredCommunication: row.preferred_communication || "", notes: row.notes || "",
    partnershipStage: row.partnership_stage || "prospect", partnerSince: row.partner_since || "",
    lastMeetingDate: row.last_meeting_date || "", nextFollowUpDate: row.next_follow_up_date || "",
    assignedJobDeveloperEmail: row.assigned_job_developer_email || "", preferredHiringMethod: row.preferred_hiring_method || "",
    active: row.active, createdAt: row.created_at, updatedAt: row.updated_at
  };
}
function employerToRow(fields) {
  const row = {};
  if (fields.businessName !== undefined) row.business_name = fields.businessName;
  if (fields.industry !== undefined) row.industry = fields.industry;
  if (fields.website !== undefined) row.website = fields.website;
  if (fields.street !== undefined) row.street = fields.street;
  if (fields.city !== undefined) row.city = fields.city;
  if (fields.zip !== undefined) row.zip = fields.zip;
  if (fields.contactName !== undefined) row.contact_name = fields.contactName;
  if (fields.contactPhone !== undefined) row.contact_phone = fields.contactPhone;
  if (fields.contactEmail !== undefined) row.contact_email = fields.contactEmail;
  if (fields.hrContactName !== undefined) row.hr_contact_name = fields.hrContactName;
  if (fields.hrContactPhone !== undefined) row.hr_contact_phone = fields.hrContactPhone;
  if (fields.hrContactEmail !== undefined) row.hr_contact_email = fields.hrContactEmail;
  if (fields.preferredCommunication !== undefined) row.preferred_communication = fields.preferredCommunication;
  if (fields.notes !== undefined) row.notes = fields.notes;
  if (fields.partnershipStage !== undefined) row.partnership_stage = fields.partnershipStage;
  if (fields.partnerSince !== undefined) row.partner_since = fields.partnerSince || null;
  if (fields.lastMeetingDate !== undefined) row.last_meeting_date = fields.lastMeetingDate || null;
  if (fields.nextFollowUpDate !== undefined) row.next_follow_up_date = fields.nextFollowUpDate || null;
  if (fields.assignedJobDeveloperEmail !== undefined) row.assigned_job_developer_email = fields.assignedJobDeveloperEmail;
  if (fields.preferredHiringMethod !== undefined) row.preferred_hiring_method = fields.preferredHiringMethod;
  if (fields.active !== undefined) row.active = fields.active;
  return row;
}

function employerNoteFromRow(row) {
  return { id: row.id, employerId: row.employer_id, date: row.note_date, staffName: row.profiles ? row.profiles.name : "", content: row.content };
}
function employerActivityFromRow(row) {
  return {
    id: row.id, employerId: row.employer_id, date: row.activity_date, type: row.type || "call",
    summary: row.summary || "", followUpRequired: row.follow_up_required, staffName: row.profiles ? row.profiles.name : ""
  };
}
function employerDocumentFromRow(row) {
  return {
    id: row.id, employerId: row.employer_id, fileName: row.file_name, category: row.category || "other",
    storagePath: row.storage_path, uploadedAt: row.created_at, uploadedBy: row.profiles ? row.profiles.name : ""
  };
}

function jobOpeningFromRow(row) {
  return {
    id: row.id, employerId: row.employer_id,
    employerName: row.employers ? row.employers.business_name : undefined, employerCity: row.employers ? row.employers.city : undefined,
    title: row.title || "", department: row.department || "", description: row.description || "",
    responsibilities: row.responsibilities || "", requirements: row.requirements || "",
    education: row.education || "", experience: row.experience || "",
    certifications: row.certifications || [], skills: row.skills || [], languages: row.languages || [],
    payType: row.pay_type || "", payMin: row.pay_min, payMax: row.pay_max,
    employmentType: row.employment_type || "", schedule: row.schedule || "", hoursPerWeek: row.hours_per_week || "",
    benefits: row.benefits || "", startDate: row.start_date || "", openingsCount: row.openings_count || 1,
    applicationDeadline: row.application_deadline || "", transportationRequired: row.transportation_required,
    englishLevelRequired: row.english_level_required || "", applyMethod: row.apply_method || "",
    applyWebsite: row.apply_website || "", applyEmail: row.apply_email || "", internalNotes: row.internal_notes || "",
    status: row.status || "draft", source: row.source || "staff_added", postedDate: row.posted_date || "",
    createdAt: row.created_at, updatedAt: row.updated_at
  };
}
function jobOpeningToRow(fields) {
  const row = {};
  if (fields.employerId !== undefined) row.employer_id = fields.employerId;
  if (fields.title !== undefined) row.title = fields.title;
  if (fields.department !== undefined) row.department = fields.department;
  if (fields.description !== undefined) row.description = fields.description;
  if (fields.responsibilities !== undefined) row.responsibilities = fields.responsibilities;
  if (fields.requirements !== undefined) row.requirements = fields.requirements;
  if (fields.education !== undefined) row.education = fields.education;
  if (fields.experience !== undefined) row.experience = fields.experience;
  if (fields.certifications !== undefined) row.certifications = fields.certifications;
  if (fields.skills !== undefined) row.skills = fields.skills;
  if (fields.languages !== undefined) row.languages = fields.languages;
  if (fields.payType !== undefined) row.pay_type = fields.payType;
  if (fields.payMin !== undefined) row.pay_min = fields.payMin === "" ? null : fields.payMin;
  if (fields.payMax !== undefined) row.pay_max = fields.payMax === "" ? null : fields.payMax;
  if (fields.employmentType !== undefined) row.employment_type = fields.employmentType;
  if (fields.schedule !== undefined) row.schedule = fields.schedule;
  if (fields.hoursPerWeek !== undefined) row.hours_per_week = fields.hoursPerWeek;
  if (fields.benefits !== undefined) row.benefits = fields.benefits;
  if (fields.startDate !== undefined) row.start_date = fields.startDate || null;
  if (fields.openingsCount !== undefined) row.openings_count = fields.openingsCount || 1;
  if (fields.applicationDeadline !== undefined) row.application_deadline = fields.applicationDeadline || null;
  if (fields.transportationRequired !== undefined) row.transportation_required = fields.transportationRequired;
  if (fields.englishLevelRequired !== undefined) row.english_level_required = fields.englishLevelRequired;
  if (fields.applyMethod !== undefined) row.apply_method = fields.applyMethod;
  if (fields.applyWebsite !== undefined) row.apply_website = fields.applyWebsite;
  if (fields.applyEmail !== undefined) row.apply_email = fields.applyEmail;
  if (fields.internalNotes !== undefined) row.internal_notes = fields.internalNotes;
  if (fields.status !== undefined) row.status = fields.status;
  if (fields.source !== undefined) row.source = fields.source;
  return row;
}

function referralFromRow(row) {
  return {
    id: row.id, jobClientId: row.job_client_id, jobOpeningId: row.job_opening_id, employerId: row.employer_id,
    participantName: row.job_clients ? ((row.job_clients.first_name || "") + " " + (row.job_clients.last_name || "")).trim() : undefined,
    positionTitle: row.job_openings ? row.job_openings.title : undefined,
    employerName: row.employers ? row.employers.business_name : undefined,
    status: row.status || "ready", referralDate: row.referral_date || "", interviewDate: row.interview_date || "",
    assignedJobDeveloperEmail: row.assigned_job_developer_email || "", notes: row.notes || "",
    createdAt: row.created_at, updatedAt: row.updated_at
  };
}
function referralToRow(fields) {
  const row = {};
  if (fields.jobClientId !== undefined) row.job_client_id = fields.jobClientId;
  if (fields.jobOpeningId !== undefined) row.job_opening_id = fields.jobOpeningId;
  if (fields.employerId !== undefined) row.employer_id = fields.employerId;
  if (fields.status !== undefined) row.status = fields.status;
  if (fields.referralDate !== undefined) row.referral_date = fields.referralDate || null;
  if (fields.interviewDate !== undefined) row.interview_date = fields.interviewDate || null;
  if (fields.assignedJobDeveloperEmail !== undefined) row.assigned_job_developer_email = fields.assignedJobDeveloperEmail;
  if (fields.notes !== undefined) row.notes = fields.notes;
  return row;
}

function placementFromRow(row) {
  return {
    id: row.id, jobClientId: row.job_client_id, employerId: row.employer_id, jobOpeningId: row.job_opening_id, referralId: row.referral_id,
    participantName: row.job_clients ? ((row.job_clients.first_name || "") + " " + (row.job_clients.last_name || "")).trim() : undefined,
    employerName: row.employers ? row.employers.business_name : undefined,
    positionTitle: row.position_title || "", startDate: row.start_date || "", hourlyWage: row.hourly_wage,
    hoursPerWeek: row.hours_per_week || "", benefits: row.benefits || "",
    supervisorName: row.supervisor_name || "", supervisorContact: row.supervisor_contact || "",
    currentStatus: row.current_status || "active", endDate: row.end_date || "", reasonForLeaving: row.reason_for_leaving || "",
    createdAt: row.created_at, updatedAt: row.updated_at
  };
}
function placementToRow(fields) {
  const row = {};
  if (fields.jobClientId !== undefined) row.job_client_id = fields.jobClientId;
  if (fields.employerId !== undefined) row.employer_id = fields.employerId;
  if (fields.jobOpeningId !== undefined) row.job_opening_id = fields.jobOpeningId || null;
  if (fields.referralId !== undefined) row.referral_id = fields.referralId || null;
  if (fields.positionTitle !== undefined) row.position_title = fields.positionTitle;
  if (fields.startDate !== undefined) row.start_date = fields.startDate || null;
  if (fields.hourlyWage !== undefined) row.hourly_wage = fields.hourlyWage === "" ? null : fields.hourlyWage;
  if (fields.hoursPerWeek !== undefined) row.hours_per_week = fields.hoursPerWeek;
  if (fields.benefits !== undefined) row.benefits = fields.benefits;
  if (fields.supervisorName !== undefined) row.supervisor_name = fields.supervisorName;
  if (fields.supervisorContact !== undefined) row.supervisor_contact = fields.supervisorContact;
  if (fields.currentStatus !== undefined) row.current_status = fields.currentStatus;
  if (fields.endDate !== undefined) row.end_date = fields.endDate || null;
  if (fields.reasonForLeaving !== undefined) row.reason_for_leaving = fields.reasonForLeaving;
  return row;
}

function placementCheckinFromRow(row) {
  return {
    id: row.id, placementId: row.placement_id, checkinType: row.checkin_type, dueDate: row.due_date,
    completed: row.completed, completedDate: row.completed_date || "",
    performanceRating: row.performance_rating || "", attendanceNotes: row.attendance_notes || "",
    promotion: row.promotion, raise: row.raise,
    employerFeedback: row.employer_feedback || "", participantFeedback: row.participant_feedback || "", notes: row.notes || ""
  };
}
function placementCheckinToRow(fields) {
  const row = {};
  if (fields.completed !== undefined) row.completed = fields.completed;
  if (fields.completedDate !== undefined) row.completed_date = fields.completedDate || null;
  if (fields.performanceRating !== undefined) row.performance_rating = fields.performanceRating;
  if (fields.attendanceNotes !== undefined) row.attendance_notes = fields.attendanceNotes;
  if (fields.promotion !== undefined) row.promotion = fields.promotion;
  if (fields.raise !== undefined) row.raise = fields.raise;
  if (fields.employerFeedback !== undefined) row.employer_feedback = fields.employerFeedback;
  if (fields.participantFeedback !== undefined) row.participant_feedback = fields.participantFeedback;
  if (fields.notes !== undefined) row.notes = fields.notes;
  return row;
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
    status: row.status, source: row.source, createdAt: row.created_at, seriesId: row.series_id || null
  };
}
function appointmentToRow(fields) {
  const row = {
    client_id: fields.clientId || null, first_name: fields.firstName, last_name: fields.lastName,
    phone: fields.phone, email: fields.email, appt_date: fields.date || null, appt_time: fields.time || null,
    reason: fields.reason || "", assigned_email: fields.assignedEmail || "", meeting_with: fields.meetingWith,
    status: fields.status || (fields.source === "client" ? "requested" : "scheduled"), source: fields.source || "staff"
  };
  if (fields.seriesId !== undefined) row.series_id = fields.seriesId;
  return row;
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
// Every application across every job_client, flat -- for Reports.jsx's
// outcome/funnel trend, which needs the whole table rather than one
// client's applications at a time.
export async function fetchAllApplications() {
  const { data, error } = await supabase.from("job_applications").select("*");
  if (error) { console.warn("fetchAllApplications failed", error); return []; }
  return data.map(applicationFromRow);
}

// ---------- employers + notes/activity/documents ----------
// Employer & Job Opportunity Management, Phase 1. Employers is its own
// list-level table (no shared `clients` master row -- a business isn't a
// program participant, so there's no cross-program dedup concern the way
// job_clients/case_clients have via create_job_client/create_case_client).
// employer_notes/employer_activity/employer_documents are append-only detail
// tables fetched on demand by EmployerProfile.jsx, following the exact
// client_notes/communications/client_documents idiom above.

export async function fetchEmployers() {
  const { data, error } = await supabase.from("employers").select("*").order("business_name");
  if (error) { console.warn("fetchEmployers failed", error); return []; }
  return data.map(employerFromRow);
}
export async function createEmployer(fields) {
  const { data, error } = await supabase.from("employers").insert(employerToRow(fields)).select().single();
  if (error) throw error;
  return employerFromRow(data);
}
export async function updateEmployer(id, patch) {
  const { data, error } = await supabase.from("employers").update(Object.assign({}, employerToRow(patch), { updated_at: new Date().toISOString() })).eq("id", id).select().single();
  if (error) throw error;
  return employerFromRow(data);
}
export async function deleteEmployer(id) {
  const { error } = await supabase.from("employers").delete().eq("id", id);
  if (error) throw error;
}

export async function fetchEmployerNotes(employerId) {
  const { data, error } = await supabase.from("employer_notes").select("*, profiles(name)").eq("employer_id", employerId).order("created_at", { ascending: false });
  if (error) { console.warn("fetchEmployerNotes failed", error); return []; }
  return data.map(employerNoteFromRow);
}
export async function createEmployerNote(employerId, content) {
  const { data: auth } = await supabase.auth.getUser();
  const { data, error } = await supabase.from("employer_notes").insert({
    employer_id: employerId, content: (content || "").trim(), created_by: auth.user ? auth.user.id : null
  }).select("*, profiles(name)").single();
  if (error) throw error;
  return employerNoteFromRow(data);
}

export async function fetchEmployerActivity(employerId) {
  const { data, error } = await supabase.from("employer_activity").select("*, profiles(name)").eq("employer_id", employerId).order("created_at", { ascending: false });
  if (error) { console.warn("fetchEmployerActivity failed", error); return []; }
  return data.map(employerActivityFromRow);
}
// Every employer_activity row, flat, across every employer -- for
// WorkforceDashboard.jsx's "Recent Employer Activity" feed, which needs the
// whole table rather than one employer's activity at a time. Same
// dashboard-scoped "all rows, no context state" idiom as
// fetchAllApplications/fetchAllDistributions (Reports.jsx).
export async function fetchAllEmployerActivity() {
  const { data, error } = await supabase.from("employer_activity").select("*");
  if (error) { console.warn("fetchAllEmployerActivity failed", error); return []; }
  return data.map(employerActivityFromRow);
}
export async function createEmployerActivity(employerId, fields) {
  const { data: auth } = await supabase.auth.getUser();
  const { data, error } = await supabase.from("employer_activity").insert({
    employer_id: employerId, activity_date: fields.date || null, type: fields.type || "call",
    summary: fields.summary || "", follow_up_required: !!fields.followUpRequired, created_by: auth.user ? auth.user.id : null
  }).select("*, profiles(name)").single();
  if (error) throw error;
  return employerActivityFromRow(data);
}

export async function fetchEmployerDocuments(employerId) {
  const { data, error } = await supabase.from("employer_documents").select("*, profiles(name)").eq("employer_id", employerId).order("created_at", { ascending: false });
  if (error) { console.warn("fetchEmployerDocuments failed", error); return []; }
  return data.map(employerDocumentFromRow);
}
export async function createEmployerDocument(employerId, fields) {
  const { data: auth } = await supabase.auth.getUser();
  const { data, error } = await supabase.from("employer_documents").insert({
    employer_id: employerId, file_name: fields.fileName, category: fields.category || "other",
    storage_path: fields.storagePath, uploaded_by: auth.user ? auth.user.id : null
  }).select("*, profiles(name)").single();
  if (error) throw error;
  return employerDocumentFromRow(data);
}
export async function deleteEmployerDocument(id, storagePath) {
  await deleteClientFile(storagePath);
  const { error } = await supabase.from("employer_documents").delete().eq("id", id);
  if (error) throw error;
}

// ---------- job openings ----------
// Employer & Job Opportunity Management, Phase 2. A list-level table like
// employers -- embeds employers(business_name, city) for display on the
// standalone Job Openings list without a second query.

export async function fetchJobOpenings() {
  const { data, error } = await supabase.from("job_openings").select("*, employers(business_name, city)").order("posted_date", { ascending: false });
  if (error) { console.warn("fetchJobOpenings failed", error); return []; }
  return data.map(jobOpeningFromRow);
}
export async function createJobOpening(fields) {
  const { data, error } = await supabase.from("job_openings").insert(jobOpeningToRow(fields)).select("*, employers(business_name, city)").single();
  if (error) throw error;
  return jobOpeningFromRow(data);
}
export async function updateJobOpening(id, patch) {
  const { data, error } = await supabase.from("job_openings").update(Object.assign({}, jobOpeningToRow(patch), { updated_at: new Date().toISOString() })).eq("id", id).select("*, employers(business_name, city)").single();
  if (error) throw error;
  return jobOpeningFromRow(data);
}
export async function deleteJobOpening(id) {
  const { error } = await supabase.from("job_openings").delete().eq("id", id);
  if (error) throw error;
}

// ---------- referrals ----------
// Employer & Job Opportunity Management, Phase 3. Links a job_client
// (job-seeker) to a job_opening; employer_id is denormalized from the
// opening so the kanban/counts don't need a second join.

export async function fetchReferrals() {
  const { data, error } = await supabase.from("referrals").select("*, job_clients(first_name, last_name), job_openings(title), employers(business_name)").order("created_at", { ascending: false });
  if (error) { console.warn("fetchReferrals failed", error); return []; }
  return data.map(referralFromRow);
}
export async function createReferral(fields) {
  const { data, error } = await supabase.from("referrals").insert(referralToRow(fields)).select("*, job_clients(first_name, last_name), job_openings(title), employers(business_name)").single();
  if (error) throw error;
  return referralFromRow(data);
}
export async function updateReferral(id, patch) {
  const { data, error } = await supabase.from("referrals").update(Object.assign({}, referralToRow(patch), { updated_at: new Date().toISOString() })).eq("id", id).select("*, job_clients(first_name, last_name), job_openings(title), employers(business_name)").single();
  if (error) throw error;
  return referralFromRow(data);
}
export async function deleteReferral(id) {
  const { error } = await supabase.from("referrals").delete().eq("id", id);
  if (error) throw error;
}

// ---------- placements + check-ins ----------
// Employer & Job Opportunity Management, Phase 4. createPlacement() inserts
// the placement, then its 4 fixed 30/60/90/180-day check-in rows in one
// follow-up insert -- same "create parent, then follow-up writes" idiom as
// the resume upload in JobDeveloper.jsx, no new Postgres trigger/RPC needed.

export async function fetchPlacements() {
  const { data, error } = await supabase.from("placements").select("*, job_clients(first_name, last_name), employers(business_name)").order("start_date", { ascending: false });
  if (error) { console.warn("fetchPlacements failed", error); return []; }
  return data.map(placementFromRow);
}
export async function createPlacement(fields) {
  const { data, error } = await supabase.from("placements").insert(placementToRow(fields)).select("*, job_clients(first_name, last_name), employers(business_name)").single();
  if (error) throw error;
  const placement = placementFromRow(data);
  const checkinRows = CHECKIN_TYPES.map((c) => ({
    placement_id: placement.id, checkin_type: c.key, due_date: checkinDueDate(placement.startDate, c.days)
  }));
  const { data: checkinData, error: checkinError } = await supabase.from("placement_checkins").insert(checkinRows).select();
  if (checkinError) throw checkinError;
  return { placement, checkins: checkinData.map(placementCheckinFromRow) };
}
export async function updatePlacement(id, patch) {
  const { data, error } = await supabase.from("placements").update(Object.assign({}, placementToRow(patch), { updated_at: new Date().toISOString() })).eq("id", id).select("*, job_clients(first_name, last_name), employers(business_name)").single();
  if (error) throw error;
  return placementFromRow(data);
}

export async function fetchAllPlacementCheckins() {
  const { data, error } = await supabase.from("placement_checkins").select("*");
  if (error) { console.warn("fetchAllPlacementCheckins failed", error); return []; }
  return data.map(placementCheckinFromRow);
}
export async function updatePlacementCheckin(id, patch) {
  const { data, error } = await supabase.from("placement_checkins").update(Object.assign({}, placementCheckinToRow(patch), { updated_at: new Date().toISOString() })).eq("id", id).select().single();
  if (error) throw error;
  return placementCheckinFromRow(data);
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
// Recurring appointments: no RRULE/cron -- just insert one concrete row per
// occurrence up front (weekly/biweekly/monthly, `count` times starting from
// fields.date), all sharing a freshly generated series_id so the UI can
// label them and cancel the rest of the series in one action.
export async function createAppointmentSeries(fields, intervalDays, count) {
  const seriesId = crypto.randomUUID();
  const startDate = new Date(fields.date + "T00:00:00");
  const rows = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(startDate);
    d.setDate(d.getDate() + i * intervalDays);
    const dateStr = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
    rows.push(appointmentToRow(Object.assign({}, fields, { date: dateStr, seriesId })));
  }
  const { error } = await supabase.from("appointments").insert(rows);
  if (error) throw error;
}
// Cancels every not-yet-completed occurrence in a series from today onward,
// leaving past/completed occurrences as history.
export async function cancelAppointmentSeries(seriesId, fromDate) {
  const { error } = await supabase.from("appointments")
    .update({ status: "cancelled" })
    .eq("series_id", seriesId)
    .gte("appt_date", fromDate)
    .neq("status", "completed");
  if (error) throw error;
}
// Public self-service lookup (no client accounts exist -- see
// lookup_client_appointments migration). Two-factor: last name plus either
// email or phone, whichever the client used when requesting.
export async function lookupClientAppointments(lastName, email, phone) {
  const { data, error } = await supabase.rpc("lookup_client_appointments", {
    p_last_name: lastName, p_email: email || "", p_phone: phone || ""
  });
  if (error) { console.warn("lookupClientAppointments failed", error); return []; }
  return (data || []).map((row) => ({
    date: row.appt_date || "", time: row.appt_time || "", meetingWith: row.meeting_with,
    status: row.status, reason: row.reason || ""
  }));
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
export async function deleteClientDocument(id, storagePath) {
  await deleteClientFile(storagePath);
  const { error } = await supabase.from("client_documents").delete().eq("id", id);
  if (error) throw error;
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

// ---------- workforce role access (admin-configurable, Settings page) ----------
// Which non-administrator roles can see the Workforce Development module.
// Administrator itself isn't stored here -- it always has access (see
// lib/nav.js's enabledWorkforceRoles()/navItemsForRole()).

export async function fetchWorkforceRoleAccess() {
  const { data, error } = await supabase.from("workforce_role_access").select("*");
  if (error) { console.warn("fetchWorkforceRoleAccess failed", error); return []; }
  return data.map((row) => ({ role: row.role, enabled: row.enabled }));
}
export async function setWorkforceRoleAccess(role, enabled) {
  const { error } = await supabase.from("workforce_role_access").update({ enabled, updated_at: new Date().toISOString() }).eq("role", role);
  if (error) throw error;
}

// ---------- realtime ----------

export function subscribeClientsTable(table, onChange) {
  const channel = supabase
    .channel(table + "-clients-changes")
    .on("postgres_changes", { event: "*", schema: "public", table }, onChange)
    .subscribe();
  return () => supabase.removeChannel(channel);
}
