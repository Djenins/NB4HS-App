// EventCard.jsx -- one event positioned on the time grid. Top/height come
// straight from the block's real start/end via blockTop()/blockHeight(), so
// a 9:30-12:30 class starts half way between the 9 and 10 gridlines and ends
// on the 12:30 mark; left/width come from layoutOverlaps()'s column
// assignment so simultaneous events sit side by side instead of on top of
// each other.
//
// The card renders at one of three densities chosen from its own pixel
// height, not from the event kind -- a 3-hour class has room for the icon
// chip, subtitle, time and attendee count; a 30-minute appointment has room
// for a title. Anything dropped at a smaller size is still in the aria-label
// and the tooltip, and all of it is in the drawer a click opens.
//
// Kind is communicated three ways -- tint + left accent, icon, and the type
// word in the tooltip/drawer -- so colour is never the only signal. Hover
// reveals Edit/Duplicate/Delete on desktop, but every one of those is also
// in the drawer a tap opens, since this runs on touchscreens too.
import { Clock, Copy, Pencil, Trash2, Users } from "lucide-react";
import { blockHeight, blockTop, fmtTimeRange } from "./calendarLayout.js";
import { blockStyle } from "./kindStyle.js";
import { BTN_RESET } from "./btnReset.js";
import { cn } from "../../lib/cn.js";

// Density thresholds, in px of card height. FULL clears chip + title +
// subtitle + time row + count; MEDIUM clears title + time on two lines;
// below that there is one line of type before the next glyph is clipped.
const FULL_HEIGHT = 104;
const MEDIUM_HEIGHT = 52;

export default function EventCard({ block, grid, roomy, t, onOpen, onEdit, onDuplicate, onDelete }) {
  const style = blockStyle(block);
  const Icon = style.icon;
  const top = blockTop(grid, block.startTime);
  const height = blockHeight(grid, block.startTime, block.endTime);
  const editable = !!block.event;
  const timeRange = fmtTimeRange(block.startTime, block.endTime);
  const density = height >= FULL_HEIGHT ? "full" : height >= MEDIUM_HEIGHT ? "medium" : "tight";
  const subtitle = block.subtitle || block.event?.personName || "";
  const count = block.count;

  const cols = block.layout?.cols || 1;
  const col = block.layout?.col || 0;
  // Percentages only, no px fudge-factors to add up wrong -- the gap between
  // side-by-side cards comes from padding on a border-box'd wrapper instead,
  // so left+width can never exceed the column's own 100% and bleed into the
  // next day.
  const widthPct = 100 / cols;

  const srLabel = [t(style.label) + ": " + block.title, subtitle, timeRange]
    .filter(Boolean).join(", ") + (count ? ", " + count + " " + t("calendarEnrolled") : "");

  return (
    <div
      className="group absolute z-10 box-border overflow-hidden py-[3px] pr-2 hover:z-20"
      style={{ top, height, left: col * widthPct + "%", width: widthPct + "%", paddingLeft: col === 0 ? 8 : 4 }}
    >
      <div
        role="button"
        tabIndex={0}
        aria-label={srLabel}
        title={t(style.label) + " · " + block.title + " · " + timeRange}
        onClick={() => onOpen(block)}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(block); } }}
        className={cn(
          // transform + border-colour animate; box-shadow deliberately does not.
          // The focus ring is a box-shadow (Tailwind ring-*), and with
          // box-shadow in the transition list the focus indicator faded in
          // over 200ms instead of appearing the instant the card is tabbed
          // to. The hover elevation still reads: the lift is the transform.
          "flex h-full w-full cursor-pointer flex-col overflow-hidden rounded-xl border border-l-[3px] text-left transition-[transform,border-color] duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary group-hover:-translate-y-px group-hover:shadow-card-hover",
          density === "full" ? "gap-2 px-3 py-2.5" : "gap-0.5 px-2.5 py-1.5",
          style.cardBg,
          style.cardBorder,
          style.accent,
          style.hover
        )}
      >
        <div className="flex items-start justify-between gap-1">
          <div className={cn("flex min-w-0 flex-1", density === "full" ? "items-start gap-2.5" : "items-center gap-1.5")}>
            <span
              className={cn(
                "flex shrink-0 items-center justify-center",
                density === "full" && "h-8 w-8 rounded-full bg-card shadow-card"
              )}
            >
              <Icon className={cn("shrink-0", density === "full" ? "h-[18px] w-[18px]" : "h-3.5 w-3.5", style.chipFg)} />
            </span>

            <div className="min-w-0 flex-1">
              <p className={cn(
                "m-0 min-w-0 truncate font-bold leading-tight text-navy dark:text-card-foreground",
                density === "full" ? (roomy ? "text-base" : "text-[15px]") : "text-[13px]"
              )}>
                {block.title}
              </p>
              {density === "full" && subtitle && (
                <p className="m-0 mt-0.5 truncate text-[13px] font-medium leading-tight text-[var(--ev-ink-soft)]">{subtitle}</p>
              )}
            </div>
          </div>

          {editable && (
            <div className="hidden shrink-0 items-center gap-0.5 group-hover:flex">
              <button type="button" aria-label={t("calendarEdit")} className={cn(BTN_RESET, "rounded p-0.5 text-muted hover:bg-card hover:text-card-foreground")} onClick={(e) => { e.stopPropagation(); onEdit(block); }}>
                <Pencil className="h-3 w-3" />
              </button>
              <button type="button" aria-label={t("calendarDuplicate")} className={cn(BTN_RESET, "rounded p-0.5 text-muted hover:bg-card hover:text-card-foreground")} onClick={(e) => { e.stopPropagation(); onDuplicate(block); }}>
                <Copy className="h-3 w-3" />
              </button>
              <button type="button" aria-label={t("calendarDelete")} className={cn(BTN_RESET, "rounded p-0.5 text-muted hover:bg-card hover:text-accent")} onClick={(e) => { e.stopPropagation(); onDelete(block); }}>
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          )}
        </div>

        {density !== "tight" && (
          <p className={cn("m-0 flex items-center gap-1.5 truncate font-semibold leading-tight", style.chipFg, density === "full" ? "text-sm" : "text-[11.5px]")}>
            <Clock className={cn("shrink-0", density === "full" ? "h-4 w-4" : "h-3 w-3")} aria-hidden="true" />
            {timeRange}
          </p>
        )}

        {density === "medium" && subtitle && (
          <p className="m-0 truncate text-[11.5px] leading-tight text-[var(--ev-ink-soft)]">{subtitle}</p>
        )}

        {/* Enrolled-student count, and only where there is one: it's the
            live roster count for the classes in this block (see
            Calendar.jsx), so an event kind that has no roster simply has no
            footer rather than a zero. */}
        {density === "full" && count > 0 && (
          <p className="m-0 mt-auto flex items-center justify-end gap-1.5 text-[13px] font-semibold leading-none text-[var(--ev-ink-soft)]">
            <Users className="h-4 w-4 shrink-0" aria-hidden="true" />
            {count}
            <span className="sr-only"> {t("calendarEnrolled")}</span>
          </p>
        )}
      </div>
    </div>
  );
}
