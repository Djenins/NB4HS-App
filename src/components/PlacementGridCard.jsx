// PlacementGridCard.jsx -- one placement as a card in the Placements grid
// view. Same record, same PlacementDetail target as PlacementListItem.jsx,
// stacked for a narrow column. The whole card is the button (click, Enter
// or Space); the trailing "View" is its visible label, not a second control.
import { ArrowRight, Building2, CalendarDays, Clock, DollarSign, UserRound } from "lucide-react";
import { useT } from "../context/AppContext.jsx";
import { placementStatusLabel } from "../lib/placements.js";
import { fmtDateLong } from "../lib/utils.js";
import PlacementCheckinDots from "./PlacementCheckinDots.jsx";
import { Card } from "./ui/card.jsx";
import { StatusBadge } from "./ui/status-badge.jsx";

export default function PlacementGridCard({ placement, checkins, lang, onOpen }) {
  const t = useT();
  const p = placement;

  return (
    <Card
      interactive
      role="button"
      tabIndex={0}
      onClick={function () { onOpen(p); }}
      onKeyDown={function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(p); } }}
      className="flex h-full cursor-pointer flex-col p-4 focus-visible:outline-none focus-visible:ring-2 sm:p-5"
    >
      <div className="flex items-start justify-between gap-2">
        <StatusBadge domain="placement" status={p.currentStatus}>{placementStatusLabel(p.currentStatus, lang)}</StatusBadge>
        <span className="flex items-center gap-1.5 text-ui font-semibold text-primary">
          {t("viewLabel")} <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </span>
      </div>

      <h3 className="m-0 mt-3 truncate text-section font-semibold text-card-foreground">{p.participantName || "—"}</h3>

      <dl className="m-0 mb-4 mt-3 flex flex-col gap-1.5 text-meta text-muted">
        <div className="flex min-w-0 items-center gap-2">
          <Building2 className="h-4 w-4 shrink-0" aria-hidden="true" />
          <dt className="sr-only">{t("positionLabel")}</dt>
          <dd className="m-0 truncate text-card-foreground">
            {[p.positionTitle, p.employerName].filter(Boolean).join(" · ") || "—"}
          </dd>
        </div>
        <div className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 shrink-0" aria-hidden="true" />
          <dt className="sr-only">{t("jobStartDateLabel")}</dt>
          <dd className="m-0 tabular-nums text-card-foreground">{fmtDateLong(p.startDate, lang)}</dd>
        </div>
        {p.hourlyWage ? (
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 shrink-0" aria-hidden="true" />
            <dt className="sr-only">{t("hourlyWageLabel")}</dt>
            <dd className="m-0 tabular-nums text-card-foreground">{p.hourlyWage}{t("perHourSuffix")}</dd>
          </div>
        ) : null}
        {p.hoursPerWeek ? (
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 shrink-0" aria-hidden="true" />
            <dt className="sr-only">{t("hoursPerWeekLabel")}</dt>
            <dd className="m-0 tabular-nums text-card-foreground">{p.hoursPerWeek}</dd>
          </div>
        ) : null}
        {p.supervisorName ? (
          <div className="flex min-w-0 items-center gap-2">
            <UserRound className="h-4 w-4 shrink-0" aria-hidden="true" />
            <dt className="sr-only">{t("supervisorNameLabel")}</dt>
            <dd className="m-0 truncate text-card-foreground">{p.supervisorName}</dd>
          </div>
        ) : null}
      </dl>

      <div className="mt-auto border-t border-line-subtle pt-3">
        <PlacementCheckinDots checkins={checkins} />
      </div>
    </Card>
  );
}
