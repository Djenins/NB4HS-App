// students.js -- pure helpers for the Check-In/Dashboard flows and the full
// Students page (roster board, sessions, enrollment, CSV/Excel import).
// Ported from the original students.js. Functions that used to mutate
// App.data and call save()/render() themselves (enrollStudent, updateStudent,
// importStudentRows, importPastSessionRows) now return the new data instead;
// the Students page applies it via AppContext's setData.
import { COLUMN_ACCENTS, WEEKDAYS } from "./constants.js";
import { t } from "./i18n.js";
import { downloadBlob, fullServiceList, labelFor, parseCSVText } from "./utils.js";

export function studentDisplayName(s) { return (s.lastName || "") + ", " + (s.firstName || ""); }
// mode: "name" (default, A-Z by last/first) | "id" (Student ID ascending --
// oldest enrolled first, since IDs are assigned sequentially) | "recent"
// (Student ID descending -- newest enrolled first). Optional third arg so
// every existing call site (this file's board, plus the Case Management/Job
// Developer client lists which pass wrapper objects with no studentId) keeps
// working unchanged and still gets the original name sort.
export function sortStudentsList(arr, mode) {
  var out = arr.slice();
  if (mode === "id") {
    out.sort(function (a, b) { return (a.studentId || "").localeCompare(b.studentId || ""); });
  } else if (mode === "recent") {
    out.sort(function (a, b) { return (b.studentId || "").localeCompare(a.studentId || ""); });
  } else {
    out.sort(function (a, b) { return studentDisplayName(a).toLowerCase().localeCompare(studentDisplayName(b).toLowerCase()); });
  }
  return out;
}
export function studentMatchesSearch(s, term) {
  if (!term) return true;
  var hay = ((s.firstName || "") + " " + (s.lastName || "") + " " + (s.phone || "") + " " + (s.studentId || "")).toLowerCase();
  return hay.indexOf(term) !== -1;
}
// Board "Filter" control: flags students with no phone number AND no address
// on file, so staff can spot roster entries they have no way to follow up
// with. Real, data-driven filter (not decorative) -- the only per-student
// attribute in this app's model that's meaningfully "filterable" the way the
// reference board's tag/assignee filters were.
export function studentMissingContact(s) {
  return !((s.phone || "").trim()) && !(s.street || s.city || s.zip);
}
export function columnAccentColor(key, index) {
  if (key === "waiting") return "var(--gold-ink)"; // gold -- theme-aware, see COLUMN_ACCENTS
  return COLUMN_ACCENTS[index % COLUMN_ACCENTS.length];
}
// The faint disc behind a classroom's icon. Colour-mixed at call time rather
// than by string-concatenating an alpha suffix onto a hex, which stopped
// working when the accents became tokens -- `var(--primary)22` is not a
// colour. Mixing against transparent keeps it readable on either theme's card.
export function columnAccentTint(color) {
  return "color-mix(in srgb, " + color + " 13%, transparent)";
}
// Counts students actually placed in a classroom (Level 1/2/3, Online, or
// any other active class) -- the waiting list is the backlog, not an
// enrollment, so it's deliberately excluded here even though those students
// are still `active`.
export function totalEnrolledCount(students) {
  return (students || []).filter(function (s) { return s.active !== false && !!s.classKey; }).length;
}
export function waitingListStudents(students) {
  return (students || []).filter(function (s) { return !s.classKey && s.active !== false; });
}
// Waiting List students who've additionally flagged which specific class
// they want a seat in (vs. just sitting in the generic backlog), oldest
// request first so promotion is FIFO.
export function waitlistForClass(students, classKey) {
  return (students || [])
    .filter(function (s) { return !s.classKey && s.active !== false && s.waitlistedForClassKey === classKey; })
    .sort(function (a, b) { return (a.waitlistedAt || "").localeCompare(b.waitlistedAt || ""); });
}

// Pure version of enrollStudent(): returns the fields to insert, or null if
// required fields are missing. No `id`/`studentId` here anymore -- both are
// assigned server-side on insert (a real Postgres uuid and the
// next_student_display_id() sequence, respectively -- see checkinData.js's
// createStudent()), so the caller just inserts and reads the assigned ids
// back off the returned row.
export function enrollStudent(fields) {
  var firstName = (fields.firstName || "").trim();
  var lastName = (fields.lastName || "").trim();
  if (!firstName || !lastName) return null;
  return {
    firstName: firstName,
    lastName: lastName,
    phone: (fields.phone || "").trim(),
    email: (fields.email || "").trim(),
    street: (fields.street || "").trim(),
    city: (fields.city || "").trim(),
    zip: (fields.zip || "").trim(),
    state: "RI",
    classKey: null,
    active: true
  };
}

// Pure version of updateStudent(): returns the updated student object (or
// null if required fields are missing) instead of mutating in place.
// Pretest/posttest scores are plain optional numeric strings (blank = not
// entered yet) -- see assessments.js for how they're turned into NRS levels.
// Reading STEPS only -- NB4HS doesn't administer a Listening test.
export function buildUpdatedStudent(student, fields) {
  var firstName = (fields.firstName || "").trim();
  var lastName = (fields.lastName || "").trim();
  if (!firstName || !lastName) return null;
  return Object.assign({}, student, {
    firstName: firstName,
    lastName: lastName,
    phone: (fields.phone || "").trim(),
    email: (fields.email || "").trim(),
    street: (fields.street || "").trim(),
    city: (fields.city || "").trim(),
    zip: (fields.zip || "").trim(),
    state: "RI",
    pretestReading: (fields.pretestReading || "").toString().trim(),
    posttestReading: (fields.posttestReading || "").toString().trim()
  });
}

export function studentCsvTemplateContent() {
  return "First Name,Last Name,Phone,Email,Street Address,City,ZIP Code\r\n";
}
export function pastRosterCsvTemplateContent() {
  return "First Name,Last Name,Phone,Email,Street Address,City,ZIP Code,Classroom\r\n";
}
export function downloadStudentTemplate() {
  if (typeof XLSX !== "undefined") {
    try {
      var ws = XLSX.utils.aoa_to_sheet([["First Name", "Last Name", "Phone", "Email", "Street Address", "City", "ZIP Code"]]);
      var wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Students");
      XLSX.writeFile(wb, "NB4HS-Student-Template.xlsx");
      return;
    } catch (e) { /* fall through to CSV */ }
  }
  downloadBlob(studentCsvTemplateContent(), "NB4HS-Student-Template.csv", "text/csv;charset=utf-8;");
}
export function downloadPastSessionTemplate() {
  if (typeof XLSX !== "undefined") {
    try {
      var ws = XLSX.utils.aoa_to_sheet([["First Name", "Last Name", "Phone", "Email", "Street Address", "City", "ZIP Code", "Classroom"]]);
      var wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Past Roster");
      XLSX.writeFile(wb, "NB4HS-Past-Session-Roster-Template.xlsx");
      return;
    } catch (e) { /* fall through to CSV */ }
  }
  downloadBlob(pastRosterCsvTemplateContent(), "NB4HS-Past-Session-Roster-Template.csv", "text/csv;charset=utf-8;");
}

// Pure version of importStudentRows(): given parsed CSV/Excel rows and the
// existing roster, returns the rows to insert (duplicates -- same
// first/last/phone as an existing student -- are skipped, same as the
// original). No `id`/`studentId` generation here anymore -- see
// enrollStudent()'s comment above; the caller enrolls each row via
// createStudentWithClient() (checkinData.js) and both ids come back assigned.
export function buildImportedStudents(rows, existingStudents) {
  if (!rows || rows.length < 2) return null;
  var existingKey = {};
  (existingStudents || []).forEach(function (s) {
    existingKey[(s.firstName + "|" + s.lastName + "|" + (s.phone || "")).toLowerCase()] = true;
  });
  var added = [];
  for (var i = 1; i < rows.length; i++) {
    var r = rows[i];
    if (!r || !r.length) continue;
    var firstName = (r[0] || "").toString().trim();
    var lastName = (r[1] || "").toString().trim();
    var phone = (r[2] || "").toString().trim();
    var email = (r[3] || "").toString().trim();
    var street = (r[4] || "").toString().trim();
    var city = (r[5] || "").toString().trim();
    var zip = (r[6] || "").toString().trim();
    if (!firstName && !lastName) continue;
    var key = (firstName + "|" + lastName + "|" + phone).toLowerCase();
    if (existingKey[key]) continue;
    added.push({ firstName: firstName, lastName: lastName, phone: phone, email: email, street: street, city: city, zip: zip, state: "RI", classKey: null, active: true });
    existingKey[key] = true;
  }
  return { added: added };
}

// Pure version of importPastSessionRows(): returns the past-roster rows to
// append plus how many classroom names in the sheet didn't match a real
// classroom (still imported, just without a linked classKey). No `id`
// generation here anymore -- the caller bulk-inserts via
// createPastSessionStudents() (sessionsData.js), which gets a real
// Postgres uuid back per row.
export function buildImportedPastRoster(sessionId, rows, classes) {
  if (!rows || rows.length < 2) return null;
  var added = [];
  var unmatched = 0;
  for (var i = 1; i < rows.length; i++) {
    var r = rows[i];
    if (!r || !r.length) continue;
    var firstName = (r[0] || "").toString().trim();
    var lastName = (r[1] || "").toString().trim();
    var phone = (r[2] || "").toString().trim();
    var email = (r[3] || "").toString().trim();
    var street = (r[4] || "").toString().trim();
    var city = (r[5] || "").toString().trim();
    var zip = (r[6] || "").toString().trim();
    var classroomText = (r[7] || "").toString().trim();
    if (!firstName && !lastName) continue;
    var matchedClass = (classes || []).filter(function (c) { return c.name.toLowerCase() === classroomText.toLowerCase(); })[0];
    if (classroomText && !matchedClass) unmatched++;
    added.push({
      sessionId: sessionId, firstName: firstName, lastName: lastName, phone: phone, email: email,
      street: street, city: city, zip: zip, state: "RI",
      classKey: matchedClass ? matchedClass.key : null, className: matchedClass ? matchedClass.name : classroomText
    });
  }
  return { added: added, unmatched: unmatched };
}

// Reads a .csv/.xlsx/.xls file into an array-of-rows (header row included),
// same shape the original's FileReader callbacks produced. Shared by both
// the Students roster upload and the past-session-roster upload (they were
// identical in the original except for which import function got the
// result -- that difference now lives at the call site, not duplicated here).
export function readRowsFromFile(file, onRows, onError) {
  var name = file.name.toLowerCase();
  var reader = new FileReader();
  if (name.endsWith(".csv")) {
    reader.onload = function (e) { onRows(parseCSVText(e.target.result)); };
    reader.onerror = function () { onError(); };
    reader.readAsText(file);
  } else {
    if (typeof XLSX === "undefined") { onError(); return; }
    reader.onload = function (e) {
      try {
        var data = new Uint8Array(e.target.result);
        var wb = XLSX.read(data, { type: "array" });
        var sheet = wb.Sheets[wb.SheetNames[0]];
        var rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
        onRows(rows);
      } catch (err) { onError(); }
    };
    reader.onerror = function () { onError(); };
    reader.readAsArrayBuffer(file);
  }
}

export function classesMeetingToday(classes) {
  var dow = new Date().getDay();
  return (classes || []).filter(function (c) { return c.active !== false && c.days.indexOf(dow) !== -1; });
}
export function studentsForClass(students, classKey) {
  return (students || []).filter(function (s) { return s.classKey === classKey && s.active !== false; });
}
export function classByKey(classes, key) {
  return (classes || []).filter(function (c) { return c.key === key; })[0];
}
export function meetingDaysLabel(days, lang) {
  if (!days || !days.length) return t("onlineNoDays", lang);
  var names = WEEKDAYS[lang] || WEEKDAYS.en;
  return days.slice().sort().map(function (d) { return names[d]; }).join(", ");
}
export function serviceDisplay(v, customServices, lang) {
  var label = labelFor(fullServiceList(customServices), v.service, lang);
  if (v.service === "other" && v.serviceOther) label += ": " + v.serviceOther;
  if (v.className) label += " – " + v.className;
  return label;
}
export function studentAlreadyCheckedInToday(visits, studentId, todayStrVal) {
  return (visits || []).some(function (v) { return v.studentId === studentId && v.date === todayStrVal; });
}
