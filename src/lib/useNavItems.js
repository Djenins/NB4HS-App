// useNavItems.js -- the one place that decides which pages the signed-in
// person can open. Sidebar, route guards, landing and the pages that adapt to
// access (Workforce tabs, Dashboard and Reports panels) all read this, so
// visibility and access can't drift apart.
//
// Under the permissions model the list comes from my_permissions(). Until
// those have loaded -- or if the call failed -- it falls back to the old
// account-type lists, which give the same answer for every existing account
// (parity-checked), so nobody sees an empty sidebar while the page loads.
// RequireRoute waits out the loading state rather than open a page on it.
// An answer that loaded but is empty is the real answer (a deactivated
// account, every page denied or switched off): no pages, never the old list.
import { useMemo } from "react";
import { useApp } from "../context/AppContext.jsx";
import { navItemsFromPermissions } from "./modules.js";
import { enabledWorkforceRoles, navItemsForRole } from "./nav.js";
import { AUTH_MODEL } from "./workspaces.js";

// Pure version, for tests and for StaffLogin (before the context has loaded).
export function resolveNavItems({ model, role, workforceRoleAccess, programRoles, permissions, permissionsLoaded, permissionsFailed }) {
  var legacy = role ? navItemsForRole(role, enabledWorkforceRoles(workforceRoleAccess), programRoles) : [];
  if (model !== "permissions") return { items: legacy, source: "legacy" };
  if (!permissionsLoaded) return { items: legacy, source: "legacy-loading" };
  if (permissionsFailed || !permissions) return { items: legacy, source: "legacy-fallback" };
  return { items: navItemsFromPermissions(permissions), source: "permissions" };
}

export function useNavItems() {
  const { session, data, permissions, permissionsLoaded, permissionsFailed } = useApp();
  const role = session ? session.role : null;
  return useMemo(() => resolveNavItems({
    model: AUTH_MODEL, role, workforceRoleAccess: data.workforceRoleAccess, programRoles: data.programRoles,
    permissions, permissionsLoaded, permissionsFailed
  }), [role, data.workforceRoleAccess, data.programRoles, permissions, permissionsLoaded, permissionsFailed]);
}
