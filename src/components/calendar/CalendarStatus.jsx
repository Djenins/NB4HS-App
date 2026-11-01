// CalendarStatus.jsx -- the two non-content states of the calendar surface.
//
// CalendarSkeleton keeps the real grid's shape (toolbar bar, day headers,
// hour rows) while the first fetch is in flight, so the page doesn't flash
// an empty week that looks like "nothing is scheduled". It draws no event
// blocks -- an empty day and a loading day must not look the same, and
// inventing placeholder events would be worse than either.
//
// CalendarError is the other half of that: a failed load says so and offers
// a retry, instead of quietly rendering as an empty calendar. It's the
// shared EmptyState's error variant, whose icon sits on the danger chip --
// the old icon was danger-tint on the same danger-tint and couldn't be seen.
import { RefreshCw } from "lucide-react";
import { HEADER_HEIGHT, HOUR_HEIGHT } from "./calendarLayout.js";
import { Button } from "../ui/button.jsx";
import { EmptyState } from "../ui/empty-state.jsx";
import { Skeleton } from "../ui/skeleton.jsx";

export function CalendarSkeleton({ columns = 5, rows = 8 }) {
  const cols = Array.from({ length: columns });
  const hours = Array.from({ length: rows });

  return (
    <div className="overflow-hidden rounded-surface border border-border bg-card shadow-card" aria-hidden="true">
      <div className="flex">
        <div className="w-[78px] shrink-0 border-r border-line-subtle sm:w-[112px]">
          <div style={{ height: HEADER_HEIGHT }} className="flex items-center border-b border-line-subtle pl-3 sm:pl-4">
            <Skeleton className="h-3 w-10 rounded-badge" />
          </div>
          {hours.map((_, i) => (
            <div key={i} style={{ height: HOUR_HEIGHT }} className="flex items-start border-t border-dashed border-line-subtle pl-3 sm:pl-4">
              <Skeleton className="mt-[-6px] h-3 w-9 rounded-badge" />
            </div>
          ))}
        </div>
        <div className="flex flex-1">
          {cols.map((_, c) => (
            <div key={c} className="flex min-w-0 flex-1 flex-col border-l border-line-subtle first:border-l-0">
              <div style={{ height: HEADER_HEIGHT }} className="flex flex-col items-center justify-center gap-1.5 border-b border-line-subtle">
                <Skeleton className="h-2.5 w-8 rounded-badge" />
                <Skeleton className="h-6 w-7 rounded-badge" />
                <Skeleton className="h-2.5 w-7 rounded-badge" />
              </div>
              {hours.map((_, i) => (
                <div key={i} style={{ height: HOUR_HEIGHT }} className="border-t border-dashed border-line-subtle" />
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
    <div className="rounded-surface border border-border bg-card shadow-card">
      <EmptyState
        variant="error"
        title={t("calendarLoadError")}
        action={(
          <Button variant="secondary" onClick={onRetry}>
            <RefreshCw className="h-4 w-4" aria-hidden="true" />{t("calendarRetry")}
          </Button>
        )}
      />
    </div>
  );
}
