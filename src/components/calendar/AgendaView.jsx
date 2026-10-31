// AgendaView.jsx -- the chronological list behind the Agenda tab (Calendar
// .jsx's `list` view, lifted out of the page so all four views are siblings
// in this folder). One section per visible day, each row carrying the time on
// the left and the event's type/title/person on the right; empty days keep
// their heading and a quiet "New Event" affordance rather than disappearing,
// so the list still shows the shape of the week.
//
// `skipEmpty` drops days with nothing on them (no event, no holiday). The
// month view uses it as its phone layout: a 5-column month grid is
// unreadable at phone width, so below sm it becomes this list of the
// month's busy days instead.
import { Plus } from "lucide-react";
import { fmtTimeRange } from "./calendarLayout.js";
import { blockStyle, KIND_STYLE } from "./kindStyle.js";
import { BTN_RESET } from "./btnReset.js";
import { cn } from "../../lib/cn.js";

export default function AgendaView({ dayBlocks, skipEmpty, todayStr, holidaysByDate, t, onOpenEvent, onAddEvent }) {
  const HolidayIcon = KIND_STYLE.holiday.icon;
  const days = skipEmpty ? dayBlocks.filter((d) => d.blocks.length > 0 || holidaysByDate[d.dateStr]) : dayBlocks;

  return (
    <div className="flex flex-col gap-3">
      {days.map(({ date, dateStr, blocks }) => {
        const isToday = dateStr === todayStr;
        const holiday = holidaysByDate[dateStr];

        return (
          <section
            key={dateStr}
            className={cn(
              "overflow-hidden rounded-surface border bg-card shadow-card",
              isToday ? "border-primary" : "border-border"
            )}
          >
            <header className={cn("flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3", isToday && "bg-tone-info-bg")}>
              <div className="flex items-center gap-2">
                <h2 className={cn("m-0 text-meta font-bold uppercase tracking-[0.06em]", isToday ? "text-tone-info-ink" : "text-card-foreground")}>
                  {date.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}
                </h2>
                {isToday && (
                  <span className="rounded-chip bg-primary px-2 py-0.5 text-caption font-bold leading-none text-primary-foreground">
                    {t("calendarToday")}
                  </span>
                )}
              </div>
              {holiday && (
                <span className={cn("flex items-center gap-1.5 rounded-chip px-2.5 py-1 text-caption font-bold leading-none", KIND_STYLE.holiday.chipBg, KIND_STYLE.holiday.chipFg)}>
                  <HolidayIcon className="h-3 w-3" />{holiday.name}
                </span>
              )}
            </header>

            {blocks.length === 0 ? (
              <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-4">
                <p className="m-0 text-ui text-muted">{t("calendarNoEvents")}</p>
                {onAddEvent && <button
                  type="button"
                  onClick={() => onAddEvent(dateStr)}
                  className={cn(BTN_RESET, "flex items-center gap-1.5 rounded-control border border-dashed border-secondary-border px-3 py-2 text-meta font-semibold text-muted transition-colors hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary")}
                >
                  <Plus className="h-3.5 w-3.5" />{t("calendarNewEvent")}
                </button>}
              </div>
            ) : (
              <ul className="m-0 flex list-none flex-col p-0">
                {blocks.map((b) => {
                  const style = blockStyle(b);
                  const Icon = style.icon;
                  return (
                    <li key={b.key} className="border-t border-line-subtle first:border-t-0">
                      <button
                        type="button"
                        onClick={() => onOpenEvent(b)}
                        className={cn(BTN_RESET, "flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary sm:gap-4")}
                      >
                        <span className="w-[104px] shrink-0 text-meta font-bold leading-tight tabular-nums text-card-foreground sm:w-[136px]">
                          {fmtTimeRange(b.startTime, b.endTime)}
                        </span>
                        <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-control", style.chipBg, style.chipFg)}>
                          <Icon className="h-[18px] w-[18px]" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-ui font-bold text-card-foreground">{b.title}</span>
                          <span className="block truncate text-meta text-muted">
                            {t(style.label)}{b.event?.personName ? " · " + b.event.personName : ""}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}
