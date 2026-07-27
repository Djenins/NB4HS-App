// referrals.js -- constants and pure helpers for the Referrals kanban
// (src/pages/Referrals.jsx, src/components/ReferralCard.jsx,
// src/components/ReferralFormModal.jsx). Mirrors employerProfile.js's shape.
export var REFERRAL_STAGES = [
  { key: "ready", en: "Ready" },
  { key: "interested", en: "Interested" },
  { key: "referred", en: "Referred" },
  { key: "applied", en: "Applied" },
  { key: "interview", en: "Interview" },
  { key: "offer", en: "Offer" },
  { key: "hired", en: "Hired" },
  { key: "not_selected", en: "Not Selected" }
];

function labelFor(list, key) {
  var found = list.filter(function (i) { return i.key === key; })[0];
  return found ? found.en : (key || "");
}
export function stageLabel(key) { return labelFor(REFERRAL_STAGES, key); }
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
