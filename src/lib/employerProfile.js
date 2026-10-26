// employerProfile.js -- constants and pure helpers for the Employer Directory/
// Profile pages (src/pages/Employers.jsx, src/pages/EmployerProfile.jsx).
// Mirrors jobProfile.js's shape exactly (its own file since none of this is
// shared by the unrelated job-seeker Job Developer module). Partnership stages
// carry ht/fr (partnershipStageLabel takes `lang`); the other lists are
// still English-only.
export var EMPLOYER_PARTNERSHIP_STAGES = [
  { key: "prospect", en: "Prospect", ht: "Prospè", fr: "Prospect" },
  { key: "contacted", en: "Contacted", ht: "Kontakte", fr: "Contacté" },
  { key: "meeting_scheduled", en: "Meeting Scheduled", ht: "Reyinyon Pwograme", fr: "Réunion prévue" },
  { key: "partner", en: "Partner", ht: "Patnè", fr: "Partenaire" },
  { key: "hiring", en: "Hiring", ht: "Ap Anboche", fr: "Recrute" },
  { key: "inactive", en: "Inactive", ht: "Inaktif", fr: "Inactif" }
];

export var PREFERRED_COMMUNICATION_METHODS = [
  { key: "phone", en: "Phone" },
  { key: "email", en: "Email" },
  { key: "text", en: "Text" }
];

export var PREFERRED_HIRING_METHODS = [
  { key: "direct_referral", en: "Direct Referral" },
  { key: "job_fair", en: "Job Fair" },
  { key: "online_application", en: "Online Application" },
  { key: "walk_in", en: "Walk-In" },
  { key: "other", en: "Other" }
];

export var ACTIVITY_TYPES = [
  { key: "call", en: "Phone Call" },
  { key: "meeting", en: "Meeting" },
  { key: "email", en: "Email" },
  { key: "site_visit", en: "Site Visit" },
  { key: "other", en: "Other" }
];

function labelFor(list, key, lang) {
  var found = list.filter(function (i) { return i.key === key; })[0];
  return found ? (found[lang] || found.en) : (key || "");
}
export function partnershipStageLabel(key, lang) { return labelFor(EMPLOYER_PARTNERSHIP_STAGES, key, lang); }
export function preferredCommunicationLabel(key) { return labelFor(PREFERRED_COMMUNICATION_METHODS, key); }
export function preferredHiringMethodLabel(key) { return labelFor(PREFERRED_HIRING_METHODS, key); }
export function activityTypeLabel(key) { return labelFor(ACTIVITY_TYPES, key); }

export function partnershipStageIndex(key) {
  var i = EMPLOYER_PARTNERSHIP_STAGES.findIndex(function (s) { return s.key === key; });
  return i === -1 ? 0 : i;
}

// Logo-placeholder initials for a business name -- first letter of up to the
// first two words (mirrors utils.js's initialsOf(), which assumes a
// firstName/lastName person shape that doesn't fit a business record).
export function businessInitials(name) {
  var words = (name || "").trim().split(/\s+/).filter(Boolean);
  if (!words.length) return "?";
  return (words[0].charAt(0) + (words[1] ? words[1].charAt(0) : "")).toUpperCase();
}

// Badge tint per partnership stage (Badge component only has
// default/accent/success/warn/neutral variants -- see components/ui/badge.jsx).
var STAGE_BADGE_VARIANT = {
  prospect: "neutral", contacted: "default", meeting_scheduled: "warn",
  partner: "success", hiring: "success", inactive: "neutral"
};
export function partnershipStageBadgeVariant(key) { return STAGE_BADGE_VARIANT[key] || "neutral"; }
