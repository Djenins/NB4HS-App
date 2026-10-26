// RequireRoute.jsx -- route-level access guard, now on every staff route
// (plans/unified-access-architecture.md §7.1; it used to cover 21 of 35).
// It asks the same question as the sidebar -- useNavItems() -- so a page
// that isn't in someone's sidebar can't be opened by typing its URL either.
//
//   routeKey  the nav key the page belongs to ("employers", "students"...),
//             one of the non-sidebar pages below, or a list (any one opens it)
//   kiosk     the page also works in kiosk mode (no one signed in): the
//             check-in / check-out screens and the public appointment pages
//
// A refused page redirects to the person's own landing page (not a fixed
// /dashboard: a receptionist has no dashboard, which used to loop).
import { Navigate } from "react-router-dom";
import { useApp } from "../context/AppContext.jsx";
import { navPath } from "../lib/nav.js";
import { useNavItems } from "../lib/useNavItems.js";
import { WORKSPACES, landingItem } from "../lib/workspaces.js";

const WORKFORCE_ITEMS = WORKSPACES.find((w) => w.key === "workforce").items;

// Can these nav items (and, under the permissions model, these permissions)
// open this page? Pages that aren't sidebar items:
//   clients    a client's profile -- anyone who can read participant records
//   workforce  the combined Workforce page -- anyone with a Workforce page
export function routeAllowed(routeKey, items, opts) {
  if (Array.isArray(routeKey)) return routeKey.some((k) => routeAllowed(k, items, opts));
  if (routeKey === "clients") return items.length > 0 && (!opts.fromPermissions || opts.can("participants.view"));
  if (routeKey === "workforce") return items.some((k) => WORKFORCE_ITEMS.indexOf(k) !== -1);
  return items.indexOf(routeKey) !== -1;
}

export default function RequireRoute({ routeKey, kiosk: kioskOk, children }) {
  const { session, authLoading, kiosk, can } = useApp();
  const { items, source } = useNavItems();
  if (authLoading) return null;
  if (kiosk && kioskOk) return children;
  if (!session) return <Navigate to="/" replace />;
  if (routeAllowed(routeKey, items, { can, fromPermissions: source === "permissions" })) return children;
  const landing = landingItem(items, session.primaryWorkspace);
  return <Navigate to={landing ? navPath(landing) : "/"} replace />;
}
