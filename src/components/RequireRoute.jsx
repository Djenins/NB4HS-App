// RequireRoute.jsx -- route-level access guard. Shell.jsx only checks
// whether a session exists, not its role; it hides nav items the current
// role shouldn't see via navItemsForRole(), but a signed-in user who types
// an unlisted URL (e.g. a case_manager hitting /users) still got the real
// page rendered. This wraps a route's element and redirects to /dashboard
// if `routeKey` isn't one of the items navItemsForRole(role) returns for
// the current session -- the same rule the sidebar already uses, so access
// and visibility can't drift apart.
import { Navigate } from "react-router-dom";
import { useApp } from "../context/AppContext.jsx";
import { navItemsForRole } from "../lib/nav.js";

export default function RequireRoute({ routeKey, children }) {
  const { session, authLoading } = useApp();
  if (authLoading) return null;
  const role = session ? session.role : null;
  const allowed = role && navItemsForRole(role).indexOf(routeKey) !== -1;
  if (!allowed) return <Navigate to="/dashboard" replace />;
  return children;
}
