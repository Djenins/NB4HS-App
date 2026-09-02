// CalendarStatus.jsx -- the two non-content states of the calendar surface.
//
// CalendarSkeleton keeps the real grid's shape (toolbar bar, day headers,
// hour rows) while the first fetch is in flight, so the page doesn't flash
// an empty week that looks like "nothing is scheduled". It draws no event
// blocks -- an empty day and a loading day must not look the same, and
// inventing placeholder events would be worse than either.
//
// CalendarError is the other half of that: a failed load says so and offers
// a retry, instead of quietly rendering as an empty calendar.
import { AlertCircle, RefreshCw } from "lucide-react";
import { HEADER_HEIGHT, HOUR_HEIGHT } from "./calendarLayout.js";
import { Button } from "../ui/button.jsx";

export function CalendarSkeleton({ columns = 5, rows = 8 }) {
  const cols = Array.from({ length: columns });
  const hours = Array.from({ length: rows });

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-card" aria-hidden="true">
      <div className="flex">
        <div className="w-[78px] shrink-0 border-r border-[var(--cal-grid)] sm:w-[112px]">
          <div style={{ height: HEADER_HEIGHT }} className="flex items-center border-b border-[var(--cal-grid)] pl-3 sm:pl-4">
            <span className="h-3 w-10 animate-pulse rounded bg-tint-neutral" />
          </div>
          {hours.map((_, i) => (
            <div key={i} style={{ height: HOUR_HEIGHT }} className="flex items-start border-t border-dashed border-[var(--cal-grid)] pl-3 sm:pl-4">
              <span className="mt-[-6px] h-3 w-9 animate-pulse rounded bg-tint-neutral" />
            </div>
          ))}
        </div>
        <div className="flex flex-1">
          {cols.map((_, c) => (
            <div key={c} className="flex min-w-0 flex-1 flex-col border-l border-[var(--cal-grid)] first:border-l-0">
              <div style={{ height: HEADER_HEIGHT }} className="flex flex-col items-center justify-center gap-1.5 border-b border-[var(--cal-grid)]">
                <span className="h-2.5 w-8 animate-pulse rounded bg-tint-neutral" />
                <span className="h-6 w-7 animate-pulse rounded bg-tint-neutral" />
                <span className="h-2.5 w-7 animate-pulse rounded bg-tint-neutral" />
              </div>
              {hours.map((_, i) => (
                <div key={i} style={{ height: HOUR_HEIGHT }} className="border-t border-dashed border-[var(--cal-grid)]" />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function CalendarError({ t, onRetry }) {
  return (
    <div role="alert" className="flex flex-col items-center gap-3 rounded-2xl border border-accent bg-accent-tint px-6 py-10 text-center shadow-card">
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-accent-tint text-accent">
        <AlertCircle className="h-6 w-6" />
      </span>
      <p className="m-0 text-sm font-bold text-card-foreground">{t("calendarLoadError")}</p>
      <Button variant="secondary" onClick={onRetry}>
        <RefreshCw className="h-4 w-4" />{t("calendarRetry")}
      </Button>
    </div>
  );
}
