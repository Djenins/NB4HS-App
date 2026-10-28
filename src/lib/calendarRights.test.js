// calendarRights.test.js -- the calendar offers only what calendar_events'
// policies (p3f) will accept, so a refused action is never one click away.
import { describe, expect, it } from "vitest";
import { eventRights } from "./calendar.js";

const mine = { id: "e1", createdBy: "me" };
const theirs = { id: "e2", createdBy: "them" };

describe("eventRights", () => {
  it("lets the creator change and delete their event", () => {
    expect(eventRights(mine, "me", true, false)).toEqual({ edit: true, duplicate: true, remove: true });
  });
  it("only offers a copy of someone else's event", () => {
    expect(eventRights(theirs, "me", true, false)).toEqual({ edit: false, duplicate: true, remove: false });
  });
  it("lets calendar.events.manage_all change anyone's event", () => {
    expect(eventRights(theirs, "me", true, true)).toEqual({ edit: true, duplicate: true, remove: true });
  });
  it("offers no copy without calendar.events.create (view-only roles)", () => {
    expect(eventRights(theirs, "me", false, false)).toEqual({ edit: false, duplicate: false, remove: false });
  });
  it("never treats an event with no creator as yours", () => {
    expect(eventRights({ id: "e3", createdBy: null }, null, true, false).edit).toBe(false);
  });
  it("gives class blocks nothing", () => {
    expect(eventRights(null, "me", true, true)).toEqual({ edit: false, duplicate: false, remove: false });
  });
});
