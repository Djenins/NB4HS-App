// workforceMetrics.test.js -- the numbers the Workforce module's KPI cards,
// pipeline tiles and report breakdowns put on screen, plus the shared
// reports_data.js primitives they rest on, which had no coverage of their
// own.
//
// These are the figures staff quote to funders, so the cases below lean on
// definitions rather than on happy paths: what counts as active when the
// column is nullable, whether "this month" is a calendar month or a rolling
// window, which side of a boundary a record falls on, and what happens on the
// day a range has no previous period to compare against.
import { describe, expect, it } from "vitest";
import {
  countActiveEmployers, countActiveJobOpenings, countCandidatesAwaitingReferral,
  countFollowUpsDue, countInRange, countInterviewsScheduled, countPlacementsThisMonth,
  employerStageCounts, employersAddedItems, hireItems, interviewItems, jobsPostedItems,
  mergeActivityFeed, placementItems, recentOpenings, referralCountForOpening,
  referralItems, retentionSplit, topCounts
} from "./workforceMetrics.js";
import { computeAnnualCounts, computeMonthlyCounts, inRange, previousRange, trendPct } from "./reports_data.js";
import { computeRetentionRate } from "./placements.js";

const TODAY = "2026-09-02";

// ------------------------------------------------------------ dashboard KPIs

describe("countActiveEmployers", () => {
  it("counts an employer whose active flag was never set", () => {
    // `active` is nullable in the schema; null means "never deactivated",
    // which is an active employer. Testing truthiness would drop these.
    expect(countActiveEmployers([{ active: true }, { active: null }, { active: undefined }, {}])).toBe(4);
  });
  it("excludes only an explicit false", () => {
    expect(countActiveEmployers([{ active: true }, { active: false }])).toBe(1);
  });
  it("is zero for an empty or missing list", () => {
    expect(countActiveEmployers([])).toBe(0);
    expect(countActiveEmployers(undefined)).toBe(0);
  });
});

describe("countActiveJobOpenings", () => {
  it("counts only the active status, not draft/filled/expired/archived", () => {
    const openings = [{ status: "active" }, { status: "active" }, { status: "draft" }, { status: "filled" }, { status: "archived" }, { status: "expired" }];
    expect(countActiveJobOpenings(openings)).toBe(2);
  });
});

describe("countCandidatesAwaitingReferral", () => {
  const CLIENTS = [
    { id: "c1", employmentStatus: "job_ready", active: true },
    { id: "c2", employmentStatus: "actively_looking", active: true },
    { id: "c3", employmentStatus: "employed", active: true },   // not eligible: not looking
    { id: "c4", employmentStatus: "closed", active: true },     // not eligible: closed
    { id: "c5", employmentStatus: "job_ready", active: false }  // not eligible: inactive
  ];
  it("counts eligible job seekers with no referral of any kind", () => {
    expect(countCandidatesAwaitingReferral(CLIENTS, [])).toBe(2);
  });
  it("drops a candidate once they have been referred anywhere", () => {
    expect(countCandidatesAwaitingReferral(CLIENTS, [{ jobClientId: "c1" }])).toBe(1);
  });
  it("counts a candidate once no matter how many referrals they have", () => {
    const many = [{ jobClientId: "c1" }, { jobClientId: "c1" }, { jobClientId: "c1" }];
    expect(countCandidatesAwaitingReferral(CLIENTS, many)).toBe(1);
  });
  it("uses the same eligibility rule as the Candidate Matching page", () => {
    // employed/closed and inactive are excluded by isCandidateEligible, so a
    // change there has to show up here rather than the two drifting apart.
    expect(countCandidatesAwaitingReferral([{ id: "x", employmentStatus: "employed", active: true }], [])).toBe(0);
  });
});

describe("countInterviewsScheduled", () => {
  it("counts referrals AT the interview stage, not past it", () => {
    const referrals = [{ status: "interview" }, { status: "interview" }, { status: "offer" }, { status: "hired" }, { status: "referred" }];
    expect(countInterviewsScheduled(referrals)).toBe(2);
  });
});

describe("countPlacementsThisMonth", () => {
  const PLACEMENTS = [
    { startDate: "2026-09-01" }, { startDate: "2026-09-30" },
    { startDate: "2026-08-31" },   // previous month
    { startDate: "2025-09-15" },   // same month, previous year
    { startDate: "" }              // never started
  ];
  it("is a calendar month, not a rolling thirty days", () => {
    // Aug 31 is one day before TODAY and still excluded; Sep 30 is four weeks
    // after and still included.
    expect(countPlacementsThisMonth(PLACEMENTS, TODAY)).toBe(2);
  });
  it("does not match the same month in another year", () => {
    expect(countPlacementsThisMonth([{ startDate: "2025-09-15" }], TODAY)).toBe(0);
  });
  it("ignores placements with no start date", () => {
    expect(countPlacementsThisMonth([{ startDate: "" }, { startDate: null }], TODAY)).toBe(0);
  });
});

describe("countFollowUpsDue", () => {
  it("counts due-today and overdue, but not upcoming or unscheduled", () => {
    const employers = [
      { nextFollowUpDate: "2026-08-25" },  // overdue
      { nextFollowUpDate: TODAY },         // due today
      { nextFollowUpDate: "2026-09-05" },  // upcoming
      { nextFollowUpDate: "" }             // none scheduled
    ];
    expect(countFollowUpsDue(employers, TODAY)).toBe(2);
  });
});

describe("employerStageCounts", () => {
  const STAGES = [{ key: "prospect", en: "Prospect" }, { key: "partner", en: "Partner" }, { key: "hiring", en: "Hiring" }];
  it("keeps every stage, including the empty ones", () => {
    // A gap in the pipeline is information; dropping zero-count stages would
    // hide it.
    const counts = employerStageCounts([{ partnershipStage: "hiring" }], STAGES);
    expect(counts.map((s) => s.count)).toEqual([0, 0, 1]);
    expect(counts.map((s) => s.key)).toEqual(["prospect", "partner", "hiring"]);
  });
  it("preserves the stage order it was given, not count order", () => {
    const employers = [{ partnershipStage: "hiring" }, { partnershipStage: "hiring" }, { partnershipStage: "prospect" }];
    expect(employerStageCounts(employers, STAGES).map((s) => s.key)).toEqual(["prospect", "partner", "hiring"]);
  });
  it("carries the stage's own fields through alongside the count", () => {
    expect(employerStageCounts([], STAGES)[0]).toMatchObject({ key: "prospect", en: "Prospect", count: 0 });
  });
});

describe("recentOpenings", () => {
  const OPENINGS = [
    { id: "a", postedDate: "2026-08-01" },
    { id: "b", postedDate: "2026-08-28" },
    { id: "c", postedDate: "" },
    { id: "d", postedDate: "2026-08-15" }
  ];
  it("returns newest first", () => {
    expect(recentOpenings(OPENINGS, 4).map((o) => o.id)).toEqual(["b", "d", "a", "c"]);
  });
  it("sorts an undated opening last rather than first", () => {
    expect(recentOpenings(OPENINGS, 4).map((o) => o.id).pop()).toBe("c");
  });
  it("respects the limit and does not mutate its input", () => {
    const before = OPENINGS.map((o) => o.id);
    expect(recentOpenings(OPENINGS, 2).map((o) => o.id)).toEqual(["b", "d"]);
    expect(OPENINGS.map((o) => o.id)).toEqual(before);
  });
});

describe("referralCountForOpening", () => {
  it("counts referrals pointing at one opening", () => {
    const referrals = [{ jobOpeningId: "o1" }, { jobOpeningId: "o1" }, { jobOpeningId: "o2" }];
    expect(referralCountForOpening(referrals, "o1")).toBe(2);
    expect(referralCountForOpening(referrals, "o3")).toBe(0);
  });
});

describe("mergeActivityFeed", () => {
  const ENTRIES = [
    { date: "2026-08-01", type: "opening", text: "a" },
    { date: "2026-08-30", type: "placement", text: "b" },
    { date: "", type: "referral", text: "undated" },
    { date: "2026-08-15", type: "interview", text: "c" }
  ];
  it("merges sources newest first", () => {
    expect(mergeActivityFeed(ENTRIES, 10).map((e) => e.text)).toEqual(["b", "c", "a"]);
  });
  it("drops undated entries instead of parking them at one end", () => {
    expect(mergeActivityFeed(ENTRIES, 10).some((e) => e.text === "undated")).toBe(false);
  });
  it("caps at the limit after sorting, so the newest survive the cap", () => {
    expect(mergeActivityFeed(ENTRIES, 1).map((e) => e.text)).toEqual(["b"]);
  });
});

// ------------------------------------------------------- report item extraction

describe("report item extraction", () => {
  it("measures each series by the date that series is actually about", () => {
    expect(jobsPostedItems([{ postedDate: "2026-08-01" }])).toEqual([{ date: "2026-08-01" }]);
    expect(placementItems([{ startDate: "2026-08-02" }])).toEqual([{ date: "2026-08-02" }]);
    expect(referralItems([{ referralDate: "2026-08-03" }])).toEqual([{ date: "2026-08-03" }]);
  });
  it("truncates the employer createdAt timestamp to a date", () => {
    expect(employersAddedItems([{ createdAt: "2026-08-04T13:45:12.000Z" }])).toEqual([{ date: "2026-08-04" }]);
    expect(employersAddedItems([{ createdAt: null }])).toEqual([{ date: "" }]);
  });
  it("counts only referrals that actually have an interview date", () => {
    expect(interviewItems([{ interviewDate: "2026-08-05" }, { interviewDate: "" }, {}])).toEqual([{ date: "2026-08-05" }]);
  });
  it("approximates a hire by the referral's updatedAt, and only for hired rows", () => {
    // Disclosed approximation: there is no stage-change log, so the last time
    // the row was touched is the best available proxy for when it was hired.
    const referrals = [
      { status: "hired", updatedAt: "2026-08-06T09:00:00Z" },
      { status: "offer", updatedAt: "2026-08-07T09:00:00Z" }
    ];
    expect(hireItems(referrals)).toEqual([{ date: "2026-08-06" }]);
  });
});

describe("countInRange", () => {
  const RANGE = { from: "2026-08-01", to: "2026-08-31" };
  it("includes both endpoints", () => {
    expect(countInRange([{ date: "2026-08-01" }, { date: "2026-08-31" }], RANGE)).toBe(2);
  });
  it("excludes the days either side", () => {
    expect(countInRange([{ date: "2026-07-31" }, { date: "2026-09-01" }], RANGE)).toBe(0);
  });
  it("ignores undated items rather than counting them", () => {
    expect(countInRange([{ date: "" }, { date: null }, {}], RANGE)).toBe(0);
  });
});

// ---------------------------------------------------------- report breakdowns

describe("topCounts", () => {
  const PLACEMENTS = [
    { employerName: "Hope Healthcare" }, { employerName: "Hope Healthcare" }, { employerName: "Hope Healthcare" },
    { employerName: "Bay State Logistics" }, { employerName: "Bay State Logistics" },
    { employerName: "Zephyr Foods" },
    { employerName: "" }, { employerName: null }
  ];
  const byEmployer = (p) => p.employerName;
  it("groups and orders biggest first", () => {
    expect(topCounts(PLACEMENTS, byEmployer, 8)).toEqual([
      { label: "Hope Healthcare", count: 3 },
      { label: "Bay State Logistics", count: 2 },
      { label: "Zephyr Foods", count: 1 }
    ]);
  });
  it("drops records whose key is blank rather than grouping them under ''", () => {
    expect(topCounts(PLACEMENTS, byEmployer, 8).map((x) => x.label)).not.toContain("");
  });
  it("applies the limit after sorting, so the biggest survive", () => {
    // Found by mutation-testing: PLACEMENTS above happens to arrive in
    // biggest-first order, so slicing before sorting would give the same
    // answer and the test would pass either way. This fixture puts the
    // smallest group first on purpose, so only sort-then-slice can be right.
    const ADVERSE = [
      { employerName: "Zephyr Foods" },
      { employerName: "Bay State Logistics" }, { employerName: "Bay State Logistics" },
      { employerName: "Hope Healthcare" }, { employerName: "Hope Healthcare" }, { employerName: "Hope Healthcare" }
    ];
    expect(topCounts(ADVERSE, byEmployer, 2).map((x) => x.label)).toEqual(["Hope Healthcare", "Bay State Logistics"]);
    expect(topCounts(PLACEMENTS, byEmployer, 2).map((x) => x.label)).toEqual(["Hope Healthcare", "Bay State Logistics"]);
  });
  it("returns an empty list for no records", () => {
    expect(topCounts([], byEmployer, 8)).toEqual([]);
    expect(topCounts(undefined, byEmployer, 8)).toEqual([]);
  });
});

describe("retentionSplit", () => {
  const CUTOFF = "2026-06-04"; // 90 days before TODAY
  const PLACEMENTS = [
    { startDate: "2026-01-15", currentStatus: "active" },
    { startDate: "2026-03-01", currentStatus: "ended" },
    { startDate: "2026-05-01", currentStatus: "active" },
    { startDate: "2026-08-20", currentStatus: "active" },  // too new to judge
    { startDate: "", currentStatus: "active" }             // no start date
  ];
  it("judges only placements old enough to evaluate", () => {
    expect(retentionSplit(PLACEMENTS, CUTOFF)).toEqual({ eligible: 3, retained: 2, notRetained: 1 });
  });
  it("always has parts that sum to the whole", () => {
    const s = retentionSplit(PLACEMENTS, CUTOFF);
    expect(s.retained + s.notRetained).toBe(s.eligible);
  });
  it("includes a placement starting exactly on the cutoff", () => {
    expect(retentionSplit([{ startDate: CUTOFF, currentStatus: "active" }], CUTOFF).eligible).toBe(1);
  });
  it("is all zeros when nothing is old enough yet", () => {
    expect(retentionSplit([{ startDate: "2026-08-20", currentStatus: "active" }], CUTOFF))
      .toEqual({ eligible: 0, retained: 0, notRetained: 0 });
  });
});

describe("computeRetentionRate", () => {
  it("is the percentage of eligible placements still active", () => {
    const placements = [
      { startDate: "2026-01-15", currentStatus: "active" },
      { startDate: "2026-03-01", currentStatus: "ended" },
      { startDate: "2026-05-01", currentStatus: "active" }
    ];
    expect(computeRetentionRate(placements, TODAY)).toBe(67);
  });
  it("returns null rather than 0 when nothing is old enough to judge", () => {
    // The card renders "—" for null. Returning 0 would read as "everyone left".
    expect(computeRetentionRate([{ startDate: "2026-08-20", currentStatus: "active" }], TODAY)).toBeNull();
    expect(computeRetentionRate([], TODAY)).toBeNull();
  });
  it("agrees with retentionSplit on the same data", () => {
    const placements = [
      { startDate: "2026-01-15", currentStatus: "active" },
      { startDate: "2026-03-01", currentStatus: "ended" }
    ];
    const split = retentionSplit(placements, "2026-06-04");
    expect(computeRetentionRate(placements, TODAY)).toBe(Math.round((split.retained / split.eligible) * 100));
  });
});

// -------------------------------------------- shared reports_data primitives

describe("inRange", () => {
  it("is inclusive at both ends", () => {
    expect(inRange({ date: "2026-08-01" }, "2026-08-01", "2026-08-31")).toBe(true);
    expect(inRange({ date: "2026-08-31" }, "2026-08-01", "2026-08-31")).toBe(true);
    expect(inRange({ date: "2026-07-31" }, "2026-08-01", "2026-08-31")).toBe(false);
  });
});

describe("previousRange", () => {
  it("is the same length, ending the day before the range starts", () => {
    expect(previousRange({ from: "2026-08-01", to: "2026-08-31" })).toEqual({ from: "2026-07-01", to: "2026-07-31" });
  });
  it("handles a single day", () => {
    expect(previousRange({ from: TODAY, to: TODAY })).toEqual({ from: "2026-09-01", to: "2026-09-01" });
  });
  it("keeps its length across a daylight-saving boundary", () => {
    // The same millisecond arithmetic that broke daysSince lives here, but
    // with Math.round rather than Math.floor -- so a lost hour rounds back.
    // Pinned so a future edit to Math.floor is caught.
    const prev = previousRange({ from: "2026-03-08", to: "2026-03-14" });
    expect(prev).toEqual({ from: "2026-03-01", to: "2026-03-07" });
  });
  it("spans a year boundary, keeping the length", () => {
    // January is 31 days, so the previous 31-day period ending Dec 31 starts
    // Dec 1 -- not Dec 2, which would be 30 days.
    expect(previousRange({ from: "2026-01-01", to: "2026-01-31" })).toEqual({ from: "2025-12-01", to: "2025-12-31" });
  });
  it("returns a period the same length as the one it follows", () => {
    const cases = [["2026-08-01", "2026-08-31"], ["2026-09-02", "2026-09-02"], ["2026-01-01", "2026-01-31"], ["2026-02-01", "2026-02-28"]];
    cases.forEach(function (c) {
      const range = { from: c[0], to: c[1] };
      const prev = previousRange(range);
      const len = (r) => Math.round((new Date(r.to + "T00:00:00") - new Date(r.from + "T00:00:00")) / 86400000) + 1;
      expect(len(prev)).toBe(len(range));
    });
  });
});

describe("trendPct", () => {
  it("computes a percentage change", () => {
    expect(trendPct(150, 100)).toEqual({ pct: 50, none: false });
    expect(trendPct(50, 100)).toEqual({ pct: -50, none: false });
  });
  it("calls nothing-to-nothing 'no change' rather than 0%", () => {
    // A 0% badge on an empty period reads as "flat"; this period had no
    // activity to be flat about.
    expect(trendPct(0, 0)).toEqual({ pct: 0, none: true });
  });
  it("calls new activity from a zero baseline +100% rather than dividing by zero", () => {
    expect(trendPct(7, 0)).toEqual({ pct: 100, none: false });
  });
  it("rounds to a whole percent", () => {
    expect(trendPct(2, 3)).toEqual({ pct: -33, none: false });
  });
});

describe("computeMonthlyCounts", () => {
  const ITEMS = [
    { date: "2026-01-15" }, { date: "2026-07-04" }, { date: "2026-07-31" },
    { date: "2025-07-01" }, { date: "" }
  ];
  it("buckets by month within one year and ignores other years", () => {
    const { labels, data } = computeMonthlyCounts(ITEMS, "2026");
    expect(labels).toHaveLength(12);
    expect(data).toEqual([1, 0, 0, 0, 0, 0, 2, 0, 0, 0, 0, 0]);
  });
  it("accepts the year as a number as well as a string", () => {
    expect(computeMonthlyCounts(ITEMS, 2026).data[0]).toBe(1);
  });
  it("returns twelve zeros for a year with no data", () => {
    expect(computeMonthlyCounts(ITEMS, "2024").data).toEqual(new Array(12).fill(0));
  });
});

describe("computeAnnualCounts", () => {
  const ITEMS = [{ date: "2024-05-01" }, { date: "2026-01-01" }, { date: "2026-12-31" }, { date: "2019-01-01" }];
  it("buckets by year across an inclusive span", () => {
    const { labels, data } = computeAnnualCounts(ITEMS, 2023, 2026);
    expect(labels).toEqual(["2023", "2024", "2025", "2026"]);
    expect(data).toEqual([0, 1, 0, 2]);
  });
  it("silently ignores items outside the span rather than clamping them in", () => {
    // 2019 must not land in the 2023 bucket.
    expect(computeAnnualCounts(ITEMS, 2023, 2026).data[0]).toBe(0);
  });
});
