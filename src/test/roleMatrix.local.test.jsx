// roleMatrix.local.test.jsx -- every seeded account against the LOCAL
// Supabase stack (supabase/seed.sql): signs in for real, reads its own
// profile, program roles and my_permissions() the way the app does, then asks
// the app's own route guard (routeAllowed) and Admin page (adminSectionsFor)
// about every staff route.
//
// Two things are checked per account:
//   * the pages the permission model opens equal the pages the old account
//     types opened (the migration promise: nobody's access changed), apart
//     from changes an owner decided on purpose (`removed`), and
//   * a handful of pages each role must never reach.
//
// Skipped unless NB4HS_LOCAL_DB=1 (CI has no database):
//   NB4HS_LOCAL_DB=1 npx vitest run src/test/roleMatrix.local.test.jsx
import { createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { routeAllowed } from "../components/RequireRoute.jsx";
import { adminSectionsFor } from "../pages/Admin.jsx";
import { can } from "../lib/permissions.js";
import { profileToSession } from "../lib/supabaseAuth.js";
import { resolveNavItems } from "../lib/useNavItems.js";

const LOCAL = process.env.NB4HS_LOCAL_DB === "1";
const URL = process.env.NB4HS_LOCAL_URL || "http://127.0.0.1:55321";
const KEY = process.env.NB4HS_LOCAL_ANON_KEY;
const PASSWORD = "local-dev-only";

// Every routeKey App.jsx guards (plus the checkin/search pair).
const ROUTE_KEYS = [
  "assessments", "availability", "calendar", "candidatematching", "casemanagement", "checkin", "checkout",
  "clients", "dashboard", "employers", "fooddistribution", "jobdeveloper", "jobopenings", "manage", "mycaseload",
  "myreports", "outreach", "placements", "profile", "qrcode", "referrals", "reports", "search", "settings",
  "staffreports", "students", "workforcedashboard", "workforcereports"
];

const ACCOUNTS = {
  "admin1@example.test": { never: [] },
  "staff@example.test": { never: ["casemanagement", "jobdeveloper", "settings", "students", "staffreports"], admin: [] },
  // t3 (owner decision): receptionists keep check-in and lose client
  // profiles, which the old account-type rules still allowed.
  "frontdesk@example.test": { never: ["dashboard", "casemanagement", "outreach", "settings", "search", "clients", "staffreports"], admin: [], removed: ["clients"] },
  "casemgr@example.test": { never: ["jobdeveloper", "settings", "staffreports"], admin: [] },
  "jobdev@example.test": { never: ["casemanagement", "outreach", "settings", "staffreports"], admin: [] }
};

async function signIn(email) {
  const sb = createClient(URL, KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await sb.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) throw error;
  const uid = data.user.id;
  const profile = (await sb.from("profiles").select("*").eq("id", uid).single()).data;
  const roles = (await sb.from("program_staff").select("program, program_role").eq("user_id", uid).eq("active", true)).data || [];
  const programRoles = roles.reduce((acc, r) => { acc[r.program] = r.program_role; return acc; }, {});
  const workforceRoleAccess = (await sb.from("workforce_role_access").select("*")).data || [];
  const rpc = await sb.rpc("my_permissions");
  if (rpc.error) throw rpc.error;
  const permissions = rpc.data.map((r) => ({ permissionKey: r.permission_key, programKey: r.program_key || "", scope: r.scope || null }));
  return { sb, profile, programRoles, workforceRoleAccess, permissions };
}

function routesFor(items, permissions, fromPermissions) {
  const opts = { can: (k, p) => can(permissions, k, p), fromPermissions };
  return ROUTE_KEYS.filter((k) => routeAllowed(k, items, opts));
}

describe.skipIf(!LOCAL || !KEY)("role matrix on the local stack", () => {
  Object.keys(ACCOUNTS).forEach((email) => {
    it(email + ": permission pages equal the account-type pages, and the forbidden ones stay shut", async () => {
      const a = await signIn(email);
      expect(profileToSession(a.profile)).not.toBeNull();
      const base = { role: a.profile.role, workforceRoleAccess: a.workforceRoleAccess, programRoles: a.programRoles };
      const legacy = resolveNavItems({ ...base, model: "legacy" });
      const perm = resolveNavItems({ ...base, model: "permissions", permissions: a.permissions, permissionsLoaded: true, permissionsFailed: false });
      expect(perm.source).toBe("permissions");

      const permRoutes = routesFor(perm.items, a.permissions, true);
      const removed = ACCOUNTS[email].removed || [];
      const legacyRoutes = routesFor(legacy.items, a.permissions, false).filter((k) => removed.indexOf(k) === -1);
      expect(permRoutes).toEqual(legacyRoutes);
      ACCOUNTS[email].never.forEach((k) => expect(permRoutes, k).not.toContain(k));
      if (ACCOUNTS[email].admin) expect(adminSectionsFor((k) => can(a.permissions, k))).toEqual(ACCOUNTS[email].admin);
      await a.sb.auth.signOut();
    });
  });

  it("the administrator reaches every Admin section", async () => {
    const a = await signIn("admin1@example.test");
    expect(adminSectionsFor((k) => can(a.permissions, k))).toEqual(["users", "roles", "positions", "programs", "audit"]);
  });

  it("a deactivated account holds nothing and is not a session", async () => {
    const a = await signIn("inactive@example.test");
    expect(profileToSession(a.profile)).toBeNull();
    expect(a.permissions).toEqual([]);
    const nav = resolveNavItems({ model: "permissions", role: a.profile.role, permissions: a.permissions, permissionsLoaded: true, permissionsFailed: false });
    expect(nav).toEqual({ items: [], source: "permissions" });
    expect(routesFor(nav.items, a.permissions, true)).toEqual(["profile"]);
  });
});
