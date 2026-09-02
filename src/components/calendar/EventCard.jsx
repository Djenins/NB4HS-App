// EventCard.jsx -- one event positioned on the time grid. Top/height come
// straight from the block's real start/end via blockTop()/blockHeight(), so
// a 9:30-12:30 class starts half way between the 9 and 10 gridlines and ends
// on the 12:30 mark; left/width come from layoutOverlaps()'s column
// assignment so simultaneous events sit side by side instead of on top of
// each other.
//
// Kind is communicated three ways -- tint + left accent, icon, and the type
// word in the tooltip/drawer -- so color is never the only signal. Hover
// reveals Edit/Duplicate/Delete on desktop, but every one of those is also
// in the drawer a tap opens, since this runs on touchscreens too.
import { Copy, Pencil, Trash2 } from "lucide-react";
import { blockHeight, blockTop, fmtTimeRange } from "./calendarLayout.js";
import { KIND_STYLE } from "./kindStyle.js";
import { BTN_RESET } from "./btnReset.js";
import { cn } from "../../lib/cn.js";

export default function EventCard({ block, grid, roomy, t, onOpen, onEdit, onDuplicate, onDelete }) {
  const style = KIND_STYLE[block.kind];
  const Icon = style.icon;
  const top = blockTop(grid, block.startTime);
  const height = blockHeight(grid, block.startTime, block.endTime);
  const editable = !!block.event;
  const timeRange = fmtTimeRange(block.startTime, block.endTime);
  // Below ~46px there is only room for one line, so the time moves onto the
  // title row's tooltip rather than being clipped mid-glyph.
  const compact = height < 46;
  const cols = block.layout?.cols || 1;
  const col = block.layout?.col || 0;
  // Percentages only, no px fudge-factors to add up wrong -- the gap between
  // side-by-side cards comes from padding on a border-box'd wrapper instead,
  // so left+width can never exceed the column's own 100% and bleed into the
  // next day.
  const widthPct = 100 / cols;

  return (
    <div
      className="group absolute z-10 box-border overflow-hidden py-[3px] pr-1 hover:z-20"
      style={{ top, height, left: col * widthPct + "%", width: widthPct + "%", paddingLeft: col === 0 ? 0 : 4 }}
    >
      <div
        role="button"
        tabIndex={0}
        aria-label={t(style.label) + ": " + block.title + ", " + timeRange}
        title={t(style.label) + " · " + block.title + " · " + timeRange}
        onClick={() => onOpen(block)}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(block); } }}
        className={cn(
          "flex h-full w-full cursor-pointer flex-col gap-0.5 overflow-hidden rounded-lg border border-l-[3px] px-2 py-1.5 text-left transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary group-hover:shadow-card-hover",
          style.cardBg,
          style.cardBorder,
          style.accent,
          style.hover
        )}
      >
        <div className="flex items-start justify-between gap-1">
          <div className="flex min-w-0 flex-1 items-center gap-1.5">
            <Icon className={cn("h-3.5 w-3.5 shrink-0", style.chipFg)} />
            <p className={cn("m-0 min-w-0 flex-1 truncate font-bold leading-tight", style.chipFg, roomy ? "text-sm" : "text-[13px]")}>
              {block.title}
            </p>
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

        {!compact && (
          <>
            <p className="m-0 truncate text-[11.5px] font-medium leading-tight text-muted">{timeRange}</p>
            {block.event?.personName && (
              <p className="m-0 truncate text-[11.5px] leading-tight text-muted">{block.event.personName}</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
