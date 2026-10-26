// EventCard.jsx -- one event positioned on the time grid. Top/height come
// straight from the block's real start/end via blockTop()/blockHeight(), so
// a 9:30-12:30 class starts half way between the 9 and 10 gridlines and ends
// on the 12:30 mark; left/width come from layoutOverlaps()'s column
// assignment so simultaneous events sit side by side instead of on top of
// each other.
//
// Full-size card, top to bottom: icon disc + title + subtitle, the time in
// the kind's colour, the location (only when the block has one -- nothing
// is invented), and a footer band with the enrolled count and an options
// menu. Shorter events drop to fewer rows, chosen from the card's own pixel
// height, not its kind; anything dropped is still in the aria-label and in
// the drawer a click opens.
//
// Type sizes step up with the card's own width (CSS container queries on the
// wrapper), so the same card reads at the reference's size in a wide day
// column and still fits a 150px column on a laptop.
//
// Kind is communicated three ways -- tint + left accent, icon, and the type
// word in the tooltip/drawer -- so colour is never the only signal. The
// whole card is one button (a stretched overlay) and the options menu sits
// above it, so there is no button nested inside a button.
import { Clock, Copy, Eye, MapPin, MoreVertical, Pencil, Trash2, UserRound, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { blockHeight, blockTop, fmtTimeRange } from "./calendarLayout.js";
import { blockStyle } from "./kindStyle.js";
import { BTN_RESET } from "./btnReset.js";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "../ui/dropdown-menu.jsx";
import { cn } from "../../lib/cn.js";

// Density thresholds, in px of card height. FULL clears the header, time,
// location and footer rows; MEDIUM clears title + time on two lines; below
// that there is one line of type before the next glyph is clipped.
const FULL_HEIGHT = 132;
const MEDIUM_HEIGHT = 52;

function plural(t, n, one, many) {
  return t(n === 1 ? one : many).replace("{n}", String(n));
}

function EventOptions({ block, t, onOpen, onEdit, onDuplicate, onDelete, className }) {
  const navigate = useNavigate();
  const editable = !!block.event;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={t("calendarEventActions") + ": " + block.title}
          onClick={(e) => e.stopPropagation()}
          className={cn(BTN_RESET, "relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[var(--ev-ink-soft)] transition-colors hover:bg-card hover:text-card-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary data-[state=open]:bg-card", className)}
        >
          <MoreVertical className="h-[18px] w-[18px]" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => onOpen(block)}>
          <Eye className="h-4 w-4 text-muted" />{t("calendarViewDetails")}
        </DropdownMenuItem>
        {block.kind === "class" && (
          <DropdownMenuItem onSelect={() => navigate("/students/classrooms")}>
            <Users className="h-4 w-4 text-muted" />{t("calendarViewStudents")}
          </DropdownMenuItem>
        )}
        {editable && (
          <>
            <DropdownMenuItem onSelect={() => onEdit(block)}>
              <Pencil className="h-4 w-4 text-muted" />{t("calendarEdit")}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onDuplicate(block)}>
              <Copy className="h-4 w-4 text-muted" />{t("calendarDuplicate")}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => onDelete(block)} className="text-accent">
              <Trash2 className="h-4 w-4" />{t("calendarDelete")}
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default function EventCard({ block, grid, roomy, t, onOpen, onEdit, onDuplicate, onDelete }) {
  const style = blockStyle(block);
  const Icon = style.icon;
  const top = blockTop(grid, block.startTime);
  const height = blockHeight(grid, block.startTime, block.endTime);
  const timeRange = fmtTimeRange(block.startTime, block.endTime);
  const density = height >= FULL_HEIGHT ? "full" : height >= MEDIUM_HEIGHT ? "medium" : "tight";
  const subtitle = block.subtitle || block.event?.personName || "";
  const count = block.count;
  const location = block.location || "";

  const cols = block.layout?.cols || 1;
  const col = block.layout?.col || 0;
  // Percentages only, no px fudge-factors to add up wrong -- the gap between
  // side-by-side cards comes from padding on a border-box'd wrapper instead,
  // so left+width can never exceed the column's own 100% and bleed into the
  // next day.
  const widthPct = 100 / cols;

  const srLabel = [t(style.label) + ": " + block.title, subtitle, timeRange, location]
    .filter(Boolean).join(", ") + (count ? ", " + plural(t, count, "calendarStudentOne", "calendarStudentMany") : "");
  const menu = { block, t, onOpen, onEdit, onDuplicate, onDelete };

  return (
    <div
      className="group absolute z-10 box-border py-1 pr-2.5 [container-type:inline-size] hover:z-20 focus-within:z-20"
      style={{ top, height, left: col * widthPct + "%", width: widthPct + "%", paddingLeft: col === 0 ? 10 : 5 }}
    >
      <div
        title={t(style.label) + " · " + block.title + " · " + timeRange}
        className={cn(
          // transform + border-colour + shadow ease together on hover; the
          // focus ring lives on the overlay button, not here, so it appears
          // the instant the card is tabbed to.
          "relative flex h-full w-full flex-col overflow-hidden rounded-2xl border border-l-4 shadow-card transition-[transform,border-color,box-shadow] duration-200 ease-out group-hover:-translate-y-px group-hover:shadow-card-hover",
          style.cardBg,
          style.cardBorder,
          style.accent,
          style.hover
        )}
      >
        {/* The whole card opens the drawer. A stretched overlay button rather
            than role=button on the card, so the options menu above it is a
            sibling control instead of a button nested in a button. */}
        <button
          type="button"
          aria-label={srLabel}
          onClick={() => onOpen(block)}
          className={cn(BTN_RESET, "absolute inset-0 z-0 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary")}
        />

        <div
          className={cn(
            "pointer-events-none relative flex min-h-0 flex-1 flex-col",
            density === "full" ? "gap-2.5 px-3 pb-2 pt-3 [@container(min-width:15rem)]:gap-3 [@container(min-width:15rem)]:px-4 [@container(min-width:15rem)]:pt-4" : "gap-0.5 px-2.5 py-1.5"
          )}
        >
          <div className={cn("flex min-w-0", density === "full" ? "items-start gap-2.5 [@container(min-width:15rem)]:gap-3" : "items-center gap-1.5")}>
            <span
              aria-hidden="true"
              className={cn(
                "flex shrink-0 items-center justify-center rounded-full",
                density === "full" ? cn("h-9 w-9 [@container(min-width:15rem)]:h-11 [@container(min-width:15rem)]:w-11", style.iconBg) : ""
              )}
            >
              <Icon className={cn("shrink-0", density === "full" ? "h-[18px] w-[18px] [@container(min-width:15rem)]:h-[22px] [@container(min-width:15rem)]:w-[22px]" : "h-3.5 w-3.5", style.chipFg)} strokeWidth={2} />
            </span>

            <div className="min-w-0 flex-1">
              <p className={cn(
                "m-0 min-w-0 font-bold leading-snug text-navy dark:text-card-foreground",
                density === "full"
                  ? cn("line-clamp-2 text-[15px] [@container(min-width:15rem)]:text-[17px]", roomy && "text-[17px]")
                  : "truncate text-[13px]"
              )}>
                {block.title}
              </p>
              {density === "full" && subtitle && (
                <p className="m-0 mt-0.5 truncate text-[13px] font-medium leading-tight text-[var(--ev-ink-soft)] [@container(min-width:15rem)]:text-[15px]">{subtitle}</p>
              )}
            </div>

            {/* -my-1 keeps the 24px tap target from making this row taller
                than its 13px title, which would push a short card's last
                line out of view. */}
            {density !== "full" && <EventOptions {...menu} className="pointer-events-auto -my-1 -mr-1 h-6 w-6" />}
          </div>

          {density !== "tight" && (
            <p className={cn(
              "m-0 flex min-w-0 items-center gap-1.5 font-semibold leading-tight",
              style.chipFg,
              density === "full" ? "text-[13px] [@container(min-width:15rem)]:gap-2 [@container(min-width:15rem)]:text-base" : "text-[11.5px]"
            )}>
              <Clock className={cn("shrink-0", density === "full" ? "h-4 w-4 [@container(min-width:15rem)]:h-[18px] [@container(min-width:15rem)]:w-[18px]" : "h-3 w-3")} aria-hidden="true" />
              {/* The time is the one line never cut short: on a full card it
                  wraps after the dash in a narrow column instead. */}
              <span className={density === "full" ? "min-w-0" : "truncate"}>{timeRange}</span>
            </p>
          )}

          {density === "full" && location && (
            <p className="m-0 flex min-w-0 items-center gap-1.5 text-[13px] font-medium leading-tight text-[var(--ev-ink-soft)] [@container(min-width:15rem)]:gap-2 [@container(min-width:15rem)]:text-[15px]">
              <MapPin className="h-4 w-4 shrink-0 [@container(min-width:15rem)]:h-[18px] [@container(min-width:15rem)]:w-[18px]" aria-hidden="true" />
              <span className="truncate">{location}</span>
            </p>
          )}

          {density === "medium" && subtitle && (
            <p className="m-0 truncate text-[11.5px] leading-tight text-[var(--ev-ink-soft)]">{subtitle}</p>
          )}
        </div>

        {/* Footer band: the live enrolled count for a class (or the person
            for a visit/appointment) and the options menu. A lighter band of
            the card's own surface, not a rule -- it reads as the card's
            base, the way the reference sets it apart. */}
        {density === "full" && (
          <div className="pointer-events-none relative flex shrink-0 items-center justify-between gap-2 bg-[color-mix(in_srgb,var(--card)_55%,transparent)] py-1.5 pl-3 pr-1.5 [@container(min-width:15rem)]:py-2 [@container(min-width:15rem)]:pl-4 [@container(min-width:15rem)]:pr-2">
            {count > 0 ? (
              <span className="flex min-w-0 items-center gap-1.5 text-[13px] font-medium text-[var(--ev-ink-soft)] [@container(min-width:15rem)]:gap-2 [@container(min-width:15rem)]:text-[15px]">
                <Users className="h-4 w-4 shrink-0 [@container(min-width:15rem)]:h-[18px] [@container(min-width:15rem)]:w-[18px]" aria-hidden="true" />
                <span className="truncate">{plural(t, count, "calendarStudentOne", "calendarStudentMany")}</span>
              </span>
            ) : block.event?.personName && block.event.personName !== subtitle ? (
              <span className="flex min-w-0 items-center gap-1.5 text-[13px] font-medium text-[var(--ev-ink-soft)] [@container(min-width:15rem)]:text-[15px]">
                <UserRound className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span className="truncate">{block.event.personName}</span>
              </span>
            ) : <span />}
            <EventOptions {...menu} className="pointer-events-auto" />
          </div>
        )}
      </div>
    </div>
  );
}
