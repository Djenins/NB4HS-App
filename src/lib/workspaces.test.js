// Workspaces, landing and the nav-items source (Phase 4a).
import { describe, expect, it, vi } from "vitest";

vi.mock("./supabase.js", () => ({ supabase: null }));
const { WORKSPACES, SHARED_ITEMS, landingItem, navKeyForPath, pickWorkspace, visibleWorkspaces, workspaceOfItem } = await import("./workspaces.js");
const { resolveNavItems } = await import("./useNavItems.js");
const { NAV_ORDER } = await import("./modules.js");
const { navItemsForRole } = await import("./nav.js");

describe("registry", () => {
  it("places every navigation page in exactly one workspace or the shared links", () => {
    const placed = WORKSPACES.flatMap((w) => w.items).concat(SHARED_ITEMS);
    expect(placed.slice().sort()).toEqual(NAV_ORDER.slice().sort());
    expect(new Set(placed).size).toBe(placed.length);
  });
});

describe("workspaces per account type", () => {
  const ws = (role, wf) => visibleWorkspaces(navItemsForRole(role, wf ? [role] : [], {})).map((w) => w.key);
  it("matches what each account type can open today", () => {
    // Administrators open SNAP to manage its program staff (no case data).
    expect(ws("administrator")).toEqual(["home", "students", "workforce", "case_management", "snap", "food_distribution", "admin"]);
    expect(ws("staff")).toEqual(["home", "food_distribution"]);
    expect(ws("receptionist")).toEqual(["home"]);
    expect(ws("case_manager")).toEqual(["home", "students", "case_management"]);
    expect(ws("job_developer")).toEqual(["home", "students", "workforce"]);
    expect(ws("case_manager", true)).toEqual(["home", "students", "workforce", "case_management"]);
  });
  it("adds SNAP for outreach program staff", () => {
    expect(visibleWorkspaces(navItemsForRole("staff", [], { snap: "worker" })).map((w) => w.key)).toContain("snap");
  });
});

describe("current workspace", () => {
  const all = visibleWorkspaces(navItemsForRole("administrator", [], {}));
  it("follows the page, then the last choice, then the primary workspace", () => {
    expect(pickWorkspace(all, "/workforce/employers/42", "home", null)).toBe("workforce");
    expect(pickWorkspace(all, "/admin/roles", null, null)).toBe("admin");
    expect(pickWorkspace(all, "/calendar", "students", null)).toBe("students");
    expect(pickWorkspace(all, "/clients/NB-1", null, "case_management")).toBe("case_management");
    const staff = visibleWorkspaces(navItemsForRole("staff", [], {}));
    expect(pickWorkspace(staff, "/clients/NB-1", "snap", null)).toBe("home"); // can't open SNAP
  });
  it("maps paths to pages", () => {
    expect(navKeyForPath("/snap/cases")).toBe("outreach");
    expect(navKeyForPath("/workforce")).toBe("workforcedashboard");
    expect(navKeyForPath("/workforce/employers/42")).toBe("employers");
    expect(navKeyForPath("/students/assessments")).toBe("assessments");
    expect(navKeyForPath("/students")).toBe("students");
    expect(navKeyForPath("/admin/settings")).toBe("settings");
    expect(navKeyForPath("/admin/roles/r1")).toBe("users");
    expect(navKeyForPath("/clients/NB-1")).toBeNull();
    expect(workspaceOfItem("assessments")).toBe("students");
  });
});

describe("landing page", () => {
  it("is the first page of the primary workspace, else the first page", () => {
    const admin = navItemsForRole("administrator", [], {});
    expect(landingItem(admin, "students")).toBe("students");
    expect(landingItem(admin, "snap")).toBe("outreach");
    expect(landingItem(navItemsForRole("staff", [], {}), "snap")).toBe("dashboard");
    expect(landingItem(navItemsForRole("receptionist", [], {}), null)).toBe("checkin");
    expect(landingItem([], null)).toBeNull();
  });
});

describe("landing without a primary workspace", () => {
  it("is the same first page as before for every account type", () => {
    for (const role of ["administrator", "staff", "receptionist", "case_manager", "job_developer"]) {
      for (const wf of [false, true]) {
        for (const pr of [{}, { snap: "worker" }, { staff_reports: "reviewer" }]) {
          const items = navItemsForRole(role, wf ? [role] : [], pr);
          expect(landingItem(items, null)).toBe(items[0]);
        }
      }
    }
  });
});

describe("nav items source", () => {
  const base = { role: "staff", workforceRoleAccess: [], programRoles: {} };
  it("uses permissions once they've loaded", () => {
    const r = resolveNavItems(Object.assign({}, base, { model: "permissions", permissionsLoaded: true, permissions: [{ permissionKey: "calendar.view", programKey: "" }] }));
    expect(r).toEqual({ items: ["calendar", "availability"], source: "permissions" });
  });
  it("falls back to the account type while loading, if the call failed, or under the legacy switch", () => {
    expect(resolveNavItems(Object.assign({}, base, { model: "permissions", permissionsLoaded: false, permissions: [] })).source).toBe("legacy-loading");
    expect(resolveNavItems(Object.assign({}, base, { model: "permissions", permissionsLoaded: true, permissionsFailed: true, permissions: [] })).source).toBe("legacy-fallback");
    expect(resolveNavItems(Object.assign({}, base, { model: "permissions", permissionsLoaded: true, permissions: null })).source).toBe("legacy-fallback");
    const legacy = resolveNavItems(Object.assign({}, base, { model: "legacy", permissionsLoaded: true, permissions: [{ permissionKey: "calendar.view" }] }));
    expect(legacy.source).toBe("legacy");
    expect(legacy.items).toEqual(navItemsForRole("staff", [], {}));
  });
  // Regression: an empty answer used to fall back to the account-type pages,
  // so a deactivated account, one with every page denied, or one whose
  // modules were switched off kept its old sidebar and routes.
  it("an empty answer that loaded is the real answer, not a reason to fall back", () => {
    for (const role of ["administrator", "staff", "receptionist", "case_manager", "job_developer"]) {
      const r = resolveNavItems({ role, workforceRoleAccess: [], programRoles: { snap: "worker" }, model: "permissions", permissionsLoaded: true, permissionsFailed: false, permissions: [] });
      expect(r).toEqual({ items: [], source: "permissions" });
    }
  });
  it("a failed call never wins over an answer that arrives later", () => {
    const failed = resolveNavItems(Object.assign({}, base, { model: "permissions", permissionsLoaded: true, permissionsFailed: true, permissions: [] }));
    expect(failed.items).toEqual(navItemsForRole("staff", [], {}));
    const ok = resolveNavItems(Object.assign({}, base, { model: "permissions", permissionsLoaded: true, permissionsFailed: false, permissions: [{ permissionKey: "calendar.view", programKey: "" }] }));
    expect(ok.items).toEqual(["calendar", "availability"]);
  });
});
