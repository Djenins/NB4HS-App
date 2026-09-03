// PlacementListItem.jsx -- one placement as a full-width row in the
// Placements list view (the default). Clicking the row still opens
// PlacementDetail (/placements/:id), exactly as the table row it replaces
// did. PlacementGridCard.jsx is the same record in the grid view.
import { ArrowRight, CalendarDays, Clock, DollarSign, UserRound } from "lucide-react";
import { useT } from "../context/AppContext.jsx";
import { placementStatusBadgeVariant, placementStatusLabel } from "../lib/placements.js";
import { fmtDateLong } from "../lib/utils.js";
import PlacementCheckinDots from "./PlacementCheckinDots.jsx";
import { Badge } from "./ui/badge.jsx";
import { Card } from "./ui/card.jsx";

export default function PlacementListItem({ placement, checkins, lang, onOpen }) {
  const t = useT();
  const p = placement;

  return (
    <Card
      role="button"
      tabIndex={0}
      onClick={function () { onOpen(p); }}
      onKeyDown={function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(p); } }}
      className="cursor-pointer p-5 shadow-card transition-colors hover:border-primary-soft hover:shadow-card"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="m-0 truncate text-base font-bold leading-tight text-card-foreground">{p.participantName || "—"}</h3>
          <p className="m-0 mt-1 truncate text-sm text-muted">
            {[p.positionTitle, p.employerName].filter(Boolean).join(" · ") || "—"}
          </p>
        </div>
        <Badge variant={placementStatusBadgeVariant(p.currentStatus)}>{placementStatusLabel(p.currentStatus)}</Badge>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-card-foreground">
        <span className="flex items-center gap-1.5">
          <CalendarDays className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
          {t("jobStartDateLabel")}: {fmtDateLong(p.startDate, lang)}
        </span>
        {p.hourlyWage ? (
          <span className="flex items-center gap-1.5">
            <DollarSign className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
            {p.hourlyWage}{t("perHourSuffix")}
          </span>
        ) : null}
        {p.hoursPerWeek ? (
          <span className="flex items-center gap-1.5">
            <Clock className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
            {p.hoursPerWeek}
          </span>
        ) : null}
        {p.supervisorName ? (
          <span className="flex min-w-0 items-center gap-1.5">
            <UserRound className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
            <span className="truncate">{p.supervisorName}</span>
          </span>
        ) : null}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
        <PlacementCheckinDots checkins={checkins} />
        <span className="flex items-center gap-1.5 text-sm font-semibold text-primary">
          {t("viewLabel")} <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </span>
      </div>
    </Card>
  );
}
