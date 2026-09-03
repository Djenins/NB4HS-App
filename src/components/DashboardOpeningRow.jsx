// DashboardOpeningRow.jsx -- one job opening in the Workforce Dashboard's
// "Recent Job Opportunities" panel. Deliberately lighter than
// JobOpeningListItem.jsx: a dashboard panel is a glance, not a work surface,
// so this carries no actions menu and no per-row navigation -- the panel's
// one "View all" button is the way through to the real list.
import { Briefcase, MapPin, Users } from "lucide-react";
import { useT } from "../context/AppContext.jsx";
import { formatPayRange, statusBadgeVariant, statusLabel } from "../lib/jobOpenings.js";
import { Badge } from "./ui/badge.jsx";

export default function DashboardOpeningRow({ opening, referralCount }) {
  const t = useT();
  const meta = [opening.employerCity, formatPayRange(opening)].filter(Boolean);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-[12px] border border-border px-4 py-3 transition-colors hover:border-primary-soft">
      <div className="min-w-0">
        <div className="truncate text-sm font-bold text-card-foreground">{opening.title}</div>
        <div className="mt-0.5 truncate text-sm text-muted">{opening.employerName || "—"}</div>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
        {meta.length > 0 && (
          <span className="flex items-center gap-1.5">
            <MapPin className="h-4 w-4 shrink-0" aria-hidden="true" /> {meta.join(" • ")}
          </span>
        )}
        <span className="flex items-center gap-1.5">
          <Briefcase className="h-4 w-4 shrink-0" aria-hidden="true" />
          {opening.openingsCount} {t("openingsCountLabel")}
        </span>
        <span className="flex items-center gap-1.5">
          <Users className="h-4 w-4 shrink-0" aria-hidden="true" />
          {referralCount} {referralCount === 1 ? t("referralLabel") : t("referralsLabel")}
        </span>
        <Badge variant={statusBadgeVariant(opening.status)}>{statusLabel(opening.status)}</Badge>
      </div>
    </div>
  );
}
