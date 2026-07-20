// masterClients.js -- the unified "one person, one record" identity layer
// sitting on top of the existing per-program arrays (data.caseClients,
// data.jobClients). Case Management and Job Developer keep their own
// records/CRUD exactly as before (see clients.js); this module adds a
// parallel data.clients array (master identity: name/contact/status) plus
// data.programEnrollments (join rows linking a master client to a program
// record), and the matching/lookup helpers both pages and the Client
// Profile page need. Never merges records automatically -- matching
// functions only ever return candidates for a human to act on.
// Which data[] array holds each program's detail records. Extending to a
// new program (Phase 3: "student" -> data.students, "food" -> data.foodClients)
// is just one more entry here plus a PROGRAM_META entry on the Client
// Profile page -- everything else in this file is generic over `kind`.
export var PROGRAM_DATA_KEY = { case: "caseClients", job: "jobClients", student: "students", food: "foodClients" };

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

// Resolves a master client's program enrollments into full records.
// Phase 2 Supabase migration: there's no separate program_enrollments join
// table anymore (it only ever stored two fields nothing used -- status
// always "active", assignedStaffId always null -- see
// plans/wobbly-munching-rose.md) -- each program table carries its own
// `nbId` (joined from `clients` server-side, see clientsData.js), so
// "which programs is this person in" is just filtering each pool by nbId.
export function resolveEnrollmentsForClient(nbId, data) {
  var client = findClientByNbId(nbId, data);
  if (!client) return [];
  var out = [];
  ["case", "job", "student", "food"].forEach(function (programType) {
    var pool = data[PROGRAM_DATA_KEY[programType]] || [];
    pool.filter(function (r) { return r.nbId === nbId; }).forEach(function (record) {
      out.push({ enrollment: { id: record.id, status: "active", enrolledAt: record.intakeDate || "" }, programType: programType, record: record });
    });
  });
  return out;
}

// Phase 2 Supabase migration: appointments now carry a direct `clientId`
// (the master clients.id) instead of the old linkedClientId -> program-
// record-id -> programEnrollments resolution chain -- a real simplification
// once you're not bound to replicating a JSON array's join limitations.
export function resolveAppointmentsForClient(nbId, data) {
  var client = findClientByNbId(nbId, data);
  if (!client) return [];
  return (data.appointments || []).filter(function (a) { return a.clientId === client.id; })
    .sort(function (a, b) { return ((b.date || "") + (b.time || "")).localeCompare((a.date || "") + (a.time || "")); });
}

