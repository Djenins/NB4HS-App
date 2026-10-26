// PlacementListItem.jsx -- one placement as a full-width row in the
// Placements list view (the default). Clicking the row (or Enter/Space on
// it) still opens PlacementDetail (/placements/:id), exactly as the table
// row it replaces did; the trailing "View" is its visible label, not a
// second control. PlacementGridCard.jsx is the same record in the grid view.
import { ArrowRight, CalendarDays, Clock, DollarSign, UserRound } from "lucide-react";
import { useT } from "../context/AppContext.jsx";
import { placementStatusLabel } from "../lib/placements.js";
import { fmtDateLong } from "../lib/utils.js";
import PlacementCheckinDots from "./PlacementCheckinDots.jsx";
import { Card } from "./ui/card.jsx";
import { StatusBadge } from "./ui/status-badge.jsx";

export default function PlacementListItem({ placement, checkins, lang, onOpen }) {
  const t = useT();
  const p = placement;

  return (
    <Card
      interactive
      role="button"
      tabIndex={0}
      onClick={function () { onOpen(p); }}
      onKeyDown={function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(p); } }}
      className="cursor-pointer p-4 focus-visible:outline-none focus-visible:ring-2 sm:p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="m-0 truncate text-section font-semibold text-card-foreground">{p.participantName || "—"}</h3>
          <p className="m-0 mt-1 truncate text-meta text-muted">
            {[p.positionTitle, p.employerName].filter(Boolean).join(" · ") || "—"}
          </p>
        </div>
        <StatusBadge domain="placement" status={p.currentStatus} className="shrink-0">{placementStatusLabel(p.currentStatus, lang)}</StatusBadge>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-meta text-card-foreground">
        <span className="flex items-center gap-1.5 tabular-nums">
          <CalendarDays className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
          {t("jobStartDateLabel")}: {fmtDateLong(p.startDate, lang)}
        </span>
        {p.hourlyWage ? (
          <span className="flex items-center gap-1.5 tabular-nums">
            <DollarSign className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
            <span className="sr-only">{t("hourlyWageLabel")}: </span>
            {p.hourlyWage}{t("perHourSuffix")}
          </span>
        ) : null}
        {p.hoursPerWeek ? (
          <span className="flex items-center gap-1.5 tabular-nums">
            <Clock className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
            <span className="sr-only">{t("hoursPerWeekLabel")}: </span>
            {p.hoursPerWeek}
          </span>
        ) : null}
        {p.supervisorName ? (
          <span className="flex min-w-0 items-center gap-1.5">
            <UserRound className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
            <span className="sr-only">{t("supervisorNameLabel")}: </span>
            <span className="truncate">{p.supervisorName}</span>
          </span>
        ) : null}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line-subtle pt-3">
        <PlacementCheckinDots checkins={checkins} />
        <span className="flex items-center gap-1.5 text-ui font-semibold text-primary">
          {t("viewLabel")} <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </span>
      </div>
    </Card>
  );
}
