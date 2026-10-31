// SidebarSearch.jsx -- the sidebar's search field. It opens the ⌘K command
// palette (CommandPalette.jsx), where the typing and results happen, so the
// sidebar and the keyboard shortcut share one real search rather than two.
// Collapsed, it's a search icon on the rail.
import { Search } from "lucide-react";
import { cn } from "../../lib/cn.js";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip.jsx";
import { BTN_RESET, EASE, FOCUS_RING } from "./sidebarStyles.js";

export function shortcutLabel() {
  const platform = typeof navigator !== "undefined" ? (navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || navigator.userAgent || "" : "";
  return /mac|iphone|ipad/i.test(platform) ? "⌘K" : "Ctrl K";
}

export default function SidebarSearch({ collapsed, placeholder, onOpen }) {
  const shortcut = shortcutLabel();

  if (collapsed) {
    return (
      <div className="pb-2">
        <Tooltip delayDuration={150}>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={onOpen}
              aria-label={placeholder}
              aria-haspopup="dialog"
              aria-keyshortcuts="Meta+K Control+K"
              className={cn(BTN_RESET, EASE, FOCUS_RING, "mx-auto flex h-10 w-10 items-center justify-center rounded-chip text-sb-icon hover:bg-sb-hover hover:text-sb-text")}
            >
              <Search aria-hidden="true" className="h-[19px] w-[19px]" strokeWidth={1.8} />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">{placeholder} <span className="opacity-70">{shortcut}</span></TooltipContent>
        </Tooltip>
      </div>
    );
  }

  return (
    <div className="px-3 pb-3">
      <button
        type="button"
        onClick={onOpen}
        aria-haspopup="dialog"
        aria-keyshortcuts="Meta+K Control+K"
        className={cn(
          BTN_RESET, EASE, FOCUS_RING,
          "flex h-10 w-full items-center gap-2 rounded-chip border border-sb-field-border bg-sb-field pl-2.5 pr-2 text-left text-caption text-sb-muted hover:bg-sb-hover"
        )}
      >
        <Search aria-hidden="true" className="h-4 w-4 shrink-0 text-sb-icon" strokeWidth={2} />
        <span className="min-w-0 flex-1 truncate">{placeholder}</span>
        {/* Phones (the drawer) have no ⌘K, so the hint only shows from 768px. */}
        <kbd aria-hidden="true" className="hidden shrink-0 rounded-badge md:inline-block border border-sb-field-border bg-sb-kbd px-1.5 py-0.5 font-sans text-caption font-medium text-sb-muted">{shortcut}</kbd>
      </button>
    </div>
  );
}
