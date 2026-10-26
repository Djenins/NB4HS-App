// SidebarNavItem.jsx -- one navigation row. Expanded: icon + label on a
// rounded row, pale blue (deep blue in dark mode) when active. Collapsed: an
// icon-only square that turns solid blue when active, named for screen
// readers and touch (aria-label) and for a mouse or keyboard (tooltip).
import { ChevronRight, Circle } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "../../lib/cn.js";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip.jsx";
import { EASE, FOCUS_RING } from "./sidebarStyles.js";

function Badge({ count, collapsed }) {
  if (!count) return null;
  // Pending-count cue in the brand gold -- red is reserved for errors.
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-gold px-1 text-[10px] font-bold leading-none text-navy",
        collapsed ? "absolute -right-1 -top-1 ring-2 ring-[color:var(--sb-bg)]" : "ml-auto"
      )}
    >
      {count > 9 ? "9+" : count}
    </span>
  );
}

export default function SidebarNavItem({ entry, active, collapsed, badge, onNavigate }) {
  const Icon = entry.icon || Circle;
  const name = badge ? entry.label + " (" + badge + ")" : entry.label;

  const link = (
    <Link
      to={entry.to}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      aria-label={collapsed || badge ? name : undefined}
      className={cn(
        "group relative flex items-center no-underline",
        EASE,
        FOCUS_RING,
        collapsed
          ? cn("mx-auto h-10 w-10 justify-center rounded-xl", active ? "bg-sb-rail-active text-white" : "text-sb-icon hover:bg-sb-hover hover:text-sb-text")
          : cn(
              "h-9 gap-3 rounded-[10px] px-2.5 text-[14px]",
              active ? "bg-sb-active font-semibold text-sb-active-text" : "font-medium text-sb-text hover:bg-sb-hover"
            )
      )}
    >
      <Icon
        aria-hidden="true"
        strokeWidth={active ? 2.1 : 1.8}
        className={cn("h-[19px] w-[19px] shrink-0", !collapsed && (active ? "text-sb-active-text" : "text-sb-icon"))}
      />
      {!collapsed && <span className="truncate">{entry.label}</span>}
      <Badge count={badge} collapsed={collapsed} />
      {!collapsed && entry.workspace && (
        <ChevronRight
          aria-hidden="true"
          className={cn("h-4 w-4 shrink-0 opacity-60", !badge && "ml-auto", active ? "text-sb-active-text" : "text-sb-muted")}
        />
      )}
    </Link>
  );

  if (!collapsed) return <li>{link}</li>;
  return (
    <li>
      <Tooltip delayDuration={150}>
        <TooltipTrigger asChild>{link}</TooltipTrigger>
        <TooltipContent side="right">{name}</TooltipContent>
      </Tooltip>
    </li>
  );
}
