// JobOpeningListItem.jsx -- one job opening as a full-width row in the Job
// Openings list view (the default). Title + status badge on the first line,
// employer under it, then location / employment type / pay, and a footer
// strip with the posted date, the opening's real referral count, the
// actions menu and a View button into JobOpeningDetailModal (a drawer).
//
// Every value shown comes off the existing job_openings record (or its
// referrals) -- nothing is derived or invented for the layout's sake.
import { ArrowRight, Briefcase, CalendarDays, Users } from "lucide-react";
import { useT } from "../context/AppContext.jsx";
import { employmentTypeLabel, formatPayRange, statusLabel } from "../lib/jobOpenings.js";
import { fmtDateLong } from "../lib/utils.js";
import JobOpeningActionsMenu from "./JobOpeningActionsMenu.jsx";
import { Button } from "./ui/button.jsx";
import { Card } from "./ui/card.jsx";
import { StatusBadge } from "./ui/status-badge.jsx";

export default function JobOpeningListItem({ opening, referralCount, lang, onView, onEdit, onRefer, onArchive, onDelete }) {
  const t = useT();
  const meta = [opening.employerCity, employmentTypeLabel(opening.employmentType), formatPayRange(opening)].filter(Boolean);

  return (
    <Card interactive className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="m-0 text-section font-semibold text-card-foreground [overflow-wrap:anywhere]">{opening.title}</h3>
          <p className="m-0 mt-0.5 truncate text-meta text-muted">{opening.employerName || "—"}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <StatusBadge domain="opening" status={opening.status}>{statusLabel(opening.status)}</StatusBadge>
          <JobOpeningActionsMenu
            opening={opening} onView={onView} onEdit={onEdit} onRefer={onRefer} onArchive={onArchive} onDelete={onDelete}
          />
        </div>
      </div>

      {meta.length > 0 && (
        <p className="m-0 mt-3 text-ui tabular-nums text-card-foreground">
          {meta.join(" • ")}
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line-subtle pt-3">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-meta tabular-nums text-muted">
          <span className="flex items-center gap-1.5">
            <CalendarDays className="h-4 w-4 shrink-0" aria-hidden="true" />
            {t("postedDateLabel")} {fmtDateLong(opening.postedDate, lang)}
          </span>
          <span className="flex items-center gap-1.5">
            <Users className="h-4 w-4 shrink-0" aria-hidden="true" />
            {referralCount} {referralCount === 1 ? t("matchLabel") : t("matchesLabel")}
          </span>
          <span className="flex items-center gap-1.5">
            <Briefcase className="h-4 w-4 shrink-0" aria-hidden="true" />
            {opening.openingsCount} {t("openingsCountLabel")}
          </span>
        </div>
        <Button variant="ghost" size="sm" className="text-primary hover:bg-primary-tint" onClick={function () { onView(opening); }}>
          {t("viewLabel")} <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>
    </Card>
  );
}
