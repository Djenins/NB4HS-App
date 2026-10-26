// JobOpeningGridCard.jsx -- one job opening as a card in the Job Openings
// grid view. Same record, same actions and the same View target as
// JobOpeningListItem.jsx, laid out for a narrow column: status and employer
// up top, the details stacked, posted date and referral count in the
// footer.
import { ArrowRight, Building2, CalendarDays, MapPin, Users } from "lucide-react";
import { useT } from "../context/AppContext.jsx";
import { employmentTypeLabel, formatPayRange, statusLabel } from "../lib/jobOpenings.js";
import { fmtDateLong } from "../lib/utils.js";
import JobOpeningActionsMenu from "./JobOpeningActionsMenu.jsx";
import { Button } from "./ui/button.jsx";
import { Card } from "./ui/card.jsx";
import { StatusBadge } from "./ui/status-badge.jsx";

export default function JobOpeningGridCard({ opening, referralCount, lang, onView, onEdit, onRefer, onArchive, onDelete }) {
  const t = useT();
  const pay = formatPayRange(opening);
  const type = employmentTypeLabel(opening.employmentType);

  return (
    <Card interactive className="flex h-full flex-col p-5">
      <div className="flex items-start justify-between gap-2">
        <StatusBadge domain="opening" status={opening.status}>{statusLabel(opening.status)}</StatusBadge>
        <JobOpeningActionsMenu
          opening={opening} onView={onView} onEdit={onEdit} onRefer={onRefer} onArchive={onArchive} onDelete={onDelete}
        />
      </div>

      <h3 className="m-0 mt-2 text-section font-semibold text-card-foreground [overflow-wrap:anywhere]">{opening.title}</h3>

      <div className="mb-4 mt-3 flex flex-col gap-1.5 text-ui text-card-foreground">
        <span className="flex min-w-0 items-center gap-2">
          <Building2 className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
          <span className="truncate">{opening.employerName || "—"}</span>
        </span>
        {opening.employerCity && (
          <span className="flex min-w-0 items-center gap-2">
            <MapPin className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
            <span className="truncate">{opening.employerCity}</span>
          </span>
        )}
        {(type || pay) && (
          <span className="flex flex-wrap items-center gap-x-2 tabular-nums">
            {type}{type && pay ? <span className="text-muted" aria-hidden="true">•</span> : null}{pay}
          </span>
        )}
      </div>

      <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-line-subtle pt-3 text-meta tabular-nums text-muted">
        <span className="flex items-center gap-1.5">
          <CalendarDays className="h-4 w-4 shrink-0" aria-hidden="true" />
          {fmtDateLong(opening.postedDate, lang)}
        </span>
        <span className="flex items-center gap-1.5">
          <Users className="h-4 w-4 shrink-0" aria-hidden="true" />
          {referralCount} {referralCount === 1 ? t("matchLabel") : t("matchesLabel")}
        </span>
      </div>

      <Button variant="secondary" className="mt-3 w-full" onClick={function () { onView(opening); }}>
        {t("viewLabel")} <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </Button>
    </Card>
  );
}
