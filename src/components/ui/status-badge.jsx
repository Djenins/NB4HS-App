// status-badge.jsx -- a Badge whose colour comes from lib/statusTone.js
// instead of the call site, so a status reads the same on every screen.
import { statusTone } from "../../lib/statusTone.js";
import { Badge } from "./badge.jsx";

export function StatusBadge({ domain, status, children, className }) {
  return (
    <Badge variant={statusTone(domain, status)} dot className={className}>
      {children}
    </Badge>
  );
}
