// referrals.js -- constants and pure helpers for the Referrals kanban
// (src/pages/Referrals.jsx, src/components/ReferralCard.jsx,
// src/components/ReferralFormModal.jsx). Mirrors employerProfile.js's shape.
export var REFERRAL_STAGES = [
  { key: "ready", en: "Ready", ht: "Pare", fr: "Prêt" },
  { key: "interested", en: "Interested", ht: "Enterese", fr: "Intéressé" },
  { key: "referred", en: "Referred", ht: "Refere", fr: "Orienté" },
  { key: "applied", en: "Applied", ht: "Aplike", fr: "Candidature envoyée" },
  { key: "interview", en: "Interview", ht: "Entèvyou", fr: "Entretien" },
  { key: "offer", en: "Offer", ht: "Òf", fr: "Offre" },
  { key: "hired", en: "Hired", ht: "Anboche", fr: "Embauché" },
  { key: "not_selected", en: "Not Selected", ht: "Pa Chwazi", fr: "Non retenu" }
];

function labelFor(list, key, lang) {
  var found = list.filter(function (i) { return i.key === key; })[0];
  return found ? (found[lang] || found.en) : (key || "");
}
export function stageLabel(key, lang) { return labelFor(REFERRAL_STAGES, key, lang); }
export function stageIndex(key) {
  var i = REFERRAL_STAGES.findIndex(function (s) { return s.key === key; });
  return i === -1 ? 0 : i;
}

var STAGE_BADGE_VARIANT = {
  ready: "neutral", interested: "default", referred: "default", applied: "warn",
  interview: "warn", offer: "success", hired: "success", not_selected: "accent"
};
export function stageBadgeVariant(key) { return STAGE_BADGE_VARIANT[key] || "neutral"; }

// "Interviewing or further along" -- used by JobOpenings.jsx/EmployerProfile.jsx
// to compute an "Interviews" count from raw referral stages.
export function hasReachedInterview(status) {
  return ["interview", "offer", "hired"].indexOf(status) !== -1;
}
