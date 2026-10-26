// Biweekly period arithmetic, deadlines across DST and date boundaries,
// overdue detection, required-field validation, edit/review rights
// (mirroring the database rules), dashboard counts and CSV export.
import { describe, expect, it } from "vitest";
import {
  ORGANIZATION, cleanOutcomes, currentPeriodGroup, daysUntilDue, dueAtFor, filterReportRows, isOverdue, localDateIn, missingFields,
  periodForDate, periodForIndex, programsLabel, reportPermissions, summarizeExpectations, toCsv, zonedTimeToUtc
} from "./staffReports.js";

const schedule = {
  firstPeriodStart: "2026-11-02", periodDays: 14, deadlineDaysAfterEnd: 1, deadlineTime: "17:00",
  timeZone: "America/New_York", graceHours: 0
};

describe("reporting periods", () => {
  it("are every 14 days from the first start, not twice a month", () => {
    expect(periodForIndex(schedule, 0)).toEqual({ index: 0, start: "2026-11-02", end: "2026-11-15" });
    expect(periodForIndex(schedule, 1)).toEqual({ index: 1, start: "2026-11-16", end: "2026-11-29" });
    expect(periodForIndex(schedule, 2)).toEqual({ index: 2, start: "2026-11-30", end: "2026-12-13" });
    expect(periodForIndex(schedule, 4).start).toBe("2026-12-28");
    expect(periodForIndex(schedule, 5)).toEqual({ index: 5, start: "2027-01-11", end: "2027-01-24" });
  });
  it("finds the period containing a date, including both edges", () => {
    expect(periodForDate(schedule, "2026-11-02").index).toBe(0);
    expect(periodForDate(schedule, "2026-11-15").index).toBe(0);
    expect(periodForDate(schedule, "2026-11-16").index).toBe(1);
    expect(periodForDate(schedule, "2026-10-26").index).toBe(-1);
  });
  it("respects a configured duration", () => {
    expect(periodForIndex(Object.assign({}, schedule, { periodDays: 7 }), 1)).toEqual({ index: 1, start: "2026-11-09", end: "2026-11-15" });
  });
  it("handles a leap day", () => {
    const leap = Object.assign({}, schedule, { firstPeriodStart: "2028-02-21" });
    expect(periodForIndex(leap, 0).end).toBe("2028-03-05");
  });
});

describe("deadlines in the schedule's time zone", () => {
  it("is 5 PM Eastern the day after the period ends, standard time", () => {
    expect(dueAtFor(schedule, "2026-11-15").toISOString()).toBe("2026-11-16T22:00:00.000Z");
  });
  it("is 5 PM Eastern in daylight time too (DST ends Nov 1 2026)", () => {
    expect(dueAtFor(schedule, "2026-10-18").toISOString()).toBe("2026-10-19T21:00:00.000Z");
  });
  it("is correct across the spring-forward change (Mar 14 2027)", () => {
    expect(zonedTimeToUtc("2027-03-13", "17:00", "America/New_York").toISOString()).toBe("2027-03-13T22:00:00.000Z");
    expect(zonedTimeToUtc("2027-03-15", "17:00", "America/New_York").toISOString()).toBe("2027-03-15T21:00:00.000Z");
  });
  it("follows another configured zone", () => {
    expect(dueAtFor(Object.assign({}, schedule, { timeZone: "America/Los_Angeles" }), "2026-11-15").toISOString())
      .toBe("2026-11-17T01:00:00.000Z");
  });
  it("counts 'today' in the schedule's zone, not UTC", () => {
    // 11:30 PM Nov 15 in New York is already Nov 16 in UTC.
    const lateEvening = new Date("2026-11-16T04:30:00Z");
    expect(localDateIn("America/New_York", lateEvening)).toBe("2026-11-15");
    expect(daysUntilDue("2026-11-16T22:00:00Z", "America/New_York", lateEvening)).toBe(1);
    expect(daysUntilDue("2026-11-16T22:00:00Z", "America/New_York", new Date("2026-11-16T05:00:00Z"))).toBe(0);
  });
});

describe("isOverdue", () => {
  const due = "2026-11-16T22:00:00Z";
  it("is false until the deadline passes, then true", () => {
    expect(isOverdue(due, null, 0, new Date("2026-11-16T21:59:00Z"))).toBe(false);
    expect(isOverdue(due, null, 0, new Date("2026-11-16T22:01:00Z"))).toBe(true);
  });
  it("honours a grace period", () => {
    expect(isOverdue(due, null, 24, new Date("2026-11-17T21:00:00Z"))).toBe(false);
    expect(isOverdue(due, null, 24, new Date("2026-11-17T23:00:00Z"))).toBe(true);
  });
  it("is never overdue once submitted", () => {
    expect(isOverdue(due, "2026-11-20T10:00:00Z", 0, new Date("2026-12-01T00:00:00Z"))).toBe(false);
  });
});

describe("missingFields", () => {
  const complete = { programs: ["students"], activities: "a", accomplishments: "b", challenges: "c", assistanceNeeded: "d", nextGoals: "e" };
  it("passes a complete report", () => { expect(missingFields(complete)).toEqual([]); });
  it("needs at least one program", () => {
    expect(missingFields(Object.assign({}, complete, { programs: [] }))).toEqual(["programs"]);
    expect(missingFields(Object.assign({}, complete, { programs: undefined }))).toEqual(["programs"]);
  });
  it("treats whitespace as empty", () => {
    expect(missingFields(Object.assign({}, complete, { activities: "   " }))).toEqual(["activities"]);
  });
  it("accepts 'no assistance needed' in place of a request", () => {
    expect(missingFields(Object.assign({}, complete, { assistanceNeeded: "" }))).toEqual(["assistanceNeeded"]);
    expect(missingFields(Object.assign({}, complete, { assistanceNeeded: "", noAssistanceNeeded: true }))).toEqual([]);
  });
});

describe("cleanOutcomes", () => {
  it("drops fully empty rows and keeps partial ones", () => {
    expect(cleanOutcomes([{ metric: "Workshops", value: "2" }, { metric: " ", value: "" }, { metric: "", value: "4" }]))
      .toEqual([{ metric: "Workshops", value: "2", notes: "" }, { metric: "", value: "4", notes: "" }]);
  });
});

describe("reportPermissions", () => {
  const mine = (status, version) => ({ staffId: "me", status: status, version: version || 0 });
  it("lets the author edit drafts and revision requests only", () => {
    expect(reportPermissions(mine("draft"), "me", false).canEdit).toBe(true);
    expect(reportPermissions(mine("revision_requested", 1), "me", false).canSubmit).toBe(true);
    expect(reportPermissions(mine("submitted", 1), "me", false).canEdit).toBe(false);
    expect(reportPermissions(mine("acknowledged", 1), "me", false).canEdit).toBe(false);
  });
  it("lets the author discard only a never-submitted draft", () => {
    expect(reportPermissions(mine("draft"), "me", false).canDiscard).toBe(true);
    expect(reportPermissions(mine("revision_requested", 1), "me", false).canDiscard).toBe(false);
  });
  it("never lets anyone else edit", () => {
    expect(reportPermissions(mine("draft"), "other", true).canEdit).toBe(false);
  });
  it("lets reviewers act on submitted reports of others, not their own", () => {
    expect(reportPermissions(mine("submitted", 1), "boss", true).canAcknowledge).toBe(true);
    expect(reportPermissions(mine("under_review", 1), "boss", true).canRequestRevision).toBe(true);
    expect(reportPermissions(mine("draft"), "boss", true).canAcknowledge).toBe(false);
    expect(reportPermissions(mine("submitted", 1), "me", true).canAcknowledge).toBe(false);
    expect(reportPermissions(mine("submitted", 1), "boss", false).canAcknowledge).toBe(false);
  });
});

describe("summarizeExpectations", () => {
  it("counts each state and the submission rate", () => {
    const s = summarizeExpectations([
      { status: "not_started", overdue: true },
      { status: "draft", overdue: false },
      { status: "submitted", submittedAt: "x" },
      { status: "under_review", submittedAt: "x" },
      { status: "revision_requested", submittedAt: "x" },
      { status: "acknowledged", submittedAt: "x" }
    ]);
    expect(s).toEqual({ expected: 6, submitted: 4, pending: 1, overdue: 1, awaitingReview: 2, revisionRequested: 1, acknowledged: 1, rate: 67 });
  });
  it("has no rate when nothing is expected", () => { expect(summarizeExpectations([]).rate).toBe(null); });
});

describe("currentPeriodGroup", () => {
  const rows = [
    { periodId: "p1", periodStart: "2026-11-02", periodEnd: "2026-11-15", staffId: "me" },
    { periodId: "p2", periodStart: "2026-11-16", periodEnd: "2026-11-29", staffId: "me" }
  ];
  it("picks the period containing today", () => {
    const g = currentPeriodGroup(rows, "2026-11-15");
    expect(g.periodId).toBe("p1");
    expect(g.rows).toHaveLength(1);
  });
  it("falls forward to the next period before the first one starts", () => {
    expect(currentPeriodGroup(rows, "2026-10-26").periodId).toBe("p1");
  });
  it("is null with nothing expected", () => { expect(currentPeriodGroup([], "2026-11-01")).toBe(null); });
});

describe("filterReportRows", () => {
  const names = { staff: { a: "Jane Pierre", b: "Marc Louis", c: "Ann Ray" }, programs: { case_management: "Case Management", workforce: "Workforce" } };
  const rows = [
    { staffId: "a", programs: ["case_management"], status: "submitted", overdue: false },
    { staffId: "c", programs: ["workforce", ORGANIZATION], status: "not_started", overdue: true },
    { staffId: "b", programs: ["case_management", "workforce"], status: "acknowledged", overdue: false }
  ];
  it("filters by program, staff, status and overdue, and searches names", () => {
    expect(filterReportRows(rows, { program: "case_management" }, names)).toHaveLength(2);
    expect(filterReportRows(rows, { program: ORGANIZATION }, names)).toHaveLength(1);
    expect(filterReportRows(rows, { staffId: "a" }, names)).toHaveLength(1);
    expect(filterReportRows(rows, { status: "overdue" }, names)).toHaveLength(1);
    expect(filterReportRows(rows, { status: "acknowledged" }, names)[0].staffId).toBe("b");
    expect(filterReportRows(rows, { q: "marc" }, names)).toHaveLength(1);
    expect(filterReportRows(rows, { q: "workforce" }, names)).toHaveLength(2);
  });
});

describe("programsLabel", () => {
  it("names programs, with the organization-wide label", () => {
    expect(programsLabel([ORGANIZATION, "students", "unknown"], { students: "Students" }, "Organization-wide")).toBe("Organization-wide, Students, unknown");
    expect(programsLabel([], {}, "Org")).toBe("");
  });
});

describe("toCsv", () => {
  it("quotes cells and neutralizes spreadsheet formulas", () => {
    expect(toCsv(["Name", "Note"], [["Jane \"JP\" Pierre", "=SUM(A1)"]])).toBe('"Name","Note"\r\n"Jane ""JP"" Pierre","\'=SUM(A1)"');
  });
});
