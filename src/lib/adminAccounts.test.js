// The Administration area's pure rules. The database enforces the real
// ones (supabase/tests/p2_admin_check.sql); these decide what the screens
// show.
import { readdirSync, readFileSync } from "node:fs";
import { join, resolve as resolvePath } from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("./supabase.js", () => ({ supabase: null }));
const {
  accountStatus, adminErrorKey, assignableRoles, filterAccounts, groupRolePermissions, sortAccounts
} = await import("./adminAccounts.js");
const { navPath } = await import("./nav.js");
const { adminSectionsFor } = await import("../pages/Admin.jsx");
const { STR } = await import("./i18n.js");

function acct(over) {
  return Object.assign({ id: "u", name: "Ann", email: "ann@nb4hs.org", role: "staff", active: true, invitedAt: null, deactivatedAt: null, lastSignInAt: "2026-10-01T00:00:00Z", positions: [], roles: [] }, over);
}

describe("account status", () => {
  it("names the four states", () => {
    expect(accountStatus(acct({}))).toBe("active");
    expect(accountStatus(acct({ invitedAt: "2026-10-20", lastSignInAt: null }))).toBe("invited");
    expect(accountStatus(acct({ invitedAt: "2026-10-20" }))).toBe("active"); // accepted
    expect(accountStatus(acct({ active: false }))).toBe("inactive");
    expect(accountStatus(acct({ active: false, deactivatedAt: "2026-10-25" }))).toBe("deactivated");
  });
});

describe("filtering and sorting accounts", () => {
  const list = [
    acct({ id: "1", name: "Zoe", email: "z@x.org", positions: [{ id: "p", name: "Case Manager" }] }),
    acct({ id: "2", name: "adam", email: "a@x.org", role: "receptionist", active: false }),
    acct({ id: "3", name: "", email: "m@x.org", lastSignInAt: null, invitedAt: "2026-10-26" })
  ];
  it("searches name, email and position; filters status and type", () => {
    expect(filterAccounts(list, { query: "case" }).map((u) => u.id)).toEqual(["1"]);
    expect(filterAccounts(list, { query: "M@X" }).map((u) => u.id)).toEqual(["3"]);
    expect(filterAccounts(list, { status: "inactive" }).map((u) => u.id)).toEqual(["2"]);
    expect(filterAccounts(list, { role: "staff" }).map((u) => u.id)).toEqual(["1", "3"]);
  });
  it("sorts by name (falling back to email), status and last sign-in", () => {
    expect(sortAccounts(list, { key: "name", dir: "asc" }).map((u) => u.id)).toEqual(["2", "3", "1"]);
    expect(sortAccounts(list, { key: "status", dir: "asc" }).map((u) => u.id)).toEqual(["1", "3", "2"]);
    expect(sortAccounts(list, { key: "lastSignIn", dir: "desc" })[0].id).not.toBe("3");
  });
});

describe("roles", () => {
  it("only offers live, non-automatic roles for assignment", () => {
    const roles = [{ id: "a", kind: "custom" }, { id: "b", kind: "legacy" }, { id: "c", kind: "builtin" }, { id: "d", kind: "custom", archivedAt: "x" }];
    expect(assignableRoles(roles).map((r) => r.id)).toEqual(["a", "c"]);
  });
  it("groups a role's permissions under their modules in catalogue order", () => {
    const modules = [{ key: "students" }, { key: "students.assessments" }, { key: "calendar" }];
    const permissions = [
      { key: "students.view", moduleKey: "students", label: "Open", sortOrder: 1 },
      { key: "students.edit", moduleKey: "students", label: "Edit", sortOrder: 3 },
      { key: "calendar.view", moduleKey: "calendar", label: "See", sortOrder: 1 }
    ];
    const groups = groupRolePermissions(
      [{ permissionKey: "calendar.view" }, { permissionKey: "students.edit", scope: "assigned" }, { permissionKey: "students.view", scope: "program" }],
      permissions, modules
    );
    expect(groups.map((g) => g.module.key)).toEqual(["students", "calendar"]);
    expect(groups[0].permissions.map((p) => [p.key, p.scope])).toEqual([["students.view", "program"], ["students.edit", "assigned"]]);
  });
});

describe("error messages", () => {
  it("maps database and Edge Function refusals", () => {
    expect(adminErrorKey({ message: "you cannot do this to your own account" })).toBe("adminErrSelf");
    expect(adminErrorKey({ message: "only a System Administrator can do this to an administrator" })).toBe("adminErrSystemAdminOnly");
    expect(adminErrorKey({ message: "this role includes permissions you do not hold: x" })).toBe("adminErrEscalation");
    expect(adminErrorKey({ message: "this would leave no active System Administrator" })).toBe("adminErrLastAdmin");
    expect(adminErrorKey({ message: "already_registered" })).toBe("adminErrAlreadyRegistered");
    expect(adminErrorKey({ message: "email_failed: smtp" })).toBe("adminErrEmailFailed");
    expect(adminErrorKey({ code: "42501", message: "new row violates row-level security policy" })).toBe("adminErrForbidden");
    expect(adminErrorKey({ message: "boom" })).toBe("userActionError");
  });
});

describe("navigation", () => {
  it("sends Users to Administration and opens only permitted sections", () => {
    expect(navPath("users")).toBe("/admin/users");
    expect(navPath("calendar")).toBe("/calendar");
    const held = (keys) => (k) => keys.indexOf(k) !== -1;
    expect(adminSectionsFor(held(["admin.users.view", "admin.roles.view", "admin.positions.manage"]))).toEqual(["users", "roles", "positions"]);
    expect(adminSectionsFor(held(["admin.roles.view"]))).toEqual(["roles"]);
    expect(adminSectionsFor(held([]))).toEqual([]);
  });
});

describe("strings", () => {
  it("every key the Administration screens use exists", () => {
    const root = resolvePath(__dirname, "..");
    const files = [join(root, "pages/Admin.jsx"), join(root, "pages/ResetPassword.jsx"), join(root, "lib/adminAccounts.js")]
      .concat(readdirSync(join(root, "components/admin")).filter((f) => !/\.test\./.test(f)).map((f) => join(root, "components/admin", f)));
    const used = new Set();
    files.forEach((f) => {
      const src = readFileSync(f, "utf8");
      for (const m of src.matchAll(/\bt\("([A-Za-z0-9_]+)"\)/g)) used.add(m[1]);
      for (const m of src.matchAll(/"(admin[A-Z][A-Za-z0-9]+)"/g)) used.add(m[1]);
    });
    expect([...used].filter((k) => !STR[k])).toEqual([]);
  });
});
