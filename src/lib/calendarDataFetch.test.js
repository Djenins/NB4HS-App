// calendarDataFetch.test.js -- the calendar reads calendar_events_between()
// (t7: everyone's time blocks, names and notes only on your own) and falls
// back to the table where t7 isn't applied yet.
import { beforeEach, describe, expect, it, vi } from "vitest";

let rpcResult;
let tableRows = [];
const calls = [];

function tableQuery() {
  const q = {
    select() { calls.push("table"); return q; }, gte() { return q; }, lte() { return q; },
    order() { q.n = (q.n || 0) + 1; return q.n === 2 ? Promise.resolve({ data: tableRows, error: null }) : q; }
  };
  return q;
}
vi.mock("./supabase.js", () => ({
  supabase: { rpc: (fn, args) => { calls.push(["rpc", fn, args]); return Promise.resolve(rpcResult); }, from: () => tableQuery() }
}));

import { fetchCalendarEvents } from "./calendarData.js";

const row = (id, extra) => Object.assign({ id, type: "visit", title: "Visit", event_date: "2026-11-03", start_time: "09:00:00" }, extra);

describe("fetchCalendarEvents", () => {
  beforeEach(() => { calls.length = 0; tableRows = []; rpcResult = null; });

  it("reads the range through calendar_events_between", async () => {
    rpcResult = { data: [row("e1", { person_name: null, notes: null, created_by: "someone" })], error: null };
    const events = await fetchCalendarEvents("2026-11-02", "2026-11-08");
    expect(calls).toEqual([["rpc", "calendar_events_between", { p_from: "2026-11-02", p_to: "2026-11-08" }]]);
    expect(events[0]).toMatchObject({ id: "e1", title: "Visit", personName: "", notes: "", startTime: "09:00" });
  });

  it("falls back to the table where the function doesn't exist yet", async () => {
    rpcResult = { data: null, error: { code: "PGRST202", message: "not found" } };
    tableRows = [row("e2", { person_name: "Client" })];
    const events = await fetchCalendarEvents("2026-11-02", "2026-11-08");
    expect(calls).toContain("table");
    expect(events[0]).toMatchObject({ id: "e2", personName: "Client" });
  });

  it("other errors still surface (the page shows its error state)", async () => {
    rpcResult = { data: null, error: { code: "42501", message: "permission denied" } };
    await expect(fetchCalendarEvents("2026-11-02", "2026-11-08")).rejects.toMatchObject({ code: "42501" });
    expect(calls).not.toContain("table");
  });
});
