// masterClients.js -- the unified "one person, one record" identity layer
// sitting on top of the existing per-program arrays (data.caseClients,
// data.jobClients). Case Management and Job Developer keep their own
// records/CRUD exactly as before (see clients.js); this module adds a
// parallel data.clients array (master identity: name/contact/status) plus
// data.programEnrollments (join rows linking a master client to a program
// record), and the matching/lookup helpers both pages and the Client
// Profile page need. Never merges records automatically -- matching
// functions only ever return candidates for a human to act on.
import { genClientId, todayStr, uid } from "./utils.js";

// Which data[] array holds each program's detail records. Extending to a
// new program (Phase 3: "student" -> data.students, "food" -> data.foodClients)
// is just one more entry here plus a PROGRAM_META entry on the Client
// Profile page -- everything else in this file is generic over `kind`.
export var PROGRAM_DATA_KEY = { case: "caseClients", job: "jobClients", student: "students", food: "foodClients" };

// Pure constructor for a data.clients row. Kept intentionally minimal --
// only fields something in this phase actually reads/writes. Fields like
// emergency contact/preferred language have no consumer yet and are left
// for a future phase rather than guessed at now.
export function buildMasterClient(fields, nbId) {
  var now = new Date().toISOString();
  return {
    id: uid(),
    nbId: nbId,
    firstName: (fields.firstName || "").trim(),
    lastName: (fields.lastName || "").trim(),
    phone: (fields.phone || "").trim(),
    email: (fields.email || "").trim(),
    dob: fields.dob || "",
    street: (fields.street || "").trim(),
    city: (fields.city || "").trim(),
    zip: (fields.zip || "").trim(),
    state: "RI",
    intakeDate: fields.intakeDate || "",
    status: "active",
    createdAt: now,
    updatedAt: now
  };
}

// Pure constructor for a data.programEnrollments row.
export function buildEnrollment(clientId, programType, programRecordId, extra) {
  extra = extra || {};
  return {
    id: uid(),
    clientId: clientId,
    programType: programType, // "case" | "job"
    programRecordId: programRecordId,
    status: "active",
    enrolledAt: todayStr(),
    assignedStaffId: extra.assignedStaffId || null
  };
}

function normalizedPhone(v) { return String(v || "").replace(/\D/g, ""); }
function normalizedText(v) { return String(v || "").trim().toLowerCase(); }

// Duplicate-prevention matcher. Returns [{ client, matchedOn: [...] }] for
// every existing master client that looks like the same person as
// `candidate` (a fields object with firstName/lastName/phone/email/dob/
// street/zip). Never merges -- purely informational for the caller.
export function findPossibleDuplicates(candidate, clients) {
  var candPhone = normalizedPhone(candidate.phone);
  var candEmail = normalizedText(candidate.email);
  var candFirst = normalizedText(candidate.firstName);
  var candLast = normalizedText(candidate.lastName);
  var candDob = candidate.dob || "";
  var candStreet = normalizedText(candidate.street);
  var candZip = normalizedText(candidate.zip);

  var out = [];
  (clients || []).forEach(function (client) {
    var matchedOn = [];
    if (candPhone && normalizedPhone(client.phone) === candPhone) matchedOn.push("phone");
    if (candEmail && normalizedText(client.email) === candEmail) matchedOn.push("email");
    if (candFirst && candLast && candDob &&
      normalizedText(client.firstName) === candFirst && normalizedText(client.lastName) === candLast && client.dob === candDob) {
      matchedOn.push("nameDob");
    }
    if (candFirst && candLast && candStreet && candZip &&
      normalizedText(client.firstName) === candFirst && normalizedText(client.lastName) === candLast &&
      normalizedText(client.street) === candStreet && normalizedText(client.zip) === candZip) {
      matchedOn.push("nameAddress");
    }
    if (matchedOn.length) out.push({ client: client, matchedOn: matchedOn });
  });
  return out;
}

export function findClientByNbId(nbId, data) {
  return (data.clients || []).filter(function (c) { return c.nbId === nbId; })[0] || null;
}

// Resolves a master client's program enrollments into full records by
// looking up caseClients/jobClients via programRecordId. Always reads live
// from `data`, so it reflects whatever's currently in state.
export function resolveEnrollmentsForClient(nbId, data) {
  var client = findClientByNbId(nbId, data);
  if (!client) return [];
  var enrollments = (data.programEnrollments || []).filter(function (e) { return e.clientId === client.id; });
  return enrollments.map(function (enrollment) {
    var pool = data[PROGRAM_DATA_KEY[enrollment.programType]] || [];
    var record = pool.filter(function (r) { return r.id === enrollment.programRecordId; })[0] || null;
    return { enrollment: enrollment, programType: enrollment.programType, record: record };
  }).filter(function (e) { return e.record; });
}

// Atomic "create or attach" used by both pages' add-client flows: given an
// already-built program row (from clients.js's buildClient()) and an
// optional already-matched master client (from the duplicate-warning flow's
// "Enroll Existing Client" action), returns the new `data` with the program
// row (+nbId), the master client (new or reused), and the enrollment all
// applied together in one update.
export function attachClientToProgram(prev, kind, programRow, matchedClient) {
  var dataKey = PROGRAM_DATA_KEY[kind];
  var clients = prev.clients || [];
  var nextClientNumber = prev.nextClientNumber || 1;
  var master = matchedClient;
  if (!master) {
    master = buildMasterClient(programRow, genClientId(nextClientNumber));
    nextClientNumber += 1;
    clients = clients.concat([master]);
  }
  var rowWithNb = Object.assign({}, programRow, { nbId: master.nbId });
  var enrollment = buildEnrollment(master.id, kind, rowWithNb.id, {});
  var patch = { clients: clients, programEnrollments: (prev.programEnrollments || []).concat([enrollment]), nextClientNumber: nextClientNumber };
  patch[dataKey] = (prev[dataKey] || []).concat([rowWithNb]);
  return Object.assign({}, prev, patch);
}

// Pure constructors for the unified (department-agnostic) Notes/Documents/
// Communications layers -- Phase 4. These are separate from each program's
// own inline records (e.g. caseClients[].notes, still written by
// CaseNotesPanel) -- that existing per-program notes feature is untouched;
// these are client-level records visible regardless of which department
// wrote them.
export function buildClientNote(clientId, fields, staff) {
  return {
    id: uid(),
    clientId: clientId,
    date: todayStr(),
    time: new Date().toISOString(),
    staffName: (staff && staff.currentUserName) || "",
    department: fields.department || "general",
    type: fields.type || "general",
    visibility: fields.visibility || "all",
    content: (fields.content || "").trim()
  };
}

export function buildClientDocument(clientId, fields, staff) {
  return {
    id: uid(),
    clientId: clientId,
    fileName: fields.fileName || "",
    category: fields.category || "other",
    dataUri: fields.dataUri || "",
    uploadedAt: todayStr(),
    uploadedBy: (staff && staff.currentUserName) || "",
    program: fields.program || ""
  };
}

export function buildCommunication(clientId, fields, staff) {
  return {
    id: uid(),
    clientId: clientId,
    date: todayStr(),
    staffName: (staff && staff.currentUserName) || "",
    method: fields.method || "phone",
    direction: fields.direction || "outbound",
    summary: (fields.summary || "").trim(),
    followUpRequired: !!fields.followUpRequired
  };
}

export function resolveNotesForClient(nbId, data) {
  var client = findClientByNbId(nbId, data);
  if (!client) return [];
  return (data.clientNotes || []).filter(function (n) { return n.clientId === client.id; })
    .sort(function (a, b) { return (b.time || "").localeCompare(a.time || ""); });
}

export function resolveDocumentsForClient(nbId, data) {
  var client = findClientByNbId(nbId, data);
  if (!client) return [];
  return (data.clientDocuments || []).filter(function (d) { return d.clientId === client.id; })
    .sort(function (a, b) { return (b.uploadedAt || "").localeCompare(a.uploadedAt || ""); });
}

export function resolveCommunicationsForClient(nbId, data) {
  var client = findClientByNbId(nbId, data);
  if (!client) return [];
  return (data.communications || []).filter(function (c) { return c.clientId === client.id; })
    .sort(function (a, b) { return (b.date || "").localeCompare(a.date || ""); });
}

// Appointments already exist as one shared data.appointments array
// (see appointments.js) linked to a case/job program record via
// linkedClientId -- resolve through this client's case/job enrollments
// rather than adding a second, competing appointments model.
export function resolveAppointmentsForClient(nbId, data) {
  var client = findClientByNbId(nbId, data);
  if (!client) return [];
  var recordIds = (data.programEnrollments || [])
    .filter(function (e) { return e.clientId === client.id && (e.programType === "case" || e.programType === "job"); })
    .map(function (e) { return e.programRecordId; });
  return (data.appointments || []).filter(function (a) { return recordIds.indexOf(a.linkedClientId) !== -1; })
    .sort(function (a, b) { return ((b.date || "") + (b.time || "")).localeCompare((a.date || "") + (a.time || "")); });
}

// One-time migration: builds data.clients/data.programEnrollments from the
// caseClients/jobClients arrays that already exist, adding an `nbId` FK
// onto each row. Original rows are never mutated in place -- this returns
// new copies; all other fields are preserved verbatim. A person appearing
// in both arrays with a matching phone/email/name+dob collapses into one
// master record during this one pass (a deterministic, one-time
// reconciliation -- not a precedent for later live auto-merging, which
// stays manual per the duplicate-warning flow).
export function runUnifiedClientsMigration(d) {
  var clients = [];
  var enrollments = [];
  var counter = d.nextClientNumber || 1;

  function migrateRow(row, kind) {
    var matches = findPossibleDuplicates(row, clients);
    var master = matches.length ? matches[0].client : null;
    if (!master) {
      master = buildMasterClient(row, genClientId(counter));
      counter += 1;
      clients.push(master);
    }
    var rowWithNb = Object.assign({}, row, { nbId: master.nbId });
    enrollments.push(buildEnrollment(master.id, kind, rowWithNb.id, {}));
    return rowWithNb;
  }

  var caseClients = (d.caseClients || []).map(function (row) { return migrateRow(row, "case"); });
  var jobClients = (d.jobClients || []).map(function (row) { return migrateRow(row, "job"); });
  // Phase 3: fold in Adult Education (data.students) and Food Distribution
  // (data.foodClients) the same way. data.pastSessionStudents is a
  // historical archive of closed sessions, not an active roster -- left out
  // of the unified layer on purpose.
  var students = (d.students || []).map(function (row) { return migrateRow(row, "student"); });
  var foodClients = (d.foodClients || []).map(function (row) { return migrateRow(row, "food"); });

  return {
    clients: clients, programEnrollments: enrollments,
    caseClients: caseClients, jobClients: jobClients, students: students, foodClients: foodClients,
    nextClientNumber: counter
  };
}
