// SidebarFooter.jsx -- the signed-in staff member (initials avatar, name,
// role; opens the account menu with Your profile and Sign out), the
// notifications bell with
// its real unread count, and the Light/Dark switch. Everything comes from
// the live session -- nothing here is sample data.
import { LogOut, UserRound } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../../context/AppContext.jsx";
import { cn } from "../../lib/cn.js";
import { roleLabel } from "../../lib/utils.js";
import NotificationBell from "../NotificationBell.jsx";
import { Avatar, AvatarFallback } from "../ui/avatar.jsx";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../ui/dropdown-menu.jsx";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip.jsx";
import { BTN_RESET, EASE, FOCUS_RING } from "./sidebarStyles.js";
import SidebarThemeSwitch from "./SidebarThemeSwitch.jsx";

function initialsOf(name) {
  const parts = (name || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return (parts[0].charAt(0) + (parts[1] ? parts[1].charAt(0) : "")).toUpperCase();
}

const BELL = cn(FOCUS_RING, "h-10 w-10 rounded-xl text-sb-icon hover:bg-sb-hover hover:text-sb-text");

export default function SidebarFooter({ collapsed, t }) {
  const { session, logout } = useApp();
  const navigate = useNavigate();
  const name = session ? (session.currentUserName || session.currentUserEmail || "") : "";
  const role = roleLabel(session && session.role, "en");

  const avatar = (
    <Avatar className="h-10 w-10 ring-1 ring-sb-border">
      <AvatarFallback className="bg-sb-active text-[13px] text-sb-active-text">{initialsOf(name)}</AvatarFallback>
    </Avatar>
  );

  const menu = (trigger) => (
    <DropdownMenu>
      {trigger}
      <DropdownMenuContent align="start" side={collapsed ? "right" : "top"}>
        <div className="px-2.5 py-1.5">
          <div className="truncate text-sm font-semibold">{name}</div>
          <div className="truncate text-xs text-muted">{role}</div>
        </div>
        <DropdownMenuItem onSelect={() => navigate("/profile")}>
          <UserRound className="h-4 w-4" /> {t("profileMenuItem")}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={logout}>
          <LogOut className="h-4 w-4" /> {t("signOut")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  if (collapsed) {
    return (
      <div className="flex flex-col items-center gap-2 border-t border-sb-divider px-3 pb-4 pt-3">
        <NotificationBell side="right" className={BELL} />
        {menu(
          <Tooltip delayDuration={150}>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <button type="button" aria-label={t("sidebarAccountMenu") + ": " + name} className={cn(BTN_RESET, FOCUS_RING, "rounded-full")}>
                  {avatar}
                </button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent side="right">{name}</TooltipContent>
          </Tooltip>
        )}
        <SidebarThemeSwitch collapsed t={t} />
      </div>
    );
  }

  return (
    <div className="space-y-3 border-t border-sb-divider px-4 pb-4 pt-3">
      <div className="flex items-center gap-1">
        {menu(
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label={t("sidebarAccountMenu") + ": " + name}
              className={cn(BTN_RESET, EASE, FOCUS_RING, "flex min-w-0 flex-1 items-center gap-3 rounded-xl p-1 text-left hover:bg-sb-hover")}
            >
              {avatar}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px] font-semibold leading-snug text-sb-text">{name}</span>
                <span className="block truncate text-[12px] leading-snug text-sb-muted">{role}</span>
              </span>
            </button>
          </DropdownMenuTrigger>
        )}
        <NotificationBell side="top" className={BELL} />
      </div>
      <SidebarThemeSwitch t={t} />
    </div>
  );
}
