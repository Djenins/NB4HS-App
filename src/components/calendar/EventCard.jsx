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
  // Percentages only, no px fudge-factors to add up wrong -- the 2px gap
  // between side-by-side cards (Level 1 & Level 2 on the same morning)
  // comes from padding on a border-box'd wrapper instead, so left+width
  // can never exceed the column's own 100% and bleed into the next day.
  const widthPct = 100 / cols;

  return (
    <div
      className="group absolute z-10 box-border overflow-hidden py-px pr-0.5 hover:z-20"
      style={{ top, height, left: col * widthPct + "%", width: widthPct + "%", paddingLeft: col === 0 ? 0 : 2 }}
    >
      <div
        role="button"
        tabIndex={0}
        onClick={() => onOpen(block)}
        onKeyDown={(e) => { if (e.key === "Enter") onOpen(block); }}
        className={cn(
          "flex h-full w-full cursor-pointer flex-col overflow-hidden rounded-lg border border-l-4 border-slate-200 bg-slate-50 px-2 py-1 text-left shadow-sm transition-shadow group-hover:shadow-md",
          style.border
        )}
      >
        <div className="flex items-start justify-between gap-1">
          <div className="flex min-w-0 flex-row flex-nowrap items-center gap-1">
            <Icon className={cn("shrink-0", style.chipFg)} style={{ width: 12, height: 12 }} />
            <p className={cn("m-0 min-w-0 flex-1 truncate text-[11px] font-bold leading-none", style.chipFg)} style={{ whiteSpace: "nowrap" }}>{block.title}</p>
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
            <p className="m-0 truncate text-[10px] leading-tight text-muted">{fmtTimeRange(block.startTime, block.endTime)}</p>
            {block.event?.personName && <p className="m-0 truncate text-[10px] leading-tight text-muted">{block.event.personName}</p>}
          </>
        )}
      </div>
    </div>
  );
}
