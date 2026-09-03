// workforceSorters.js -- the Workforce module's sort orders, lifted out of the
// six list pages so they can be tested. Each page owns its sort STATE and its
// dropdown labels; this file owns what each option actually orders by.
//
// Every sort function returns a NEW array. The pages render from the result
// while the unsorted list stays whatever the filter step produced, so a sort
// can never quietly reorder something else's data.
//
// Two behaviours that look like accidents and are not, both pinned in
// workforceSorters.test.js:
//
//   * Job openings from an imported feed always sort last, whatever sort the
//     user picked. That is a product rule from the module spec ("direct
//     employer opportunities should always appear before imported jobs"), so
//     it is a primary key ahead of every comparator rather than one option
//     among them.
//   * A record with no date sorts LAST under a newest-first order and FIRST
//     under an oldest-first order. That falls out of comparing "" and is the
//     behaviour the module shipped with; it is pinned so a change to it has
//     to be deliberate.
import { clientDisplayName } from "./clients.js";
import { jobOpeningSortKey } from "./jobOpenings.js";
import { pipelineStageIndex } from "./jobProfile.js";
import { stageIndex } from "./referrals.js";
import { sortStudentsList } from "./students.js";

// Descending / ascending by a YYYY-MM-DD string field. String compare is
// correct for this format and needs no Date parsing.
function byDateDesc(field) {
  return function (a, b) { return (b[field] || "").localeCompare(a[field] || ""); };
}
function byDateAsc(field) {
  return function (a, b) { return (a[field] || "").localeCompare(b[field] || ""); };
}
function byTextAsc(field) {
  return function (a, b) { return (a[field] || "").localeCompare(b[field] || ""); };
}

export const JOB_OPENING_SORTERS = {
  recent: byDateDesc("postedDate"),
  oldest: byDateAsc("postedDate"),
  title: byTextAsc("title"),
  employer: byTextAsc("employerName")
};

// The imported-source rule rides ahead of whichever comparator was chosen.
// Array.prototype.sort is stable (ES2019), so records the composed comparator
// calls equal keep the order the filter step produced them in.
export function sortJobOpenings(list, sortKey) {
  const comparator = JOB_OPENING_SORTERS[sortKey];
  return (list || []).slice().sort(function (a, b) {
    return jobOpeningSortKey(a) - jobOpeningSortKey(b) || comparator(a, b);
  });
}

// Candidate entries are the ranked { jobClient, score } shape.
export const CANDIDATE_SORTERS = {
  match: function (a, b) { return b.score - a.score; },
  // NOTE: clientDisplayName is "First Last", so this is a FIRST-name sort --
  // unlike the Job Developer caseload below, which sorts by last name through
  // sortStudentsList. Both are pinned; see the test for the discrepancy.
  name: function (a, b) { return clientDisplayName(a.jobClient).localeCompare(clientDisplayName(b.jobClient)); },
  newest: function (a, b) { return (b.jobClient.intakeDate || "").localeCompare(a.jobClient.intakeDate || ""); },
  oldest: function (a, b) { return (a.jobClient.intakeDate || "").localeCompare(b.jobClient.intakeDate || ""); }
};
export function sortCandidates(list, sortKey) {
  return (list || []).slice().sort(CANDIDATE_SORTERS[sortKey]);
}

export const REFERRAL_SORTERS = {
  newest: byDateDesc("referralDate"),
  oldest: byDateAsc("referralDate"),
  // Pipeline order, not alphabetical. stageIndex maps an unrecognised status
  // to 0, so an unknown stage sorts with the first stage rather than throwing.
  stage: function (a, b) { return stageIndex(a.status) - stageIndex(b.status); },
  participant: byTextAsc("participantName"),
  employer: byTextAsc("employerName")
};
export function sortReferrals(list, sortKey) {
  return (list || []).slice().sort(REFERRAL_SORTERS[sortKey]);
}

export const PLACEMENT_SORTERS = {
  newest: byDateDesc("startDate"),
  oldest: byDateAsc("startDate"),
  participant: byTextAsc("participantName"),
  employer: byTextAsc("employerName"),
  // Highest first. A missing or unparseable wage becomes 0 and lands at the
  // bottom, which is where "not recorded" belongs in a highest-first list.
  wage: function (a, b) { return (Number(b.hourlyWage) || 0) - (Number(a.hourlyWage) || 0); }
};
export function sortPlacements(list, sortKey) {
  return (list || []).slice().sort(PLACEMENT_SORTERS[sortKey]);
}

export const EMPLOYER_SORTERS = {
  name_az: byTextAsc("businessName"),
  name_za: function (a, b) { return (b.businessName || "").localeCompare(a.businessName || ""); },
  newest_partner: byDateDesc("partnerSince"),
  last_contact: byDateDesc("lastMeetingDate")
};

// "Most open positions" isn't a column, so it sorts off the count map the
// page already built rather than off a record field.
export function sortEmployers(list, sortKey, openPositionsByEmployer) {
  const counts = openPositionsByEmployer || {};
  const comparator = sortKey === "open_positions"
    ? function (a, b) { return (counts[b.id] || 0) - (counts[a.id] || 0); }
    : EMPLOYER_SORTERS[sortKey];
  return (list || []).slice().sort(comparator);
}

export const JOB_CLIENT_SORTERS = {
  newest_intake: byDateDesc("intakeDate"),
  oldest_intake: byDateAsc("intakeDate"),
  stage: function (a, b) { return pipelineStageIndex(a.pipelineStage) - pipelineStageIndex(b.pipelineStage); }
};

// Name sorting routes through sortStudentsList -- what this page always used
// and how the rest of the app orders people, which is by LAST name
// (studentDisplayName is "Last, First"). Z-A is that same list reversed
// rather than a second comparator that might collate differently.
export function sortJobClients(list, sortKey) {
  if (sortKey === "name_az" || sortKey === "name_za") {
    const sorted = sortStudentsList((list || []).map(function (c) {
      return { firstName: c.firstName, lastName: c.lastName, __ref: c };
    })).map(function (w) { return w.__ref; });
    return sortKey === "name_za" ? sorted.reverse() : sorted;
  }
  return (list || []).slice().sort(JOB_CLIENT_SORTERS[sortKey]);
}
