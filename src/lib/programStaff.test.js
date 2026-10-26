// Pins who may manage a program's staff. Mirrors can_manage_program() in the
// stage1_program_staff_and_audit migration; section and sidebar rules are
// pinned in outreachPrograms.test.js.
import { describe, expect, it } from "vitest";
import { canManageProgram } from "./programStaff.js";

describe("canManageProgram", () => {
  it("is true for administrators and program admins only", () => {
    expect(canManageProgram("administrator", null)).toBe(true);
    expect(canManageProgram("staff", "program_admin")).toBe(true);
    expect(canManageProgram("case_manager", "supervisor")).toBe(false);
    expect(canManageProgram("staff", "worker")).toBe(false);
  });
});
