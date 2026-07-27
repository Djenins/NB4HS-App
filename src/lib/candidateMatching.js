// candidateMatching.js -- pure scoring helpers for the Candidate Matching
// page (src/pages/CandidateMatching.jsx, src/components/CandidateMatchCard.jsx).
// Deliberately only scores on fields job_clients actually has (see the scope
// note in the Phase 3 plan): skills overlap, the existing transportation/
// english barrier flags, work authorization, resume-on-file, and employment
// status. No "Program"/"Availability"/"Certifications" or real English-
// proficiency/geocoded-distance data exists on this table, so those spec'd
// fields are intentionally not scored or shown.
var NOT_LOOKING_STATUSES = ["employed", "closed"];
var READY_STATUSES = ["job_ready", "actively_looking"];
var UNAUTHORIZED_STATUSES = ["expired", "not_authorized"];

export function isCandidateEligible(jobClient) {
  if (jobClient.active === false) return false;
  return NOT_LOOKING_STATUSES.indexOf(jobClient.employmentStatus) === -1;
}

function lower(list) { return (list || []).map(function (s) { return s.toLowerCase(); }); }

// Returns the job opening's own skill strings (original casing) that the
// candidate also lists -- used to render "matched" chips against the
// opening's requested skills.
export function matchedSkills(jobClient, jobOpening) {
  var candidateSkills = lower(jobClient.skills);
  return (jobOpening.skills || []).filter(function (s) { return candidateSkills.indexOf(s.toLowerCase()) !== -1; });
}

export function computeMatchScore(jobClient, jobOpening) {
  var score = 0;
  var requiredSkills = jobOpening.skills || [];
  if (requiredSkills.length === 0) {
    score += 20;
  } else {
    var matched = matchedSkills(jobClient, jobOpening).length;
    score += Math.min(40, Math.round((matched / requiredSkills.length) * 40));
  }

  var barriers = jobClient.barriers || [];
  if (!jobOpening.transportationRequired) {
    score += 15;
  } else if ((jobClient.transportation || "").trim() && barriers.indexOf("transportation") === -1) {
    score += 15;
  }

  var englishRequired = jobOpening.englishLevelRequired;
  if (!englishRequired || englishRequired === "none") {
    score += 15;
  } else if (barriers.indexOf("english") === -1) {
    score += 15;
  }

  if (jobClient.workAuthorization && UNAUTHORIZED_STATUSES.indexOf(jobClient.workAuthorization) === -1) score += 15;
  if (jobClient.hasResume) score += 10;
  if (READY_STATUSES.indexOf(jobClient.employmentStatus) !== -1) score += 5;

  return Math.min(100, score);
}

export function matchBucket(score) {
  if (score >= 70) return { key: "strong", labelKey: "matchStrongLabel", tone: "success" };
  if (score >= 45) return { key: "good", labelKey: "matchGoodLabel", tone: "default" };
  return { key: "possible", labelKey: "matchPossibleLabel", tone: "neutral" };
}

// Honest same-city/different-city label -- this app has no geocoded
// addresses, so "distance" is never a real number.
export function proximityLabel(jobClient, employer) {
  var candidateCity = (jobClient.city || "").trim();
  var employerCity = (employer && employer.city || "").trim();
  if (!candidateCity || !employerCity) return "";
  return candidateCity.toLowerCase() === employerCity.toLowerCase() ? "sameCity" : "differentCity";
}
