// DashboardOpeningRow.jsx -- one job opening in the Workforce Dashboard's
// "Recent Job Opportunities" panel. Deliberately lighter than
// JobOpeningListItem.jsx: a dashboard panel is a glance, not a work surface,
// so this carries no actions menu and no per-row navigation -- the panel's
// one "View all" button is the way through to the real list.
//
// Rendered as a divided list row (the panel draws the rules), not a bordered
// box, so the SectionCard doesn't hold a stack of cards.
import { Briefcase, MapPin, Users } from "lucide-react";
import { useApp, useT } from "../context/AppContext.jsx";
import { formatPayRange, statusLabel } from "../lib/jobOpenings.js";
import { StatusBadge } from "./ui/status-badge.jsx";

export default function DashboardOpeningRow({ opening, referralCount }) {
  const t = useT();
  const { lang } = useApp();
  const meta = [opening.employerCity, formatPayRange(opening)].filter(Boolean);

  return (
    <div className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-ui font-semibold text-card-foreground [overflow-wrap:anywhere]">{opening.title}</div>
          <div className="mt-0.5 text-meta text-muted [overflow-wrap:anywhere]">{opening.employerName || "—"}</div>
        </div>
        <StatusBadge domain="opening" status={opening.status} className="shrink-0">{statusLabel(opening.status, lang)}</StatusBadge>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-meta text-muted">
        {meta.length > 0 && (
          <span className="flex min-w-0 items-center gap-1.5">
            <MapPin className="h-4 w-4 shrink-0" aria-hidden="true" /> {meta.join(" • ")}
          </span>
        )}
        <span className="flex items-center gap-1.5 tabular-nums">
          <Briefcase className="h-4 w-4 shrink-0" aria-hidden="true" />
          {opening.openingsCount} {t("openingsCountLabel")}
        </span>
        <span className="flex items-center gap-1.5 tabular-nums">
          <Users className="h-4 w-4 shrink-0" aria-hidden="true" />
          {referralCount} {referralCount === 1 ? t("referralLabel") : t("referralsLabel")}
        </span>
      </div>
    </div>
  );
}
