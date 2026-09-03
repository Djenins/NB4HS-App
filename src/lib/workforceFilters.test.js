// workforceFilters.test.js -- the Workforce module's filter predicates.
//
// These cases are not invented for the test: they are the fixtures and
// expected results that were worked out by hand and checked in a browser
// harness while each of the module's six list pages was built, written down
// here so a future edit can't quietly change an answer. Every predicate takes
// `today` through ctx rather than reading the clock, so the date-window cases
// below are pinned rather than passing only on the day they were written.
import { describe, expect, it } from "vitest";
import {
  daysSince, haystackMatches, isFollowUpDue, lastNDaysCutoff,
  matchesCandidate, matchesEmployer, matchesJobClient, matchesJobOpening,
  matchesPlacement, matchesReferral
} from "./workforceFilters.js";

const TODAY = "2026-09-02";

// Applies a predicate across a list and returns the surviving names, which
// reads better in a failure message than a count does.
function survivors(list, predicate, nameOf) {
  return list.filter(predicate).map(nameOf);
}

// ------------------------------------------------------------------ helpers

describe("haystackMatches", () => {
  it("matches case-insensitively on any field", () => {
    expect(haystackMatches(["Hope Healthcare", "Providence"], "hope")).toBe(true);
    expect(haystackMatches(["Hope Healthcare", "Providence"], "PROVIDENCE".toLowerCase())).toBe(true);
  });
  it("passes everything when there is no term", () => {
    expect(haystackMatches(["anything"], "")).toBe(true);
    expect(haystackMatches([], undefined)).toBe(true);
  });
  it("skips null and undefined fields instead of matching the string 'null'", () => {
    expect(haystackMatches([null, undefined, "CNA"], "null")).toBe(false);
    expect(haystackMatches([null, "CNA"], "cna")).toBe(true);
  });
  it("does not match across a field boundary", () => {
    // "Smith" in Newport must not answer a search for "smith providence"
    expect(haystackMatches(["Smith", "Newport"], "smith newport")).toBe(true);
    expect(haystackMatches(["Smith", "Newport"], "smithnewport")).toBe(false);
  });
});

describe("lastNDaysCutoff", () => {
  it("is inclusive of today -- 7 days back from Sep 2 starts Aug 27", () => {
    expect(lastNDaysCutoff(TODAY, 7)).toBe("2026-08-27");
  });
  it("handles 30/90/180 windows", () => {
    expect(lastNDaysCutoff(TODAY, 30)).toBe("2026-08-04");
    expect(lastNDaysCutoff(TODAY, 90)).toBe("2026-06-05");
    expect(lastNDaysCutoff(TODAY, 180)).toBe("2026-03-07");
  });
  it("accepts the string values the filter tiles actually carry", () => {
    expect(lastNDaysCutoff(TODAY, "7")).toBe("2026-08-27");
  });
});

describe("daysSince", () => {
  it("counts whole days to today", () => {
    expect(daysSince("2026-08-20", TODAY)).toBe(13);
    expect(daysSince(TODAY, TODAY)).toBe(0);
  });
  it("counts calendar days across a daylight-saving boundary", () => {
    // Regression: subtracting two local Dates and dividing by 86400000 loses
    // an hour across US spring-forward (Mar 8, 2026), Math.floor swallows a
    // day, and this reported 178. The tenure buckets sit on the 30/60/90/180
    // check-in boundaries, so a day of drift there is a wrong answer.
    expect(daysSince("2026-03-07", TODAY)).toBe(179);
    expect(daysSince("2026-03-06", TODAY)).toBe(180);
    // and across fall-back the other way
    expect(daysSince("2025-11-01", "2025-11-30")).toBe(29);
  });
  it("returns null with no start date, so such a record joins no bucket", () => {
    expect(daysSince("", TODAY)).toBeNull();
    expect(daysSince(undefined, TODAY)).toBeNull();
  });
});

// ------------------------------------------------------------- Job Openings

describe("matchesJobOpening", () => {
  const OPENINGS = [
    {
      id: "o1", employerId: "e1", employerName: "Hope Healthcare", employerCity: "Providence", title: "CNA",
      employmentType: "full_time", education: "high_school", experience: "entry", englishLevelRequired: "basic",
      transportationRequired: true, status: "active", skills: ["patient care"], description: "Bedside care."
    },
    {
      id: "o2", employerId: "e2", employerName: "Bay State Logistics", employerCity: "Pawtucket", title: "Warehouse Associate",
      employmentType: "part_time", education: "none", experience: "none", englishLevelRequired: "none",
      transportationRequired: false, status: "draft", skills: ["forklift"]
    },
    {
      id: "o3", employerId: "e3", employerName: "Ocean Grove Hotel", employerCity: "Newport", title: "Housekeeping Attendant",
      employmentType: "seasonal", education: "none", experience: "entry", englishLevelRequired: "basic",
      transportationRequired: false, status: "filled", skills: []
    }
  ];
  const CTX = { employerIndustryById: { e1: "healthcare", e2: "manufacturing", e3: "hospitality" } };
  const titles = (filters, ctx) => survivors(OPENINGS, (o) => matchesJobOpening(o, filters, ctx || CTX), (o) => o.title);

  it("passes everything with no filters", () => {
    expect(titles({})).toHaveLength(3);
    expect(titles(undefined)).toHaveLength(3);
  });
  it("treats an empty string as no filter", () => {
    expect(titles({ status: "", city: "", industry: "" })).toHaveLength(3);
  });
  it("filters by city, industry, employment type, education, experience and english", () => {
    expect(titles({ city: "Providence" })).toEqual(["CNA"]);
    expect(titles({ industry: "manufacturing" })).toEqual(["Warehouse Associate"]);
    expect(titles({ employmentType: "seasonal" })).toEqual(["Housekeeping Attendant"]);
    expect(titles({ education: "high_school" })).toEqual(["CNA"]);
    expect(titles({ experience: "entry" })).toEqual(["CNA", "Housekeeping Attendant"]);
    expect(titles({ english: "none" })).toEqual(["Warehouse Associate"]);
  });
  it("filters by transportation both ways", () => {
    expect(titles({ transportation: "yes" })).toEqual(["CNA"]);
    expect(titles({ transportation: "no" })).toEqual(["Warehouse Associate", "Housekeeping Attendant"]);
  });
  it("filters by status", () => {
    expect(titles({ status: "active" })).toEqual(["CNA"]);
    expect(titles({ status: "archived" })).toEqual([]);
  });
  it("searches title, employer, description and skills", () => {
    expect(titles({}, { ...CTX, term: "cna" })).toEqual(["CNA"]);
    expect(titles({}, { ...CTX, term: "bay state" })).toEqual(["Warehouse Associate"]);
    expect(titles({}, { ...CTX, term: "bedside" })).toEqual(["CNA"]);
    expect(titles({}, { ...CTX, term: "forklift" })).toEqual(["Warehouse Associate"]);
  });
  it("combines filters with AND, not OR", () => {
    expect(titles({ city: "Providence", status: "draft" })).toEqual([]);
    expect(titles({ city: "Providence", status: "active" })).toEqual(["CNA"]);
  });
});

// ------------------------------------------------------- Candidate Matching

describe("matchesCandidate", () => {
  // Scores chosen to land one in each matchBucket band: >=70 strong,
  // >=45 good, below that possible.
  const ENTRIES = [
    { score: 100, jobClient: { id: "c1", firstName: "Marie", lastName: "Joseph", city: "Providence", hasResume: true, employmentStatus: "job_ready", workAuthorization: "us_citizen", transportation: "Own car", barriers: [], skills: ["patient care"] } },
    { score: 58, jobClient: { id: "c2", firstName: "Jean", lastName: "Baptiste", city: "Pawtucket", hasResume: true, employmentStatus: "actively_looking", workAuthorization: "permanent_resident", transportation: "", barriers: ["transportation"], skills: [] } },
    { score: 30, jobClient: { id: "c3", firstName: "Rose", lastName: "Pierre", city: "Central Falls", hasResume: false, employmentStatus: "resume_needed", workAuthorization: "tps", transportation: "Bus pass", barriers: ["english", "no_resume"], skills: [] } }
  ];
  const REFERRED = new Set(["c2"]);
  const CTX = { isReferred: (id) => REFERRED.has(id) };
  const names = (filters, ctx) => survivors(ENTRIES, (e) => matchesCandidate(e, filters, ctx || CTX), (e) => e.jobClient.firstName);

  it("filters by match-quality bucket", () => {
    expect(names({ match: "strong" })).toEqual(["Marie"]);
    expect(names({ match: "good" })).toEqual(["Jean"]);
    expect(names({ match: "possible" })).toEqual(["Rose"]);
  });
  it("filters by referral status using the injected lookup", () => {
    expect(names({ referral: "referred" })).toEqual(["Jean"]);
    expect(names({ referral: "not_referred" })).toEqual(["Marie", "Rose"]);
  });
  it("filters by resume, work authorization, employment status and city", () => {
    expect(names({ resume: "yes" })).toEqual(["Marie", "Jean"]);
    expect(names({ resume: "no" })).toEqual(["Rose"]);
    expect(names({ workAuth: "tps" })).toEqual(["Rose"]);
    expect(names({ status: "job_ready" })).toEqual(["Marie"]);
    expect(names({ city: "Central Falls" })).toEqual(["Rose"]);
  });
  it("separates 'no barriers reported' from a specific barrier", () => {
    expect(names({ barrier: "__none" })).toEqual(["Marie"]);
    expect(names({ barrier: "english" })).toEqual(["Rose"]);
    expect(names({ barrier: "transportation" })).toEqual(["Jean"]);
  });
  it("treats a blank transportation note as no transportation", () => {
    expect(names({ transportation: "yes" })).toEqual(["Marie", "Rose"]);
    expect(names({ transportation: "no" })).toEqual(["Jean"]);
  });
  it("searches name, city and skills", () => {
    expect(names({}, { ...CTX, term: "pierre" })).toEqual(["Rose"]);
    expect(names({}, { ...CTX, term: "pawtucket" })).toEqual(["Jean"]);
    expect(names({}, { ...CTX, term: "patient care" })).toEqual(["Marie"]);
  });
});

// ----------------------------------------------------------------- Referrals

describe("matchesReferral", () => {
  const REFERRALS = [
    { id: "1", participantName: "Marie Joseph", positionTitle: "CNA", employerName: "Hope Healthcare", status: "interview", referralDate: "2026-08-30", interviewDate: "2026-09-08", assignedJobDeveloperEmail: "dev1@nb4hs.org", notes: "Strong clinical background." },
    { id: "2", participantName: "Jean Baptiste", positionTitle: "Warehouse Associate", employerName: "Bay State Logistics", status: "referred", referralDate: "2026-08-27", interviewDate: "", assignedJobDeveloperEmail: "dev2@nb4hs.org", notes: "" },
    { id: "3", participantName: "Lucie Bernard", positionTitle: "Warehouse Associate", employerName: "Bay State Logistics", status: "offer", referralDate: "2026-08-25", interviewDate: "2026-08-31", assignedJobDeveloperEmail: "dev1@nb4hs.org", notes: "" }
  ];
  const CTX = { today: TODAY };
  const names = (filters, ctx) => survivors(REFERRALS, (r) => matchesReferral(r, filters, ctx || CTX), (r) => r.participantName);

  it("filters by stage, employer, position and job developer", () => {
    expect(names({ stage: "interview" })).toEqual(["Marie Joseph"]);
    expect(names({ employer: "Bay State Logistics" })).toEqual(["Jean Baptiste", "Lucie Bernard"]);
    expect(names({ position: "CNA" })).toEqual(["Marie Joseph"]);
    expect(names({ developer: "dev1@nb4hs.org" })).toEqual(["Marie Joseph", "Lucie Bernard"]);
  });
  it("applies the last-7-days window inclusively at its edge", () => {
    // cutoff is 2026-08-27: Jean's referral falls exactly on it and stays,
    // Lucie's is two days earlier and drops.
    expect(names({ date: "7" })).toEqual(["Marie Joseph", "Jean Baptiste"]);
    expect(names({ date: "30" })).toHaveLength(3);
  });
  it("filters by whether an interview is scheduled", () => {
    expect(names({ interview: "yes" })).toEqual(["Marie Joseph", "Lucie Bernard"]);
    expect(names({ interview: "no" })).toEqual(["Jean Baptiste"]);
  });
  it("searches participant, employer, developer email and notes", () => {
    expect(names({}, { ...CTX, term: "clinical" })).toEqual(["Marie Joseph"]);
    expect(names({}, { ...CTX, term: "dev2" })).toEqual(["Jean Baptiste"]);
    expect(names({}, { ...CTX, term: "bay state" })).toEqual(["Jean Baptiste", "Lucie Bernard"]);
  });
});

// ---------------------------------------------------------------- Placements

describe("matchesPlacement", () => {
  const PLACEMENTS = [
    { id: "p1", participantName: "Marie Joseph", employerName: "Hope Healthcare", positionTitle: "CNA", startDate: "2026-08-20", hourlyWage: 21, supervisorName: "Ana Reyes", currentStatus: "active", benefits: "Health, dental" },      // 13 days
    { id: "p2", participantName: "Jean Baptiste", employerName: "Bay State Logistics", positionTitle: "Warehouse", startDate: "2026-07-10", hourlyWage: 17.5, supervisorName: "Tom Fields", currentStatus: "active", benefits: "" },      // 54 days
    { id: "p3", participantName: "Daniel Louis", employerName: "Bay State Logistics", positionTitle: "Warehouse", startDate: "2026-05-01", hourlyWage: 14.25, supervisorName: "Tom Fields", currentStatus: "active", benefits: "" },      // 124 days
    { id: "p4", participantName: "Rose Pierre", employerName: "Hope Healthcare", positionTitle: "Receptionist", startDate: "2026-01-15", hourlyWage: 19, supervisorName: "Ana Reyes", currentStatus: "ended", benefits: "Health" }        // 230 days
  ];
  const SUMMARIES = {
    p1: { anyOverdue: false, allComplete: false, noneComplete: true },
    p2: { anyOverdue: false, allComplete: false, noneComplete: false },
    p3: { anyOverdue: true, allComplete: false, noneComplete: false },
    p4: { anyOverdue: false, allComplete: true, noneComplete: false }
  };
  const CTX = { today: TODAY, checkinSummaryFor: (id) => SUMMARIES[id] };
  const names = (filters, ctx) => survivors(PLACEMENTS, (p) => matchesPlacement(p, filters, ctx || CTX), (p) => p.participantName);

  it("filters by status, employer, position and supervisor", () => {
    expect(names({ status: "ended" })).toEqual(["Rose Pierre"]);
    expect(names({ employer: "Hope Healthcare" })).toEqual(["Marie Joseph", "Rose Pierre"]);
    expect(names({ position: "Warehouse" })).toEqual(["Jean Baptiste", "Daniel Louis"]);
    expect(names({ supervisor: "Tom Fields" })).toEqual(["Jean Baptiste", "Daniel Louis"]);
  });
  it("puts each placement in exactly one tenure bucket", () => {
    expect(names({ tenure: "under30" })).toEqual(["Marie Joseph"]);
    expect(names({ tenure: "30to89" })).toEqual(["Jean Baptiste"]);
    expect(names({ tenure: "90to179" })).toEqual(["Daniel Louis"]);
    expect(names({ tenure: "180plus" })).toEqual(["Rose Pierre"]);
  });
  it("puts the exact tenure boundaries on the right side of each bucket", () => {
    // Found by mutation-testing the suite: without these, widening a bucket's
    // upper bound by a day changed nothing, because every fixture above sits
    // comfortably inside its band. Days are counted back from TODAY.
    const at = (days, name) => ({ id: name, participantName: name, startDate: lastNDaysCutoff(TODAY, days + 1) });
    const EDGES = [at(29, "d29"), at(30, "d30"), at(89, "d89"), at(90, "d90"), at(179, "d179"), at(180, "d180")];
    const inBucket = (bucket) => survivors(EDGES, (p) => matchesPlacement(p, { tenure: bucket }, CTX), (p) => p.participantName);
    expect(inBucket("under30")).toEqual(["d29"]);
    expect(inBucket("30to89")).toEqual(["d30", "d89"]);
    expect(inBucket("90to179")).toEqual(["d90", "d179"]);
    expect(inBucket("180plus")).toEqual(["d180"]);
  });
  it("drops a placement with no start date from every tenure bucket", () => {
    const undated = [{ id: "x", participantName: "No Date", startDate: "", hourlyWage: 20 }];
    ["under30", "30to89", "90to179", "180plus"].forEach((bucket) => {
      expect(undated.filter((p) => matchesPlacement(p, { tenure: bucket }, CTX))).toHaveLength(0);
    });
  });
  it("bands wages at the boundaries", () => {
    expect(names({ wage: "under15" })).toEqual(["Daniel Louis"]);
    expect(names({ wage: "15to20" })).toEqual(["Jean Baptiste", "Rose Pierre"]);
    expect(names({ wage: "20plus" })).toEqual(["Marie Joseph"]);
    // exactly $15 is the bottom of the middle band, exactly $20 the bottom of the top
    const edges = [{ id: "a", participantName: "At15", hourlyWage: 15 }, { id: "b", participantName: "At20", hourlyWage: 20 }];
    expect(survivors(edges, (p) => matchesPlacement(p, { wage: "15to20" }, CTX), (p) => p.participantName)).toEqual(["At15"]);
    expect(survivors(edges, (p) => matchesPlacement(p, { wage: "20plus" }, CTX), (p) => p.participantName)).toEqual(["At20"]);
  });
  it("excludes a placement with no wage recorded from every wage band", () => {
    const noWage = [{ id: "x", participantName: "No Wage", hourlyWage: null }];
    ["under15", "15to20", "20plus"].forEach((band) => {
      expect(noWage.filter((p) => matchesPlacement(p, { wage: band }, CTX))).toHaveLength(0);
    });
  });
  it("filters by whether benefits are recorded", () => {
    expect(names({ benefits: "yes" })).toEqual(["Marie Joseph", "Rose Pierre"]);
    expect(names({ benefits: "no" })).toEqual(["Jean Baptiste", "Daniel Louis"]);
  });
  it("separates the three check-in states", () => {
    expect(names({ checkins: "overdue" })).toEqual(["Daniel Louis"]);
    expect(names({ checkins: "all_complete" })).toEqual(["Rose Pierre"]);
    expect(names({ checkins: "none_complete" })).toEqual(["Marie Joseph"]);
  });
  it("searches participant, employer, position and supervisor", () => {
    expect(names({}, { ...CTX, term: "reyes" })).toEqual(["Marie Joseph", "Rose Pierre"]);
    expect(names({}, { ...CTX, term: "receptionist" })).toEqual(["Rose Pierre"]);
  });
});

// ----------------------------------------------------------------- Employers

describe("matchesEmployer", () => {
  const EMPLOYERS = [
    { id: "e1", businessName: "Hope Healthcare", industry: "healthcare", city: "Providence", partnershipStage: "hiring", assignedJobDeveloperEmail: "dev1@nb4hs.org", preferredHiringMethod: "direct_referral", nextFollowUpDate: "2026-08-25", lastMeetingDate: "2026-08-28", contactName: "Pat", contactEmail: "e1@x.org" },
    { id: "e2", businessName: "Bay State Logistics", industry: "manufacturing", city: "Pawtucket", partnershipStage: "partner", assignedJobDeveloperEmail: "dev2@nb4hs.org", preferredHiringMethod: "job_fair", nextFollowUpDate: "2026-09-05", lastMeetingDate: "2026-07-20", contactName: "Sam", contactEmail: "e2@x.org" },
    { id: "e3", businessName: "Ocean Grove Hotel", industry: "hospitality", city: "Newport", partnershipStage: "prospect", assignedJobDeveloperEmail: "dev1@nb4hs.org", preferredHiringMethod: "walk_in", nextFollowUpDate: "", lastMeetingDate: "2026-01-10", contactName: "", contactEmail: "e3@x.org" },
    { id: "e4", businessName: "Anchor Retail Group", industry: "retail", city: "Providence", partnershipStage: "contacted", assignedJobDeveloperEmail: "", preferredHiringMethod: "online_application", nextFollowUpDate: "2026-12-01", lastMeetingDate: "", contactName: "", contactEmail: "e4@x.org" },
    { id: "e5", businessName: "Zephyr Foods", industry: "food_service", city: "Central Falls", partnershipStage: "inactive", assignedJobDeveloperEmail: "dev2@nb4hs.org", preferredHiringMethod: "direct_referral", nextFollowUpDate: "", lastMeetingDate: "2026-08-15", contactName: "", contactEmail: "e5@x.org" }
  ];
  const CTX = {
    today: TODAY,
    openPositionsByEmployer: { e1: 2, e2: 1 },
    industryLabelByKey: { healthcare: "Healthcare", manufacturing: "Manufacturing", hospitality: "Hospitality", retail: "Retail", food_service: "Food Service" }
  };
  const names = (filters, ctx) => survivors(EMPLOYERS, (e) => matchesEmployer(e, filters, ctx || CTX), (e) => e.businessName);

  it("filters by industry, city, stage, developer and hiring method", () => {
    expect(names({ industry: "healthcare" })).toEqual(["Hope Healthcare"]);
    expect(names({ city: "Providence" })).toEqual(["Hope Healthcare", "Anchor Retail Group"]);
    expect(names({ stage: "hiring" })).toEqual(["Hope Healthcare"]);
    expect(names({ developer: "dev1@nb4hs.org" })).toEqual(["Hope Healthcare", "Ocean Grove Hotel"]);
    expect(names({ hiringMethod: "direct_referral" })).toEqual(["Hope Healthcare", "Zephyr Foods"]);
  });
  it("filters on the counted open positions, not a field", () => {
    expect(names({ openings: "yes" })).toEqual(["Hope Healthcare", "Bay State Logistics"]);
    expect(names({ openings: "no" })).toEqual(["Ocean Grove Hotel", "Anchor Retail Group", "Zephyr Foods"]);
  });
  it("keeps the three follow-up buckets distinct", () => {
    // This is the distinction the dashboard's drill-through depends on:
    // "overdue" is strictly past, "due" includes today, "soon" starts today.
    expect(names({ followUp: "overdue" })).toEqual(["Hope Healthcare"]);
    expect(names({ followUp: "due" })).toEqual(["Hope Healthcare"]);
    expect(names({ followUp: "soon" })).toEqual(["Bay State Logistics"]);
    expect(names({ followUp: "none" })).toEqual(["Ocean Grove Hotel", "Zephyr Foods"]);
  });
  it("counts a follow-up dated today as due, not as overdue", () => {
    const dueToday = [{ id: "x", businessName: "Due Today", nextFollowUpDate: TODAY }];
    expect(survivors(dueToday, (e) => matchesEmployer(e, { followUp: "due" }, CTX), (e) => e.businessName)).toEqual(["Due Today"]);
    expect(survivors(dueToday, (e) => matchesEmployer(e, { followUp: "overdue" }, CTX), (e) => e.businessName)).toEqual([]);
    expect(survivors(dueToday, (e) => matchesEmployer(e, { followUp: "soon" }, CTX), (e) => e.businessName)).toEqual(["Due Today"]);
  });
  it("separates the last-contact windows, including never-contacted", () => {
    expect(names({ contact: "30" })).toEqual(["Hope Healthcare", "Zephyr Foods"]);
    expect(names({ contact: "90" })).toEqual(["Hope Healthcare", "Bay State Logistics", "Zephyr Foods"]);
    expect(names({ contact: "stale" })).toEqual(["Ocean Grove Hotel"]);
    expect(names({ contact: "never" })).toEqual(["Anchor Retail Group"]);
  });
  it("searches the industry LABEL, not just its key", () => {
    // "food service" with a space only exists in the label; the key is food_service
    expect(names({}, { ...CTX, term: "food service" })).toEqual(["Zephyr Foods"]);
    expect(names({}, { ...CTX, term: "newport" })).toEqual(["Ocean Grove Hotel"]);
    expect(names({}, { ...CTX, term: "e5@" })).toEqual(["Zephyr Foods"]);
  });

  // The invariant that PR #15's drill-through rests on: the dashboard card
  // and the filtered list must describe the same set. They share one
  // predicate now, and this fails loudly if that ever stops being true.
  it("agrees exactly with the dashboard's Employer Follow-Ups Due count", () => {
    const kpiCount = EMPLOYERS.filter((e) => isFollowUpDue(e, TODAY)).length;
    const listCount = EMPLOYERS.filter((e) => matchesEmployer(e, { followUp: "due" }, CTX)).length;
    expect(kpiCount).toBe(listCount);
    expect(kpiCount).toBe(1);
  });
});

// -------------------------------------------------------- Job Developer

describe("matchesJobClient", () => {
  const CLIENTS = [
    { id: "c1", firstName: "Marie", lastName: "Joseph", city: "Providence", employmentStatus: "job_ready", pipelineStage: "applying", hasResume: true, workAuthorization: "us_citizen", barriers: [], intakeDate: "2026-08-20" },
    { id: "c2", firstName: "Jean", lastName: "Baptiste", city: "Pawtucket", employmentStatus: "actively_looking", pipelineStage: "interview", hasResume: true, workAuthorization: "permanent_resident", barriers: ["transportation"], intakeDate: "2026-07-05" },
    { id: "c3", firstName: "Rose", lastName: "Pierre", city: "Central Falls", employmentStatus: "resume_needed", pipelineStage: "resume", hasResume: false, workAuthorization: "tps", barriers: ["english", "no_resume"], intakeDate: "2026-08-28" },
    { id: "c4", firstName: "Daniel", lastName: "Louis", city: "Providence", employmentStatus: "employed", pipelineStage: "employed", hasResume: true, workAuthorization: "ead", barriers: [], intakeDate: "2026-02-10" },
    { id: "c5", firstName: "Nadine", lastName: "Charles", city: "Newport", employmentStatus: "applied", pipelineStage: "applying", hasResume: false, workAuthorization: "us_citizen", barriers: ["childcare"], intakeDate: "2026-05-15" }
  ];
  const FOLLOW_UPS = { c2: { nextStepDate: "2026-09-01" } };
  const CTX = { today: TODAY, followUps: FOLLOW_UPS };
  const names = (filters, ctx) => survivors(CLIENTS, (c) => matchesJobClient(c, filters, ctx || CTX), (c) => c.firstName);

  it("filters by the injected follow-up map", () => {
    expect(names({ followUp: "due" })).toEqual(["Jean"]);
    expect(names({ followUp: "none" })).toEqual(["Marie", "Rose", "Daniel", "Nadine"]);
  });
  it("filters by employment status, pipeline stage, resume and work authorization", () => {
    expect(names({ status: "job_ready" })).toEqual(["Marie"]);
    expect(names({ stage: "applying" })).toEqual(["Marie", "Nadine"]);
    expect(names({ resume: "yes" })).toEqual(["Marie", "Jean", "Daniel"]);
    expect(names({ resume: "no" })).toEqual(["Rose", "Nadine"]);
    expect(names({ workAuth: "tps" })).toEqual(["Rose"]);
  });
  it("filters by city and barriers", () => {
    expect(names({ city: "Providence" })).toEqual(["Marie", "Daniel"]);
    expect(names({ barrier: "__none" })).toEqual(["Marie", "Daniel"]);
    expect(names({ barrier: "english" })).toEqual(["Rose"]);
  });
  it("applies the intake windows, widening as the window grows", () => {
    expect(names({ intake: "30" })).toEqual(["Marie", "Rose"]);
    expect(names({ intake: "90" })).toEqual(["Marie", "Jean", "Rose"]);
    expect(names({ intake: "180" })).toEqual(["Marie", "Jean", "Rose", "Nadine"]);
  });
  it("combines a filter with the shared person search", () => {
    expect(names({ city: "Providence" }, { ...CTX, term: "marie" })).toEqual(["Marie"]);
    expect(names({ city: "Providence" }, { ...CTX, term: "rose" })).toEqual([]);
  });
});
