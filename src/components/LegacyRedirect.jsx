// LegacyRedirect.jsx -- sends an earlier address to its page's new home
// (routes.js LEGACY_REDIRECTS), carrying URL parameters, the query string and
// any navigation state across, and replacing the history entry.
import { Navigate, useLocation, useParams } from "react-router-dom";
import { fillPath } from "../lib/routes.js";

export default function LegacyRedirect({ to }) {
  const params = useParams();
  const location = useLocation();
  return <Navigate to={fillPath(to, params) + location.search} state={location.state} replace />;
}
