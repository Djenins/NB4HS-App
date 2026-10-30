// SidebarBrand.jsx -- the sidebar's top row: the NB4HS logo (the real
// wordmark from lib/logo.js, on a white tile so its navy reads in dark mode
// too), the app name, and the collapse control.
//
// Collapsed, the logo tile *is* the expand control: it swaps to a
// chevron on hover/focus and is named "Expand sidebar". In the mobile drawer
// the control is a Close button instead.
import { ChevronsLeft, ChevronsRight, X } from "lucide-react";
import { ORG } from "../../lib/constants.js";
import { LOGO_URL } from "../../lib/logo.js";
import { cn } from "../../lib/cn.js";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip.jsx";
import { BTN_RESET, EASE, FOCUS_RING } from "./sidebarStyles.js";

const TILE = "flex shrink-0 items-center justify-center rounded-xl border border-sb-border bg-white";

export default function SidebarBrand({ collapsed, drawer, appTitle, onToggle, onClose, t }) {
  if (collapsed) {
    return (
      <div className="flex justify-center px-3 pb-3 pt-4">
        <Tooltip delayDuration={150}>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={onToggle}
              aria-label={t("expandSidebarLabel")}
              className={cn(BTN_RESET, TILE, EASE, FOCUS_RING, "group relative h-11 w-11 hover:border-sb-field-border")}
            >
              <img src={LOGO_URL} alt="" className="h-auto w-9 transition-opacity duration-150 group-hover:opacity-0 group-focus-visible:opacity-0 motion-reduce:transition-none" />
              <ChevronsRight aria-hidden="true" className="absolute h-[18px] w-[18px] text-slate-600 opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100 motion-reduce:transition-none" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">{t("expandSidebarLabel")}</TooltipContent>
        </Tooltip>
      </div>
    );
  }

  const ControlIcon = drawer ? X : ChevronsLeft;
  return (
    <div className="flex items-center gap-3 px-4 pb-3 pt-4">
      <div className={cn(TILE, "h-11 px-2")}>
        <img src={LOGO_URL} alt={ORG.name} className="h-[30px] w-auto" />
      </div>
      <div className="min-w-0 flex-1 text-[12px] font-medium leading-tight text-sb-muted">{appTitle}</div>
      <button
        type="button"
        onClick={drawer ? onClose : onToggle}
        aria-label={drawer ? t("sidebarCloseMenu") : t("collapseSidebarLabel")}
        title={drawer ? t("sidebarCloseMenu") : t("collapseSidebarLabel")}
        className={cn(BTN_RESET, EASE, FOCUS_RING, "flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-sb-field text-sb-icon hover:bg-sb-hover hover:text-sb-text")}
      >
        <ControlIcon aria-hidden="true" className="h-[17px] w-[17px]" strokeWidth={2} />
      </button>
    </div>
  );
}
