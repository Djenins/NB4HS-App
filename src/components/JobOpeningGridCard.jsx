// JobOpeningGridCard.jsx -- one job opening as a card in the Job Openings
// grid view. Same record, same actions and the same View target as
// JobOpeningListItem.jsx, laid out for a narrow column: status and employer
// up top, the detail chips stacked, posted date and referral count in the
// footer.
import { ArrowRight, Building2, CalendarDays, MapPin, Users } from "lucide-react";
import { useT } from "../context/AppContext.jsx";
import { employmentTypeLabel, formatPayRange, statusBadgeVariant, statusLabel } from "../lib/jobOpenings.js";
import { fmtDateLong } from "../lib/utils.js";
import JobOpeningActionsMenu from "./JobOpeningActionsMenu.jsx";
import { Badge } from "./ui/badge.jsx";
import { Button } from "./ui/button.jsx";
import { Card } from "./ui/card.jsx";

export default function JobOpeningGridCard({ opening, referralCount, lang, onView, onEdit, onRefer, onArchive, onDelete }) {
  const t = useT();
  const pay = formatPayRange(opening);
  const type = employmentTypeLabel(opening.employmentType);

  return (
    <Card className="flex h-full flex-col p-5 shadow-card transition-colors hover:border-primary-soft hover:shadow-card">
      <div className="flex items-start justify-between gap-2">
        <Badge variant={statusBadgeVariant(opening.status)}>{statusLabel(opening.status)}</Badge>
        <JobOpeningActionsMenu
          opening={opening} onView={onView} onEdit={onEdit} onRefer={onRefer} onArchive={onArchive} onDelete={onDelete}
        />
      </div>

      <h3 className="m-0 mt-3 text-base font-bold leading-snug text-card-foreground">{opening.title}</h3>

      <div className="mb-4 mt-3 flex flex-col gap-1.5 text-sm text-muted">
        <span className="flex items-center gap-2">
          <Building2 className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="truncate text-card-foreground">{opening.employerName || "—"}</span>
        </span>
        {opening.employerCity && (
          <span className="flex items-center gap-2">
            <MapPin className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="truncate text-card-foreground">{opening.employerCity}</span>
          </span>
        )}
        {(type || pay) && (
          <span className="flex flex-wrap items-center gap-x-2 text-card-foreground">
            {type}{type && pay ? <span className="text-muted" aria-hidden="true">•</span> : null}{pay}
          </span>
        )}
      </div>

      <div className="mt-auto flex items-center justify-between gap-2 border-t border-border pt-3 text-sm text-muted">
        <span className="flex items-center gap-1.5">
          <CalendarDays className="h-4 w-4" aria-hidden="true" />
          {fmtDateLong(opening.postedDate, lang)}
        </span>
        <span className="flex items-center gap-1.5">
          <Users className="h-4 w-4" aria-hidden="true" />
          {referralCount} {referralCount === 1 ? t("matchLabel") : t("matchesLabel")}
        </span>
      </div>

      <Button
        variant="ghost"
        onClick={function () { onView(opening); }}
        className="mt-3 h-9 w-full justify-center gap-1.5 rounded-[10px] bg-primary-tint text-sm font-semibold text-primary hover:bg-primary-tint"
      >
        {t("viewLabel")} <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </Button>
    </Card>
  );
}
