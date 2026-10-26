// SidebarThemeSwitch.jsx -- Light/Dark control in the sidebar footer: a
// two-option segmented control when expanded, a single round toggle on the
// collapsed rail. Same config.theme / toggleTheme() as ThemeToggle.jsx (which
// the login screens keep using), so the whole app switches together.
import { Moon, Sun } from "lucide-react";
import { useApp } from "../../context/AppContext.jsx";
import { cn } from "../../lib/cn.js";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip.jsx";
import { BTN_RESET, EASE, FOCUS_RING } from "./sidebarStyles.js";

export default function SidebarThemeSwitch({ collapsed, t }) {
  const { config, toggleTheme } = useApp();
  const isDark = config.theme === "dark";

  if (collapsed) {
    const label = isDark ? t("switchToLightMode") : t("switchToDarkMode");
    return (
      <Tooltip delayDuration={150}>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={label}
            className={cn(BTN_RESET, EASE, FOCUS_RING, "mx-auto flex h-10 w-10 items-center justify-center rounded-full border border-sb-field-border bg-sb-field text-sb-active-text hover:bg-sb-hover")}
          >
            {isDark ? <Moon aria-hidden="true" className="h-[18px] w-[18px]" /> : <Sun aria-hidden="true" className="h-[18px] w-[18px]" />}
          </button>
        </TooltipTrigger>
        <TooltipContent side="right">{label}</TooltipContent>
      </Tooltip>
    );
  }

  const option = (on) => cn(
    BTN_RESET, EASE, FOCUS_RING,
    "flex h-9 flex-1 items-center justify-center gap-2 rounded-full text-[13px] font-medium",
    on ? "bg-sb-seg-on text-sb-seg-on-text shadow-sm" : "text-sb-muted hover:text-sb-text"
  );
  return (
    <div role="group" aria-label={t("sidebarThemeGroup")} className="flex gap-1 rounded-full bg-sb-seg p-1">
      <button type="button" aria-pressed={!isDark} onClick={() => { if (isDark) toggleTheme(); }} className={option(!isDark)}>
        <Sun aria-hidden="true" className="h-4 w-4" /> {t("themeLightOption")}
      </button>
      <button type="button" aria-pressed={isDark} onClick={() => { if (!isDark) toggleTheme(); }} className={option(isDark)}>
        <Moon aria-hidden="true" className="h-4 w-4" /> {t("themeDarkOption")}
      </button>
    </div>
  );
}
