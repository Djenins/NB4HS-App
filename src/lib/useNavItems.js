// useNavItems.js -- the one place that decides which pages the signed-in
// person can open. Sidebar, route guards, landing and the pages that adapt to
// access (Workforce tabs, Dashboard and Reports panels) all read this, so
// visibility and access can't drift apart.
//
// Under the permissions model the list comes from my_permissions(). Until
// those have loaded -- or if they come back empty because the call failed --
// it falls back to the old account-type lists, which give the same answer for
// every existing account (parity-checked), so nobody sees an empty sidebar or
// gets bounced while the page loads.
import { useMemo } from "react";
import { useApp } from "../context/AppContext.jsx";
import { navItemsFromPermissions } from "./modules.js";
import { enabledWorkforceRoles, navItemsForRole } from "./nav.js";
import { AUTH_MODEL } from "./workspaces.js";

// Pure version, for tests and for StaffLogin (before the context has loaded).
export function resolveNavItems({ model, role, workforceRoleAccess, programRoles, permissions, permissionsLoaded }) {
  var legacy = role ? navItemsForRole(role, enabledWorkforceRoles(workforceRoleAccess), programRoles) : [];
  if (model !== "permissions") return { items: legacy, source: "legacy" };
  if (!permissionsLoaded || !permissions || !permissions.length) return { items: legacy, source: permissionsLoaded ? "legacy-fallback" : "legacy-loading" };
  return { items: navItemsFromPermissions(permissions), source: "permissions" };
}

export function useNavItems() {
  const { session, data, permissions, permissionsLoaded } = useApp();
  const role = session ? session.role : null;
  return useMemo(() => resolveNavItems({
    model: AUTH_MODEL, role, workforceRoleAccess: data.workforceRoleAccess, programRoles: data.programRoles,
    permissions, permissionsLoaded
  }), [role, data.workforceRoleAccess, data.programRoles, permissions, permissionsLoaded]);
}
