// PlacementGridCard.jsx -- one placement as a card in the Placements grid
// view. Same record, same PlacementDetail target as PlacementListItem.jsx,
// stacked for a narrow column.
import { ArrowRight, Building2, CalendarDays, Clock, DollarSign, UserRound } from "lucide-react";
import { useT } from "../context/AppContext.jsx";
import { placementStatusBadgeVariant, placementStatusLabel } from "../lib/placements.js";
import { fmtDateLong } from "../lib/utils.js";
import PlacementCheckinDots from "./PlacementCheckinDots.jsx";
import { Badge } from "./ui/badge.jsx";
import { Card } from "./ui/card.jsx";

export default function PlacementGridCard({ placement, checkins, lang, onOpen }) {
  const t = useT();
  const p = placement;

  return (
    <Card
      role="button"
      tabIndex={0}
      onClick={function () { onOpen(p); }}
      onKeyDown={function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(p); } }}
      className="flex h-full cursor-pointer flex-col p-5 shadow-card transition-colors hover:border-primary-soft hover:shadow-card"
    >
      <div className="flex items-start justify-between gap-2">
        <Badge variant={placementStatusBadgeVariant(p.currentStatus)}>{placementStatusLabel(p.currentStatus)}</Badge>
        <span className="flex items-center gap-1.5 text-sm font-semibold text-primary">
          {t("viewLabel")} <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </span>
      </div>

      <h3 className="m-0 mt-3 truncate text-base font-bold leading-snug text-card-foreground">{p.participantName || "—"}</h3>

      <div className="mb-4 mt-3 flex flex-col gap-1.5 text-sm text-muted">
        <span className="flex items-center gap-2">
          <Building2 className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="truncate text-card-foreground">
            {[p.positionTitle, p.employerName].filter(Boolean).join(" · ") || "—"}
          </span>
        </span>
        <span className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="text-card-foreground">{fmtDateLong(p.startDate, lang)}</span>
        </span>
        {(p.hourlyWage || p.hoursPerWeek) && (
          <span className="flex flex-wrap items-center gap-x-4">
            {p.hourlyWage ? (
              <span className="flex items-center gap-2 text-card-foreground">
                <DollarSign className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />{p.hourlyWage}{t("perHourSuffix")}
              </span>
            ) : null}
            {p.hoursPerWeek ? (
              <span className="flex items-center gap-2 text-card-foreground">
                <Clock className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />{p.hoursPerWeek}
              </span>
            ) : null}
          </span>
        )}
        {p.supervisorName ? (
          <span className="flex min-w-0 items-center gap-2">
            <UserRound className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="truncate text-card-foreground">{p.supervisorName}</span>
          </span>
        ) : null}
      </div>

      <div className="mt-auto border-t border-border pt-3">
        <PlacementCheckinDots checkins={checkins} />
      </div>
    </Card>
  );
}
