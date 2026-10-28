// staffReportsRevision.test.js -- reviewers can't read a report row while
// it's sent back for revision (t4); the app fills those in from
// staff_reports_in_revision(), which carries the last submitted content.
import { beforeEach, describe, expect, it, vi } from "vitest";

let tableRows = [];
let rpcRows = [];
const rpcCalls = [];

function tableQuery() {
  const q = {
    select() { return q; }, eq(col, val) { q.filterId = col === "id" ? val : q.filterId; return q; }, not() { return q; },
    order() { return Promise.resolve({ data: tableRows, error: null }); },
    maybeSingle() { return Promise.resolve({ data: tableRows.find((r) => r.id === q.filterId) || null, error: null }); }
  };
  return q;
}

vi.mock("./supabase.js", () => ({
  supabase: {
    from: () => tableQuery(),
    rpc: (fn, args) => {
      rpcCalls.push([fn, args]);
      return { select: () => Promise.resolve({ data: args && args.p_report ? rpcRows.filter((r) => r.id === args.p_report) : rpcRows, error: null }) };
    }
  }
}));

import { fetchReport, fetchReports, mergeReportRows } from "./staffReports.js";

const row = (id, extra) => Object.assign({ id, staff_id: "s1", status: "submitted", version: 1, created_at: "2026-10-2" + id.slice(-1) }, extra);

describe("reports in revision for reviewers", () => {
  beforeEach(() => { tableRows = []; rpcRows = []; rpcCalls.length = 0; });

  it("merges in-revision rows, newest first, without duplicates", () => {
    const merged = mergeReportRows([row("r1"), row("r3")], [row("r2", { status: "revision_requested" }), row("r3")], null);
    expect(merged.map((r) => r.id)).toEqual(["r3", "r2", "r1"]);
  });

  it("keeps the staff filter on merged rows", () => {
    const merged = mergeReportRows([], [row("r2", { staff_id: "s2" }), row("r4")], { staffId: "s1" });
    expect(merged.map((r) => r.id)).toEqual(["r4"]);
  });

  it("the submitted list includes reports in revision, with their frozen content", async () => {
    tableRows = [row("r1")];
    rpcRows = [row("r2", { status: "revision_requested", activities: "as submitted" })];
    const reports = await fetchReports({ submittedOnly: true });
    expect(reports.map((r) => [r.id, r.status])).toEqual([["r2", "revision_requested"], ["r1", "submitted"]]);
    expect(reports[0].activities).toBe("as submitted");
  });

  it("an author's own list doesn't ask for the reviewer copy", async () => {
    tableRows = [row("r1")];
    await fetchReports({ staffId: "s1" });
    expect(rpcCalls).toEqual([]);
  });

  it("the review screen falls back to the reviewer copy", async () => {
    rpcRows = [row("r2", { status: "revision_requested", activities: "as submitted" })];
    const r = await fetchReport("r2");
    expect(r).toMatchObject({ id: "r2", status: "revision_requested", activities: "as submitted" });
    expect(rpcCalls).toEqual([["staff_reports_in_revision", { p_report: "r2" }]]);
  });

  it("a report nobody may see is still null", async () => {
    expect(await fetchReport("nope")).toBeNull();
  });
});
