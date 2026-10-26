// Pins who sees what in SNAP Outreach. These mirror the RLS rules in the
// stage1_program_staff_and_audit migration (has_program_role /
// can_manage_program); the UI must never show more than the database allows.
import { describe, expect, it } from "vitest";
import { canManageProgram, snapSectionsFor } from "./programStaff.js";
import { navItemsForRole } from "./nav.js";

describe("snapSectionsFor", () => {
  it("gives a worker or supervisor the member sections only", () => {
    expect(snapSectionsFor("staff", "worker")).toEqual(["overview"]);
    expect(snapSectionsFor("case_manager", "supervisor")).toEqual(["overview"]);
  });

  it("gives a program admin both member and staff sections", () => {
    expect(snapSectionsFor("staff", "program_admin")).toEqual(["overview", "staff"]);
  });

  it("gives an administrator without a SNAP role only staff management", () => {
    expect(snapSectionsFor("administrator", null)).toEqual(["staff"]);
  });

  it("gives an administrator who also holds a SNAP role the member sections too", () => {
    expect(snapSectionsFor("administrator", "worker")).toEqual(["overview", "staff"]);
  });

  it("gives everyone else nothing", () => {
    expect(snapSectionsFor("case_manager", null)).toEqual([]);
    expect(snapSectionsFor("staff", "owner")).toEqual([]);
    expect(snapSectionsFor(null, null)).toEqual([]);
  });
});

describe("canManageProgram", () => {
  it("is true for administrators and program admins only", () => {
    expect(canManageProgram("administrator", null)).toBe(true);
    expect(canManageProgram("staff", "program_admin")).toBe(true);
    expect(canManageProgram("case_manager", "supervisor")).toBe(false);
    expect(canManageProgram("staff", "worker")).toBe(false);
  });
});

describe("SNAP sidebar entry", () => {
  it("shows for administrators and anyone holding a SNAP role", () => {
    expect(navItemsForRole("administrator", [], {})).toContain("snap");
    expect(navItemsForRole("staff", [], { snap: "worker" })).toContain("snap");
    expect(navItemsForRole("receptionist", [], { snap: "supervisor" })).toContain("snap");
  });

  it("is hidden from other staff", () => {
    expect(navItemsForRole("case_manager", [], {})).not.toContain("snap");
    expect(navItemsForRole("job_developer", [])).not.toContain("snap");
  });
});
