// Follow-up grouping, the automation-title translation, edit rights
// (mirroring the tasks RLS policy) and the completion-rate metric.
import { describe, expect, it } from "vitest";
import { addDays, completionRate, taskBuckets, taskPermissions, taskTitle } from "./snapTasks.js";

describe("taskBuckets", () => {
  const tasks = [
    { id: "o", status: "open", dueDate: "2026-10-20" },
    { id: "t", status: "open", dueDate: "2026-10-26" },
    { id: "s", status: "open", dueDate: "2026-11-02" },
    { id: "l", status: "open", dueDate: "2026-11-03" },
    { id: "n", status: "open", dueDate: "" },
    { id: "d", status: "done", dueDate: "2026-10-01" },
    { id: "x", status: "cancelled", dueDate: "2026-10-01" }
  ];
  it("splits open tasks by due date relative to today and drops cancelled", () => {
    const b = taskBuckets(tasks, "2026-10-26");
    expect(b.overdue.map((t) => t.id)).toEqual(["o"]);
    expect(b.dueSoon.map((t) => t.id)).toEqual(["t", "s"]);
    expect(b.later.map((t) => t.id)).toEqual(["l"]);
    expect(b.noDate.map((t) => t.id)).toEqual(["n"]);
    expect(b.done.map((t) => t.id)).toEqual(["d"]);
  });
});

describe("addDays", () => {
  it("crosses month and year boundaries", () => {
    expect(addDays("2026-10-30", 3)).toBe("2026-11-02");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });
});

describe("taskTitle", () => {
  const t = (k) => ({ snapTaskInitialFollowUp: "Premye swivi" }[k] || k);
  it("translates automation titles and keeps the case number", () => {
    expect(taskTitle({ title: "Initial follow-up: SNAP-2026-00001", automationKey: "case_opened:abc" }, t)).toBe("Premye swivi: SNAP-2026-00001");
  });
  it("leaves staff-written titles alone", () => {
    expect(taskTitle({ title: "Call back Tuesday", automationKey: null }, t)).toBe("Call back Tuesday");
  });
});

describe("taskPermissions / completionRate", () => {
  it("lets workers edit only their own tasks; leads edit and assign any", () => {
    expect(taskPermissions({ assignedTo: "w1" }, "worker", "w1")).toEqual({ canEdit: true, canAssignOthers: false });
    expect(taskPermissions({ assignedTo: "w1" }, "worker", "w2").canEdit).toBe(false);
    expect(taskPermissions({ assignedTo: "w1" }, "supervisor", "s")).toEqual({ canEdit: true, canAssignOthers: true });
  });
  it("is null when nothing was due, otherwise a whole percent", () => {
    expect(completionRate(0, 0)).toBeNull();
    expect(completionRate(3, 2)).toBe(67);
  });
});
