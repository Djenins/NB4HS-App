// The permission-resolution rules (plans/unified-access-architecture.md §4),
// one table row per rule. The same rules are checked against the real
// database in supabase/tests/p1_access_check.sql.
import { describe, expect, it, vi } from "vitest";

vi.mock("./supabase.js", () => ({ supabase: null }));
const { can, resolveEffectivePermissions } = await import("./permissions.js");

const modules = [
  { key: "students", parentKey: null, kind: "program", active: true, implemented: true },
  { key: "students.assessments", parentKey: "students", kind: "submodule", active: true, implemented: true },
  { key: "students.progress", parentKey: "students", kind: "submodule", active: true, implemented: false },
  { key: "calendar", parentKey: null, kind: "shared", active: true, implemented: true }
];
const permissions = [
  { key: "students.view", moduleKey: "students", scoped: true },
  { key: "students.edit", moduleKey: "students", scoped: true },
  { key: "students.assessments.view", moduleKey: "students.assessments", scoped: true },
  { key: "students.assessments.grade", moduleKey: "students.assessments", scoped: true },
  { key: "students.progress.view", moduleKey: "students.progress", scoped: false },
  { key: "calendar.view", moduleKey: "calendar", scoped: false }
];
const roles = [{ id: "r1", key: "teacher" }, { id: "r2", key: "old", archived: true }];
const rolePermissions = [
  { roleId: "r1", permissionKey: "students.view", scope: "program" },
  { roleId: "r1", permissionKey: "students.edit", scope: "assigned" },
  { roleId: "r1", permissionKey: "students.assessments.view", scope: "program" },
  { roleId: "r1", permissionKey: "students.assessments.grade", scope: "assigned" },
  { roleId: "r1", permissionKey: "students.progress.view", scope: null },
  { roleId: "r1", permissionKey: "calendar.view", scope: null },
  { roleId: "r2", permissionKey: "students.edit", scope: "org" }
];

function resolve(extra) {
  return resolveEffectivePermissions(Object.assign({
    active: true, modules, permissions, roles, rolePermissions,
    roleAssignments: [{ roleId: "r1", programKey: null }],
    programAccess: ["students"], overrides: []
  }, extra));
}
const keys = (rows) => rows.map((r) => r.permissionKey).sort();
const scopeOf = (rows, key) => (rows.find((r) => r.permissionKey === key) || {}).scope;

describe("permission resolution", () => {
  it("grants a role's permissions, tagged with their program", () => {
    const rows = resolve();
    expect(keys(rows)).toEqual(["calendar.view", "students.assessments.grade", "students.assessments.view", "students.edit", "students.view"]);
    expect(rows.find((r) => r.permissionKey === "students.view").programKey).toBe("students");
    expect(rows.find((r) => r.permissionKey === "calendar.view").programKey).toBe("");
  });

  it("an inactive account holds nothing", () => {
    expect(resolve({ active: false })).toEqual([]);
  });

  it("modules that aren't built (or are switched off) grant nothing", () => {
    expect(keys(resolve())).not.toContain("students.progress.view");
    const off = modules.map((m) => (m.key === "students" ? Object.assign({}, m, { active: false }) : m));
    expect(keys(resolve({ modules: off }))).toEqual(["calendar.view"]);
  });

  it("program gate: no program access, no program permissions -- roles don't open programs", () => {
    expect(keys(resolve({ programAccess: [] }))).toEqual(["calendar.view"]);
  });

  it("a role assigned for one program doesn't apply in another", () => {
    expect(keys(resolve({ roleAssignments: [{ roleId: "r1", programKey: "workforce" }] }))).toEqual(["calendar.view"]);
  });

  it("archived roles, revoked and expired assignments grant nothing", () => {
    expect(scopeOf(resolve({ roleAssignments: [{ roleId: "r1" }, { roleId: "r2" }] }), "students.edit")).toBe("assigned");
    expect(resolve({ roleAssignments: [{ roleId: "r1", revokedAt: "2026-01-01" }] })).toEqual([]);
    expect(resolve({ roleAssignments: [{ roleId: "r1", expiresAt: "2020-01-01" }] })).toEqual([]);
  });

  it("the widest granted scope wins", () => {
    const rows = resolve({ overrides: [{ permissionKey: "students.edit", effect: "grant", scope: "program" }] });
    expect(scopeOf(rows, "students.edit")).toBe("program");
  });

  it("a deny without a scope beats every grant", () => {
    expect(keys(resolve({ overrides: [{ permissionKey: "calendar.view", effect: "deny" }] }))).not.toContain("calendar.view");
  });

  it("a deny with a scope caps below that scope", () => {
    const rows = resolve({ overrides: [{ permissionKey: "students.view", effect: "deny", scope: "program" }] });
    expect(scopeOf(rows, "students.view")).toBe("team");
    const gone = resolve({ overrides: [{ permissionKey: "students.edit", effect: "deny", scope: "own" }] });
    expect(keys(gone)).not.toContain("students.edit");
  });

  it("parent gate: denying a program's .view removes its submodules", () => {
    const rows = resolve({ overrides: [{ permissionKey: "students.view", effect: "deny" }] });
    expect(keys(rows)).toEqual(["calendar.view", "students.edit"]);
  });

  it("revoked or expired overrides are ignored", () => {
    const rows = resolve({ overrides: [
      { permissionKey: "calendar.view", effect: "deny", revokedAt: "2026-01-01" },
      { permissionKey: "students.view", effect: "deny", expiresAt: "2020-01-01" }
    ] });
    expect(keys(rows)).toContain("calendar.view");
    expect(keys(rows)).toContain("students.assessments.grade");
  });

  it("can() checks a permission, optionally within a program", () => {
    const rows = resolve();
    expect(can(rows, "students.view")).toBe(true);
    expect(can(rows, "students.view", "students")).toBe(true);
    expect(can(rows, "students.view", "workforce")).toBe(false);
    expect(can(rows, "calendar.view", "workforce")).toBe(true);
    expect(can(rows, "admin.view")).toBe(false);
  });
});
