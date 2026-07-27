// jobOpenings.js -- constants and pure helpers for the Job Openings module
// (src/pages/JobOpenings.jsx, src/components/JobOpeningWizard.jsx,
// src/components/JobOpeningDetailModal.jsx). Mirrors employerProfile.js's
// shape exactly (its own file since none of this is shared elsewhere).
export var JOB_OPENING_STATUSES = [
  { key: "draft", en: "Draft" },
  { key: "active", en: "Active" },
  { key: "filled", en: "Filled" },
  { key: "expired", en: "Expired" },
  { key: "archived", en: "Archived" }
];

// "Future Ready Architecture" sources -- direct_employer/staff_added/
// community_partner are entered by staff today; public_job_board/
// government_source are reserved for later feed integrations (RI DOL,
// Indeed, LinkedIn, etc.) that don't exist yet.
export var JOB_OPENING_SOURCES = [
  { key: "direct_employer", en: "Direct Employer" },
  { key: "community_partner", en: "Community Partner" },
  { key: "staff_added", en: "Staff Added" },
  { key: "public_job_board", en: "Public Job Board" },
  { key: "government_source", en: "Government Source" }
];

export var EMPLOYMENT_TYPES = [
  { key: "full_time", en: "Full-Time" },
  { key: "part_time", en: "Part-Time" },
  { key: "seasonal", en: "Seasonal" },
  { key: "temporary", en: "Temporary" },
  { key: "internship", en: "Internship" }
];

export var EDUCATION_LEVELS = [
  { key: "none", en: "No Requirement" },
  { key: "high_school", en: "High School / GED" },
  { key: "some_college", en: "Some College" },
  { key: "associates", en: "Associate's Degree" },
  { key: "bachelors", en: "Bachelor's Degree" },
  { key: "graduate", en: "Graduate Degree" }
];

export var EXPERIENCE_LEVELS = [
  { key: "none", en: "No Experience Required" },
  { key: "entry", en: "Entry Level (0-1 years)" },
  { key: "mid", en: "Mid Level (2-4 years)" },
  { key: "senior", en: "Senior (5+ years)" }
];

export var ENGLISH_LEVEL_REQUIREMENTS = [
  { key: "none", en: "Not Required" },
  { key: "basic", en: "Basic" },
  { key: "intermediate", en: "Intermediate" },
  { key: "advanced", en: "Advanced" },
  { key: "fluent", en: "Fluent" }
];

export var APPLY_METHODS = [
  { key: "website", en: "Website" },
  { key: "email", en: "Email" },
  { key: "in_person", en: "In Person" },
  { key: "other", en: "Other" }
];

export var PAY_TYPES = [
  { key: "hourly", en: "Hourly" },
  { key: "salary", en: "Salary" }
];

function labelFor(list, key) {
  var found = list.filter(function (i) { return i.key === key; })[0];
  return found ? found.en : (key || "");
}
export function statusLabel(key) { return labelFor(JOB_OPENING_STATUSES, key); }
export function sourceLabel(key) { return labelFor(JOB_OPENING_SOURCES, key); }
export function employmentTypeLabel(key) { return labelFor(EMPLOYMENT_TYPES, key); }
export function educationLevelLabel(key) { return labelFor(EDUCATION_LEVELS, key); }
export function experienceLevelLabel(key) { return labelFor(EXPERIENCE_LEVELS, key); }
export function englishLevelLabel(key) { return labelFor(ENGLISH_LEVEL_REQUIREMENTS, key); }
export function applyMethodLabel(key) { return labelFor(APPLY_METHODS, key); }
export function payTypeLabel(key) { return labelFor(PAY_TYPES, key); }

var STATUS_BADGE_VARIANT = { draft: "neutral", active: "success", filled: "default", expired: "warn", archived: "neutral" };
export function statusBadgeVariant(key) { return STATUS_BADGE_VARIANT[key] || "neutral"; }

// Sources that come from an external feed rather than a direct staff/employer
// entry -- "direct employer opportunities should always appear before
// imported jobs" (spec). No feed integrations exist yet, but the sort rule
// is in place so they slot in correctly whenever one is added.
export function isImportedSource(key) { return key === "public_job_board" || key === "government_source"; }

// Sort key: non-imported first, then by posted date descending within each
// group. Array.prototype.sort is stable, so equal keys keep their relative
// (already posted-date-sorted) order.
export function jobOpeningSortKey(opening) { return isImportedSource(opening.source) ? 1 : 0; }

export function formatPayRange(opening) {
  if (!opening.payMin && !opening.payMax) return "";
  var unit = opening.payType === "salary" ? "/yr" : "/hr";
  if (opening.payMin && opening.payMax && opening.payMin !== opening.payMax) return "$" + opening.payMin + "-$" + opening.payMax + unit;
  return "$" + (opening.payMin || opening.payMax) + unit;
}
