// workforceMetrics.js -- the aggregations behind the Workforce module's KPI
// cards, pipeline tiles, activity feed and report breakdowns, lifted out of
// WorkforceDashboard.jsx and WorkforceReports.jsx so they can be tested.
//
// These are the numbers staff read as fact and quote to funders, so each
// one's definition is written down next to it rather than left implicit in a
// chain of .filter() calls inside a component. Where a definition is an
// approximation the data can't improve on, that is said out loud -- see
// hireItems below.
//
// Like workforceFilters.js, anything date-dependent takes `today` as an
// argument instead of reading the clock, so the tests pin a date rather than
// passing only on the day they were written.
import { isFollowUpDue } from "./workforceFilters.js";
import { isCandidateEligible } from "./candidateMatching.js";
import { inRange } from "./reports_data.js";

// ------------------------------------------------- dashboard KPI definitions

// Employers not explicitly deactivated. `active` is nullable in the schema
// and a null means "never set", which is an active employer -- so this tests
// for an explicit false rather than for truthiness.
export function countActiveEmployers(employers) {
  return (employers || []).filter(function (e) { return e.active !== false; }).length;
}

export function countActiveJobOpenings(jobOpenings) {
  return (jobOpenings || []).filter(function (o) { return o.status === "active"; }).length;
}

// Job seekers who could be referred and haven't been referred to anything
// yet. "Could be referred" is candidateMatching.js's own eligibility rule, so
// this card and the Candidate Matching page agree on who counts.
export function countCandidatesAwaitingReferral(jobClients, referrals) {
  const referredIds = new Set((referrals || []).map(function (r) { return r.jobClientId; }));
  return (jobClients || []).filter(function (c) {
    return isCandidateEligible(c) && !referredIds.has(c.id);
  }).length;
}

// Referrals sitting AT the interview stage right now -- not "have ever
// interviewed", which would also sweep up offer and hired.
export function countInterviewsScheduled(referrals) {
  return (referrals || []).filter(function (r) { return r.status === "interview"; }).length;
}

// Placements whose start date falls in the current calendar month. Compared
// as a YYYY-MM prefix, so it is a calendar month rather than a rolling 30
// days -- which is what "this month" means to someone reporting on it.
export function countPlacementsThisMonth(placements, today) {
  const prefix = today.slice(0, 7);
  return (placements || []).filter(function (p) { return (p.startDate || "").slice(0, 7) === prefix; }).length;
}

// Employers whose next follow-up is due today or has passed. Shares one
// predicate with the Employers page's followUp:"due" filter so the card and
// the list it links to can never describe different sets.
export function countFollowUpsDue(employers, today) {
  return (employers || []).filter(function (e) { return isFollowUpDue(e, today); }).length;
}

// One count per partnership stage, in the module's canonical stage order.
// Every stage appears even at zero -- a pipeline with a gap in it is
// information, and dropping the empty stages would hide it.
export function employerStageCounts(employers, stages) {
  return (stages || []).map(function (s) {
    return Object.assign({}, s, {
      count: (employers || []).filter(function (e) { return e.partnershipStage === s.key; }).length
    });
  });
}

// Most recently posted openings first. Openings with no posted date sort last
// rather than first, which a plain string compare would do to "".
export function recentOpenings(jobOpenings, limit) {
  return (jobOpenings || []).slice()
    .sort(function (a, b) { return (b.postedDate || "").localeCompare(a.postedDate || ""); })
    .slice(0, limit);
}

export function referralCountForOpening(referrals, openingId) {
  return (referrals || []).filter(function (r) { return r.jobOpeningId === openingId; }).length;
}

// Merge the already-built feed entries from several sources into one
// newest-first list. Entries without a date are dropped rather than sorted to
// one end, because an undated event can't be placed on a timeline honestly.
export function mergeActivityFeed(entries, limit) {
  return (entries || [])
    .filter(function (item) { return Boolean(item && item.date); })
    .sort(function (a, b) { return b.date.localeCompare(a.date); })
    .slice(0, limit);
}

// ----------------------------------------------- report item-set extraction
//
// Each report chart counts dated events. These turn a table into the
// { date } shape the range/trend primitives take, and are where the choice of
// WHICH date each event is measured by lives.

export function jobsPostedItems(jobOpenings) {
  return (jobOpenings || []).map(function (o) { return { date: o.postedDate }; });
}
export function placementItems(placements) {
  return (placements || []).map(function (p) { return { date: p.startDate }; });
}
export function employersAddedItems(employers) {
  return (employers || []).map(function (e) { return { date: (e.createdAt || "").slice(0, 10) }; });
}
export function referralItems(referrals) {
  return (referrals || []).map(function (r) { return { date: r.referralDate }; });
}
export function interviewItems(referrals) {
  return (referrals || []).filter(function (r) { return r.interviewDate; })
    .map(function (r) { return { date: r.interviewDate }; });
}
// Hires. There is no stage-change log, so "when it became Hired" is only
// knowable as "the last time this referral row was touched" -- a disclosed
// approximation, kept deliberately distinct from the Placements series
// (actual tracked placement records, which can lag behind a hire).
export function hireItems(referrals) {
  return (referrals || []).filter(function (r) { return r.status === "hired"; })
    .map(function (r) { return { date: (r.updatedAt || "").slice(0, 10) }; });
}

export function countInRange(items, range) {
  return (items || []).filter(function (i) { return i.date && inRange(i, range.from, range.to); }).length;
}

// --------------------------------------------------------- report breakdowns

// Group by a key, drop the blanks, biggest first, top N. Ties keep the order
// the records arrived in, which for equal counts is as good as any and at
// least stable.
export function topCounts(records, keyFn, limit) {
  const counts = {};
  (records || []).forEach(function (r) {
    const key = keyFn(r);
    if (!key) return;
    counts[key] = (counts[key] || 0) + 1;
  });
  return Object.keys(counts)
    .map(function (label) { return { label: label, count: counts[label] }; })
    .sort(function (a, b) { return b.count - a.count; })
    .slice(0, limit);
}

// The retention doughnut's three numbers, from one pass so the parts always
// sum to the whole. Same eligibility rule computeRetentionRate uses: a
// placement is only judged once it is at least 90 days old.
export function retentionSplit(placements, cutoff) {
  const eligible = (placements || []).filter(function (p) { return p.startDate && p.startDate <= cutoff; });
  const retained = eligible.filter(function (p) { return p.currentStatus === "active"; }).length;
  return { eligible: eligible.length, retained: retained, notRetained: eligible.length - retained };
}
