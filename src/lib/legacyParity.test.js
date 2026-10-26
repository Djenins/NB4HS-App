// Parity between the old navigation rules (nav.js navItemsForRole) and the
// new access model, for every combination of account role, Workforce
// Development Access setting and program role.
//
// The catalog and the legacy role permission sets are read straight from the
// p1b_access_foundation migration, so this test fails if the migration's seed
// and today's sidebar drift apart. The same comparison runs against every live
// account in supabase/tests/p1_access_check.sql.
import { readFileSync } from "node:fs";
import { resolve as resolvePath } from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("./supabase.js", () => ({ supabase: null }));
const { resolveEffectivePermissions } = await import("./permissions.js");
const { navItemsFromPermissions } = await import("./modules.js");
const { navItemsForRole } = await import("./nav.js");

const sql = readFileSync(resolvePath(__dirname, "../../supabase/migrations/20261026161100_p1b_access_foundation.sql"), "utf8");

const modules = [...sql.matchAll(/\('([a-z_.]+)', (null|'[a-z_.]+'), '(program|submodule|shared|admin)', .*?, (\d+), (true|false), (null|'[a-z_]+')\)/g)]
  .map((m) => ({ key: m[1], parentKey: m[2] === "null" ? null : m[2].slice(1, -1), kind: m[3], active: true, implemented: m[5] === "true" }));
const permissions = [...sql.matchAll(/\('([a-z_.]+)', '([a-z_.]+)', (true|false), '(normal|sensitive|system)'/g)]
  .map((m) => ({ key: m[1], moduleKey: m[2], scoped: m[3] === "true" }));
const rolePermissions = [...sql.matchAll(/\('((?:legacy|system|executive)_[a-z_]+)', '([a-z_.]+)', (null|'[a-z]+')\)/g)]
  .map((m) => ({ roleId: m[1], permissionKey: m[2], scope: m[3] === "null" ? null : m[3].slice(1, -1) }));
const roles = [...new Set(rolePermissions.map((rp) => rp.roleId))].map((id) => ({ id, key: id }));

// sync_legacy_access() / legacy_role_programs() from the migration.
const ROLE_PROGRAMS = {
  administrator: ["workforce", "snap", "students", "case_management", "food_distribution"],
  staff: ["food_distribution"], receptionist: [], case_manager: ["students", "case_management"],
  job_developer: ["students", "workforce"]
};
function legacyAccess(role, workforceOn, programRoles) {
  const assignments = [{ roleId: "legacy_" + role, programKey: null }];
  const programs = ROLE_PROGRAMS[role].slice();
  if (role !== "administrator" && workforceOn) {
    assignments.push({ roleId: "legacy_workforce_access", programKey: null });
    programs.push("workforce");
  }
  Object.keys(programRoles).forEach((program) => {
    if (program === "staff_reports") assignments.push({ roleId: "legacy_report_" + programRoles[program], programKey: null });
    else { assignments.push({ roleId: "legacy_outreach_" + programRoles[program], programKey: program }); programs.push(program); }
  });
  return { assignments, programs };
}

const PROGRAM_ROLE_CASES = [
  {}, { snap: "worker" }, { snap: "supervisor" }, { snap: "program_admin" },
  { staff_reports: "reviewer" }, { staff_reports: "program_admin" }, { snap: "worker", staff_reports: "reviewer" }
];

describe("legacy parity", () => {
  it("reads the catalog from the migration", () => {
    expect(modules.length).toBeGreaterThan(30);
    expect(permissions.length).toBeGreaterThan(100);
    expect(rolePermissions.length).toBeGreaterThan(200);
    // Every seeded role permission names a real permission.
    const known = new Set(permissions.map((p) => p.key));
    expect(rolePermissions.filter((rp) => !known.has(rp.permissionKey))).toEqual([]);
  });

  for (const role of ["administrator", "staff", "receptionist", "case_manager", "job_developer"]) {
    for (const workforceOn of [false, true]) {
      for (const programRoles of PROGRAM_ROLE_CASES) {
        it(`${role}, workforce access ${workforceOn ? "on" : "off"}, program roles ${JSON.stringify(programRoles)}`, () => {
          const { assignments, programs } = legacyAccess(role, workforceOn, programRoles);
          const effective = resolveEffectivePermissions({
            active: true, modules, permissions, roles, rolePermissions,
            roleAssignments: assignments, programAccess: programs, overrides: []
          });
          const expected = navItemsForRole(role, workforceOn ? [role] : [], programRoles);
          expect(navItemsFromPermissions(effective).slice().sort()).toEqual(expected.slice().sort());
        });
      }
    }
  }

  it("administrators hold no SNAP case data and no sensitive data outside their legacy role", () => {
    const { assignments, programs } = legacyAccess("administrator", false, {});
    const keys = resolveEffectivePermissions({
      active: true, modules, permissions, roles, rolePermissions, roleAssignments: assignments, programAccess: programs
    }).map((r) => r.permissionKey);
    expect(keys.filter((k) => k.startsWith("snap.cases") || k.startsWith("snap.contacts"))).toEqual([]);
    expect(keys).toContain("snap.staff.manage");
  });

  it("System Administrator and Executive Oversight hold no sensitive participant permissions", () => {
    const sensitive = new Set([...sql.matchAll(/\('([a-z_.]+)', '[a-z_.]+', (?:true|false), 'sensitive'/g)].map((m) => m[1]));
    const leaked = rolePermissions.filter((rp) => (rp.roleId === "system_administrator" || rp.roleId === "executive_oversight") && sensitive.has(rp.permissionKey));
    expect(leaked).toEqual([]);
  });
});
