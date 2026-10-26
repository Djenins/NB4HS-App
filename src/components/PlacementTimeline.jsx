// PlacementTimeline.jsx -- the Hired -> 30 -> 60 -> 90 -> 180 retention
// timeline on PlacementDetail.jsx, as divided rows for the body of a
// SectionCard (flush). Unlike JobPipelineTracker.jsx/EmployerPipelineTracker.jsx
// this isn't click-to-select-a-stage -- each step's state comes from
// checkinState() (upcoming/due/completed), and clicking a check-in row
// scrolls to its PlacementCheckinCard instead of changing any state.
//
// Colour is never the only signal: every row carries its step name, a state
// icon, a date and a StatusBadge that says the state in words. The tone
// comes from statusTone("checkin", state).
import { CheckCircle2, ChevronRight, Circle, Clock } from "lucide-react";
import { useT } from "../context/AppContext.jsx";
import { cn } from "../lib/cn.js";
import { CHECKIN_TYPES, checkinState } from "../lib/placements.js";
import { statusTone } from "../lib/statusTone.js";
import { fmtDateLong } from "../lib/utils.js";
import { BUTTON_RESET } from "./ui/button.jsx";
import { StatusBadge } from "./ui/status-badge.jsx";

// Icon disc per tone. Static class names so Tailwind can see them.
const TONE_DISC = {
  info: "bg-tone-info-chip text-tone-info-ink",
  success: "bg-tone-success-chip text-tone-success-ink",
  warning: "bg-tone-warning-chip text-tone-warning-ink",
  danger: "bg-tone-danger-chip text-tone-danger-ink",
  neutral: "bg-tone-neutral-chip text-tone-neutral-ink",
  violet: "bg-tone-violet-chip text-tone-violet-ink"
};
const STATE_ICON = { completed: CheckCircle2, due: Clock, upcoming: Circle };

export default function PlacementTimeline({ checkins, startDate }) {
  const t = useT();
  const nodes = [{ key: "hired", label: t("hiredLabel"), state: "completed", date: startDate, clickable: false }].concat(
    CHECKIN_TYPES.map((c) => {
      const checkin = (checkins || []).find((ci) => ci.checkinType === c.key);
      const state = checkin ? checkinState(checkin) : "upcoming";
      const date = checkin ? (checkin.completed ? checkin.completedDate : checkin.dueDate) : "";
      return { key: c.key, label: c.en, state, date, clickable: !!checkin };
    })
  );

  function scrollToCheckin(key) {
    const el = document.getElementById("placement-checkin-" + key);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <ol className="m-0 list-none divide-y divide-line-subtle border-t border-line-subtle p-0">
      {nodes.map((n, i) => {
        const Icon = STATE_ICON[n.state] || Circle;
        const disc = TONE_DISC[statusTone("checkin", n.state)] || TONE_DISC.neutral;
        const content = (
          <>
            <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-chip", disc)}>
              <Icon className="h-4 w-4" aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-ui font-semibold text-card-foreground">
                <span className="sr-only">{i + 1}. </span>{n.label}
              </span>
              {n.date ? <span className="block text-meta tabular-nums text-muted">{fmtDateLong(n.date)}</span> : null}
            </span>
            <StatusBadge domain="checkin" status={n.state} className="shrink-0"><span className="inline-block first-letter:uppercase">{t("checkinState_" + n.state)}</span></StatusBadge>
          </>
        );
        return (
          <li key={n.key}>
            {n.clickable ? (
              <button
                type="button"
                onClick={() => scrollToCheckin(n.key)}
                className={cn(
                  BUTTON_RESET,
                  "flex w-full items-center gap-3 px-5 py-3 text-left transition-colors duration-fast hover:bg-surface-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset sm:px-6"
                )}
              >
                {content}
                <ChevronRight className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
              </button>
            ) : (
              <div className="flex items-center gap-3 px-5 py-3 sm:px-6">
                {content}
                {/* Keeps the badge column aligned with the clickable rows. */}
                <span className="h-4 w-4 shrink-0" aria-hidden="true" />
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
