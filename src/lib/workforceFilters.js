// workforceFilters.js -- the Workforce module's filter predicates, lifted out
// of the six list pages so they can be tested directly. Each page owns its
// filter STATE and builds its tile options; this file owns the question
// "does this record survive the current filters", which is the part where a
// wrong answer is a silently wrong number on screen.
//
// Every predicate takes (record, filters, ctx):
//   filters -- the page's filter values, keyed as the page names them. An
//              empty string means "no filter", which is what the "All …"
//              option in every tile carries.
//   ctx     -- the derived lookups a predicate can't compute from one record:
//              today's date, id->something maps, and the search term. Passed
//              in rather than imported so the tests can pin a date instead of
//              depending on when they run.
//
// The predicates are deliberately written as a run of early returns in the
// same order the tiles appear on the page. It is more repetitive than a
// generic matcher would be, and it is the reason each one can be read against
// its page without a translation step.
import { matchBucket } from "./candidateMatching.js";
import { clientDisplayName, clientMatchesSearch } from "./clients.js";
import { employmentStatusLabel } from "./jobProfile.js";
import { addDays } from "./utils.js";

// ---------------------------------------------------------------- helpers

// Does `text` contain the (already lowercased, already trimmed) term? Fields
// are joined with a space so a term never matches across a field boundary by
// accident -- "smith providence" won't match a client named Smith in Newport.
export function haystackMatches(fields, term) {
  if (!term) return true;
  return fields.filter(Boolean).join(" ").toLowerCase().indexOf(term) !== -1;
}

// Inclusive "last N days" cutoff: N=7 on 2026-09-02 means 2026-08-27, so
// today counts as one of the seven.
export function lastNDaysCutoff(today, n) {
  return addDays(today, -(Number(n) - 1));
}

// Whole CALENDAR days from a YYYY-MM-DD start date to `today`. null when
// there is no start date, so a record with none falls out of every tenure
// bucket rather than silently landing in the lowest one.
//
// Counted through Date.UTC rather than by subtracting two local Dates and
// dividing by 86400000. That subtraction is wrong across a daylight-saving
// boundary: the interval is an hour short, Math.floor swallows a whole day,
// and a placement that started 179 calendar days ago reports 178 days of
// tenure. Found by mutation-testing this file's own tests -- the tenure
// buckets are pinned to the 30/60/90/180 check-in schedule, so a day of drift
// at exactly those boundaries is the difference between "due" and "not yet"
// for anyone whose start date sits on the far side of a clock change.
// Date.UTC has no DST, so the difference of two UTC midnights is exact.
export function daysSince(startDate, today) {
  if (!startDate) return null;
  const s = startDate.split("-").map(Number);
  const t = today.split("-").map(Number);
  return Math.round((Date.UTC(t[0], t[1] - 1, t[2]) - Date.UTC(s[0], s[1] - 1, s[2])) / 86400000);
}

// Placements: tenure buckets, boundaries chosen to line up with the
// 30/60/90/180-day check-in schedule rather than being invented separately.
export const TENURE_BUCKETS = [
  { value: "under30", labelKey: "tenureUnder30Label", min: 0, max: 29 },
  { value: "30to89", labelKey: "tenure30to89Label", min: 30, max: 89 },
  { value: "90to179", labelKey: "tenure90to179Label", min: 90, max: 179 },
  { value: "180plus", labelKey: "tenure180PlusLabel", min: 180, max: Infinity }
];

export const WAGE_BANDS = [
  { value: "under15", labelKey: "wageUnder15Label", min: 0, max: 14.999999 },
  { value: "15to20", labelKey: "wage15to20Label", min: 15, max: 19.999999 },
  { value: "20plus", labelKey: "wage20PlusLabel", min: 20, max: Infinity }
];

function bucketFor(list, value) {
  return list.filter(function (b) { return b.value === value; })[0];
}

// The Workforce Dashboard's "Employer Follow-Ups Due" card counts this, and
// the Employers page's followUp:"due" filter has to agree with it exactly --
// a card that links to a list showing a different number is worse than a card
// that links nowhere. Exported so both sides call one function and
// workforceFilters.test.js can assert they can't drift.
export function isFollowUpDue(employer, today) {
  return Boolean(employer.nextFollowUpDate && employer.nextFollowUpDate <= today);
}

// ------------------------------------------------------------ Job Openings

export function matchesJobOpening(o, filters, ctx) {
  const f = filters || {};
  const c = ctx || {};
  if (f.city && o.employerCity !== f.city) return false;
  if (f.industry && (c.employerIndustryById || {})[o.employerId] !== f.industry) return false;
  if (f.employmentType && o.employmentType !== f.employmentType) return false;
  if (f.education && o.education !== f.education) return false;
  if (f.experience && o.experience !== f.experience) return false;
  if (f.english && o.englishLevelRequired !== f.english) return false;
  if (f.transportation === "yes" && !o.transportationRequired) return false;
  if (f.transportation === "no" && o.transportationRequired) return false;
  if (f.status && o.status !== f.status) return false;
  // Title + employer + the free-text fields a "keyword" would sensibly reach.
  return haystackMatches(
    [o.title, o.employerName, o.department, o.description, o.responsibilities, o.requirements, (o.skills || []).join(" ")],
    c.term
  );
}

// ------------------------------------------------------ Candidate Matching

// `entry` is the ranked shape the page builds: { jobClient, score }.
export function matchesCandidate(entry, filters, ctx) {
  const f = filters || {};
  const ctxt = ctx || {};
  const c = entry.jobClient;
  const isReferred = ctxt.isReferred || function () { return false; };
  if (f.match && matchBucket(entry.score).key !== f.match) return false;
  if (f.referral === "referred" && !isReferred(c.id)) return false;
  if (f.referral === "not_referred" && isReferred(c.id)) return false;
  if (f.resume === "yes" && !c.hasResume) return false;
  if (f.resume === "no" && c.hasResume) return false;
  if (f.workAuth && c.workAuthorization !== f.workAuth) return false;
  if (f.status && c.employmentStatus !== f.status) return false;
  if (f.city && (c.city || "").trim() !== f.city) return false;
  if (f.barrier === "__none" && (c.barriers || []).length > 0) return false;
  if (f.barrier && f.barrier !== "__none" && (c.barriers || []).indexOf(f.barrier) === -1) return false;
  if (f.transportation === "yes" && !(c.transportation || "").trim()) return false;
  if (f.transportation === "no" && (c.transportation || "").trim()) return false;
  return haystackMatches(
    [clientDisplayName(c), c.city, employmentStatusLabel(c.employmentStatus), (c.skills || []).join(" ")],
    ctxt.term
  );
}

// --------------------------------------------------------------- Referrals

export function matchesReferral(r, filters, ctx) {
  const f = filters || {};
  const c = ctx || {};
  if (f.stage && r.status !== f.stage) return false;
  if (f.employer && (r.employerName || "").trim() !== f.employer) return false;
  if (f.position && (r.positionTitle || "").trim() !== f.position) return false;
  if (f.developer && (r.assignedJobDeveloperEmail || "").trim() !== f.developer) return false;
  if (f.date) {
    const cutoff = lastNDaysCutoff(c.today, f.date);
    if (!r.referralDate || r.referralDate < cutoff) return false;
  }
  if (f.interview === "yes" && !r.interviewDate) return false;
  if (f.interview === "no" && r.interviewDate) return false;
  return haystackMatches(
    [r.participantName, r.positionTitle, r.employerName, r.assignedJobDeveloperEmail, r.notes],
    c.term
  );
}

// -------------------------------------------------------------- Placements

export function matchesPlacement(p, filters, ctx) {
  const f = filters || {};
  const c = ctx || {};
  if (f.status && p.currentStatus !== f.status) return false;
  if (f.employer && (p.employerName || "").trim() !== f.employer) return false;
  if (f.position && (p.positionTitle || "").trim() !== f.position) return false;
  if (f.supervisor && (p.supervisorName || "").trim() !== f.supervisor) return false;

  if (f.tenure) {
    const bucket = bucketFor(TENURE_BUCKETS, f.tenure);
    const days = daysSince(p.startDate, c.today);
    if (days === null || days < bucket.min || days > bucket.max) return false;
  }
  if (f.wage) {
    const band = bucketFor(WAGE_BANDS, f.wage);
    const wage = Number(p.hourlyWage);
    if (!p.hourlyWage || isNaN(wage) || wage < band.min || wage > band.max) return false;
  }
  if (f.benefits === "yes" && !(p.benefits || "").trim()) return false;
  if (f.benefits === "no" && (p.benefits || "").trim()) return false;

  if (f.checkins) {
    const summary = (c.checkinSummaryFor || function () { return {}; })(p.id);
    if (f.checkins === "overdue" && !summary.anyOverdue) return false;
    if (f.checkins === "all_complete" && !summary.allComplete) return false;
    if (f.checkins === "none_complete" && !summary.noneComplete) return false;
  }

  return haystackMatches([p.participantName, p.employerName, p.positionTitle, p.supervisorName], c.term);
}

// --------------------------------------------------------------- Employers

export function matchesEmployer(e, filters, ctx) {
  const f = filters || {};
  const c = ctx || {};
  if (f.industry && e.industry !== f.industry) return false;
  if (f.city && (e.city || "").trim() !== f.city) return false;
  if (f.stage && e.partnershipStage !== f.stage) return false;
  if (f.developer && (e.assignedJobDeveloperEmail || "").trim() !== f.developer) return false;
  if (f.hiringMethod && e.preferredHiringMethod !== f.hiringMethod) return false;

  const openCount = (c.openPositionsByEmployer || {})[e.id] || 0;
  if (f.openings === "yes" && openCount === 0) return false;
  if (f.openings === "no" && openCount > 0) return false;

  if (f.followUp) {
    const due = e.nextFollowUpDate;
    if (f.followUp === "none" && due) return false;
    // "due" is the dashboard KPI's definition, via the shared predicate.
    if (f.followUp === "due" && !isFollowUpDue(e, c.today)) return false;
    if (f.followUp === "overdue" && (!due || due >= c.today)) return false;
    // "Due soon" is today through a week out -- an overdue follow-up is its
    // own bucket, so it deliberately doesn't also show up here.
    if (f.followUp === "soon" && (!due || due < c.today || due > addDays(c.today, 7))) return false;
  }

  if (f.contact) {
    const last = e.lastMeetingDate;
    const days30Ago = addDays(c.today, -30);
    const days90Ago = addDays(c.today, -90);
    if (f.contact === "never" && last) return false;
    if (f.contact === "30" && (!last || last < days30Ago)) return false;
    if (f.contact === "90" && (!last || last < days90Ago)) return false;
    if (f.contact === "stale" && (!last || last >= days90Ago)) return false;
  }

  return haystackMatches(
    [e.businessName, e.contactName, e.city, e.contactEmail, e.hrContactName, (c.industryLabelByKey || {})[e.industry]],
    c.term
  );
}

// ---------------------------------------------------- Job Developer caseload

export function matchesJobClient(c, filters, ctx) {
  const f = filters || {};
  const x = ctx || {};
  const followUps = x.followUps || {};
  // The caseload keeps using clients.js's shared person search rather than a
  // local haystack, so a name searches the same way here as everywhere else.
  if (!clientMatchesSearch("job", c, x.term)) return false;
  if (f.followUp === "due" && !followUps[c.id]) return false;
  if (f.followUp === "none" && followUps[c.id]) return false;
  if (f.status && c.employmentStatus !== f.status) return false;
  if (f.stage && c.pipelineStage !== f.stage) return false;
  if (f.resume === "yes" && !c.hasResume) return false;
  if (f.resume === "no" && c.hasResume) return false;
  if (f.workAuth && c.workAuthorization !== f.workAuth) return false;
  if (f.city && (c.city || "").trim() !== f.city) return false;
  if (f.barrier === "__none" && (c.barriers || []).length > 0) return false;
  if (f.barrier && f.barrier !== "__none" && (c.barriers || []).indexOf(f.barrier) === -1) return false;
  if (f.intake) {
    const cutoff = lastNDaysCutoff(x.today, f.intake);
    if (!c.intakeDate || c.intakeDate < cutoff) return false;
  }
  return true;
}
