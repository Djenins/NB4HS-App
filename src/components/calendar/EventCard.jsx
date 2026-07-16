// EventCard.jsx -- one absolutely-positioned event block inside a DayColumn.
// Hover reveals View/Edit/Duplicate/Delete; class blocks are derived (not a
// calendar_events row) so they only get View.
import { Copy, Pencil, Trash2 } from "lucide-react";
import { blockHeight, blockTop } from "./calendarLayout.js";
import { KIND_STYLE } from "./kindStyle.js";
import { BTN_RESET } from "./btnReset.js";
import { cn } from "../../lib/cn.js";

function fmtTimeRange(startTime, endTime) {
  return endTime ? startTime + " – " + endTime : startTime;
}

export default function EventCard({ block, t, onOpen, onEdit, onDuplicate, onDelete }) {
  const style = KIND_STYLE[block.kind];
  const Icon = style.icon;
  const top = blockTop(block.startTime);
  const height = blockHeight(block.startTime, block.endTime);
  const editable = !!block.event;
  const compact = height < 52;
  const cols = block.layout?.cols || 1;
  const col = block.layout?.col || 0;
  const gapPct = 1.5;
  const widthPct = 100 / cols;
  const left = "calc(" + (col * widthPct) + "% + " + (col === 0 ? 2 : gapPct / 2) + "px)";
  const width = "calc(" + widthPct + "% - " + (cols === 1 ? 4 : gapPct + 2) + "px)";

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen(block)}
      onKeyDown={(e) => { if (e.key === "Enter") onOpen(block); }}
      className={cn(
        "group absolute z-10 flex cursor-pointer flex-col overflow-hidden rounded-lg border border-l-4 bg-card px-2 py-1 text-left shadow-sm transition-shadow hover:z-20 hover:shadow-md",
        style.border, style.cardBg
      )}
      style={{ top, height, left, width }}
    >
      <div className="flex items-start justify-between gap-1">
        <div className="flex min-w-0 items-center gap-1">
          <Icon className={cn("h-3 w-3 shrink-0", style.chipFg)} />
          <p className={cn("truncate text-[11px] font-bold", style.chipFg)}>{block.title}</p>
        </div>
        <div className="hidden shrink-0 items-center gap-0.5 group-hover:flex">
          {editable && (
            <>
              <button type="button" aria-label={t("calendarEdit")} className={cn(BTN_RESET, "rounded p-0.5 text-muted hover:bg-card hover:text-card-foreground")} onClick={(e) => { e.stopPropagation(); onEdit(block); }}>
                <Pencil className="h-3 w-3" />
              </button>
              <button type="button" aria-label={t("calendarDuplicate")} className={cn(BTN_RESET, "rounded p-0.5 text-muted hover:bg-card hover:text-card-foreground")} onClick={(e) => { e.stopPropagation(); onDuplicate(block); }}>
                <Copy className="h-3 w-3" />
              </button>
              <button type="button" aria-label={t("calendarDelete")} className={cn(BTN_RESET, "rounded p-0.5 text-muted hover:bg-card hover:text-accent")} onClick={(e) => { e.stopPropagation(); onDelete(block); }}>
                <Trash2 className="h-3 w-3" />
              </button>
            </>
          )}
        </div>
      </div>
      {!compact && (
        <>
          <p className="truncate text-[10px] text-muted">{fmtTimeRange(block.startTime, block.endTime)}</p>
          {block.event?.personName && <p className="truncate text-[10px] text-muted">{block.event.personName}</p>}
        </>
      )}
    </div>
  );
}
