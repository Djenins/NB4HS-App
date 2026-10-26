// GuardedLink.jsx -- a react-router Link that only renders when the signed-in
// person can open the page it points to (the same rule as RequireRoute), so
// a page shared by several roles never offers a link that would bounce
// someone. routeLinks.test.js treats these links as safe.
//
//   <GuardedLink to="/search" routeKey="search" className=...>View all</GuardedLink>
import { Link } from "react-router-dom";
import { useApp } from "../context/AppContext.jsx";
import { useNavItems } from "../lib/useNavItems.js";
import { routeAllowed } from "./RequireRoute.jsx";

export default function GuardedLink({ routeKey, to, children, ...rest }) {
  const { can } = useApp();
  const { items, source } = useNavItems();
  if (!routeAllowed(routeKey, items, { can, fromPermissions: source === "permissions" })) return null;
  return <Link to={to} {...rest}>{children}</Link>;
}
