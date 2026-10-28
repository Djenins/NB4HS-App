// calendarDataRefusal.test.js -- RLS refuses a delete with "0 rows" and an
// update with "no row back" rather than an error. The data layer turns both
// into errors, so the calendar never shows a refused change as done.
import { beforeEach, describe, expect, it, vi } from "vitest";

let result;
function chain() {
  const q = {
    delete() { return q; }, update() { return q; }, select() { return q; },
    eq() { return q; },
    single() { return Promise.resolve(result); },
    then(resolve, reject) { return Promise.resolve(result).then(resolve, reject); }
  };
  return q;
}
vi.mock("./supabase.js", () => ({ supabase: { from: () => chain() } }));

import { deleteCalendarEvent, updateCalendarEvent } from "./calendarData.js";

const fields = { title: "Visit", date: "2026-11-02", startTime: "09:00", type: "visit" };

describe("calendar writes RLS refuses", () => {
  beforeEach(() => { result = null; });

  it("a delete that removed nothing is an error", async () => {
    result = { error: null, count: 0 };
    await expect(deleteCalendarEvent("e1")).rejects.toThrow("You can't delete this event.");
  });
  it("a delete that removed the row is fine", async () => {
    result = { error: null, count: 1 };
    await expect(deleteCalendarEvent("e1")).resolves.toBeUndefined();
  });
  it("an update with no row back is an error", async () => {
    result = { data: null, error: { code: "PGRST116", message: "JSON object requested, multiple (or no) rows returned" } };
    await expect(updateCalendarEvent("e1", fields)).rejects.toThrow("You can't change this event.");
  });
  it("other update errors pass through", async () => {
    result = { data: null, error: { code: "23514", message: "check failed" } };
    await expect(updateCalendarEvent("e1", fields)).rejects.toMatchObject({ code: "23514" });
  });
});
