// Shell.jsx -- the app frame every non-login screen renders inside: a left
// sidebar (brand + grouped nav) and a right-hand content column (a slim
// header, the page itself, and the footer note). react-router layout route
// (renders <Outlet/> for whichever page matches the current path).
//
// Access rule (unchanged from every earlier version of this file): reachable
// either (a) signed in (session set), or (b) in kiosk mode (public check-in/
// appt-request terminal, no login required). Anything else bounces to "/".
// Kiosk mode shows no sidebar at all.
//
// Tailwind/shadcn/Radix/Lucide/Framer Motion redesign pass (client-provided
// NB4HS dashboard mockup): the sidebar is now a permanently dark-navy brand
// shell (like Linear/Vercel-style admin panels) independent of the app's
// Light/Dark *content* theme toggle -- that toggle still only affects the
// main content column, via the same `data-theme` attribute/ThemeToggle
// mechanism as before. Every color here is one of the NB4HS brand tokens
// from tailwind.config.js (sidebar-bg/sidebar-bg-active/etc. are fixed navy
// shades sampled from --primary/--primary-dark, not new hues), and every
// nav item is a real, existing NB4HS route -- the mockup's grouping
// ("Overview / Client Management / Programs / Operations / Administration")
// is reproduced via NAV_SECTION (constants.js) mapped onto the *real* nav
// vocabulary, not the mockup's literal (partly fictional) item labels.
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, ChevronsLeft, ChevronsRight, GraduationCap, LogOut, Moon, Search, Sun } from "lucide-react";
import { Fragment, useState } from "react";
import { NavLink, Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useApp, useT } from "../context/AppContext.jsx";
import { ORG } from "../lib/constants.js";
import { LOGO_DATA_URI } from "../lib/logo.js";
import { pendingApptCount } from "../lib/appointments.js";
import { NAV_ICONS } from "../lib/navIcons.js";
import { enabledWorkforceRoles, navItemsForRole, navLabel, navPath, navSectionLabel, navSectionsForItems } from "../lib/nav.js";
import { studentMatchesSearch } from "../lib/students.js";
import { cn } from "../lib/cn.js";
import { roleLabel } from "../lib/utils.js";
import { Avatar, AvatarFallback } from "./ui/avatar.jsx";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "./ui/dropdown-menu.jsx";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip.jsx";
import LangSelect from "./LangSelect.jsx";
import NotificationBell from "./NotificationBell.jsx";
import ThemeToggle from "./ThemeToggle.jsx";

function NavIcon({ name, className }) {
  const Cmp = NAV_ICONS[name] || GraduationCap;
  return <Cmp className={className} strokeWidth={2} />;
}

// main.css still has a global `button, .btn{ min-height:52px; padding:12px
// 20px; border:2px solid transparent; font-weight:600; }` rule for the
// rest of the app's plain (non-Tailwind) buttons. Tailwind's preflight
// reset is intentionally OFF (see tailwind.config.js) so it doesn't touch
// those other pages -- which means every *new* Tailwind-styled <button> in
// this file has to explicitly cancel that legacy rule itself, or it
// inflates/misshapes (that's what was wrong with the sidebar's icon
// buttons and the Light/Dark pill). Every raw <button> below starts with
// this.
const BTN_RESET = "min-h-0 border-0 bg-transparent p-0 font-normal leading-none";

function NavItem({ v, lang, collapsed, badgeCount }) {
  const link = (
    <NavLink
      to={navPath(v)}
      className={({ isActive }) =>
        cn(
          "group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-sidebar-text no-underline transition-colors hover:bg-white/5 hover:text-sidebar-text-active",
          collapsed && "justify-center px-2",
          isActive && "bg-sidebar-bg-active text-sidebar-text-active"
        )
      }
    >
      <NavIcon name={v} className="h-[18px] w-[18px] shrink-0" />
      {!collapsed && <span className="truncate">{navLabel(v, lang)}</span>}
      {badgeCount > 0 && (
        // Pending-count indicator, not an error -- brand system reserves red
        // for errors/validation/destructive actions, so this uses the gold
        // accent (a "highlight, something needs attention" cue) instead.
        <span
          className={cn(
            "flex h-5 min-w-[20px] items-center justify-center rounded-full bg-gold px-1 text-[11px] font-bold text-navy",
            collapsed ? "absolute -right-1 -top-1" : "ml-auto"
          )}
        >
          {badgeCount > 9 ? "9+" : badgeCount}
        </span>
      )}
    </NavLink>
  );

  if (!collapsed) return link;
  return (
    <Tooltip delayDuration={150}>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent side="right">{navLabel(v, lang)}</TooltipContent>
    </Tooltip>
  );
}

// Sidebar-embedded student lookup ("search a student" shortcut) -- only
// rendered for roles that have the Students nav item at all. Typeahead over
// data.students reusing studentMatchesSearch() (the same matching rules the
// Students board's own search box uses). Picking a result hands the query
// to Students.jsx via router state instead of building a second results
// view -- the Students board already knows how to render a filtered roster.
function SidebarSearch({ students, classes, t }) {
  const navigate = useNavigate();
  const [term, setTerm] = useState("");
  const query = term.trim().toLowerCase();
  const matches = query ? students.filter((s) => studentMatchesSearch(s, query)).slice(0, 6) : [];

  function classLabelFor(s) {
    if (!s.classKey) return t("waitingList");
    const c = classes.find((cc) => cc.key === s.classKey);
    return c ? c.name : s.classKey;
  }

  function goToStudent(s) {
    setTerm("");
    navigate("/students", { state: { presetSearch: s.studentId || ((s.firstName || "") + " " + (s.lastName || "")) } });
  }

  return (
    <div className="relative px-3 pb-2">
      <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2">
        <Search className="h-4 w-4 shrink-0 text-sidebar-text" strokeWidth={2} />
        <input
          type="text"
          placeholder={t("sidebarSearchPlaceholder")}
          aria-label={t("sidebarSearchPlaceholder")}
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          className="!min-h-0 w-full !border-none !bg-transparent !p-0 text-sm !text-white placeholder:!text-sidebar-text focus:!outline-none focus:!ring-0"
        />
      </div>
      <AnimatePresence>
        {query && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.12 }}
            className="absolute left-3 right-3 top-[calc(100%+2px)] z-30 max-h-64 overflow-y-auto rounded-lg border border-border bg-card shadow-card-hover"
          >
            {matches.length ? (
              matches.map((s) => (
                <button
                  type="button"
                  key={s.id}
                  onClick={() => goToStudent(s)}
                  className={cn(BTN_RESET, "flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left hover:bg-background")}
                >
                  <span className="text-sm font-semibold text-card-foreground">{s.firstName} {s.lastName}</span>
                  <span className="text-xs text-muted">{s.studentId} · {classLabelFor(s)}</span>
                </button>
              ))
            ) : (
              <div className="px-3 py-2 text-sm text-muted">{t("sidebarNoStudentResults")}</div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Compact Light/Dark control for the sidebar footer. This is a separate,
// dark-chrome-tuned build from components/ThemeToggle.jsx (which stays
// exactly as it is for AuthShell.jsx's light login-panel controls) -- same
// underlying config.theme/toggleTheme(), just styled for a permanently dark
// sidebar instead of a light card surface.
function SidebarThemeToggle({ collapsed }) {
  const { config, toggleTheme } = useApp();
  const t = useT();
  const isDark = config.theme === "dark";

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={toggleTheme}
        aria-label={isDark ? t("switchToLightMode") : t("switchToDarkMode")}
        title={isDark ? t("switchToLightMode") : t("switchToDarkMode")}
        className={cn(BTN_RESET, "flex h-9 w-9 items-center justify-center self-center rounded-lg text-sidebar-text hover:bg-white/5 hover:text-white")}
      >
        {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </button>
    );
  }

  return (
    <div className="flex gap-1 rounded-lg border border-white/10 bg-white/5 p-1">
      <button
        type="button"
        onClick={() => { if (isDark) toggleTheme(); }}
        title={t("switchToLightMode")}
        className={cn(
          BTN_RESET,
          "flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-semibold text-sidebar-text",
          !isDark && "bg-white/15 text-white"
        )}
      >
        <Sun className="h-3.5 w-3.5" /> {t("themeLightOption")}
      </button>
      <button
        type="button"
        onClick={() => { if (!isDark) toggleTheme(); }}
        title={t("switchToDarkMode")}
        className={cn(
          BTN_RESET,
          "flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-semibold text-sidebar-text",
          isDark && "bg-white/15 text-white"
        )}
      >
        <Moon className="h-3.5 w-3.5" /> {t("themeDarkOption")}
      </button>
    </div>
  );
}

export default function Shell() {
  const { data, session, authLoading, kiosk, logout, lang, config, updateConfig } = useApp();
  const t = useT();
  const location = useLocation();
  // null = "no manual override yet, default to expanded whenever a Workforce
  // page is the active route" -- once the user actually clicks the toggle,
  // that choice sticks regardless of route (same as any collapsible sidebar
  // section elsewhere). Declared here (not after the early returns below) so
  // it isn't a conditionally-called hook.
  const [workforceOpenOverride, setWorkforceOpenOverride] = useState(null);

  // Wait for Supabase to finish restoring any existing session before
  // deciding to redirect -- otherwise a valid session in localStorage loses
  // the race against this render and gets bounced to the kiosk home.
  if (authLoading) return null;
  if (!session && !kiosk) return <Navigate to="/" replace />;

  // The kiosk landing page (CheckIn.jsx) is a full-bleed self-service
  // design that owns its own header/footer chrome -- skip Shell's default
  // topbar/footer-note there instead of nesting one inside the other.
  const isKioskLanding = kiosk && location.pathname === "/checkin";

  const role = session ? session.role : null;
  const items = !kiosk && role ? navItemsForRole(role, enabledWorkforceRoles(data.workforceRoleAccess)) : [];
  const showSidebar = !kiosk && role && items.length > 0;
  const sections = navSectionsForItems(items);
  const workforceSection = sections.find((s) => s.key === "workforceDevelopment");
  // Workforce doesn't get its own top-level heading -- it renders nested
  // inside "programs" instead (see the nav render loop below). If a role
  // somehow has Workforce access but no other Programs items (e.g.
  // receptionist granted access via Settings), fall back to leaving it as
  // its own section rather than dropping it from the sidebar.
  const hasPrograms = sections.some((s) => s.key === "programs");
  const displaySections = hasPrograms ? sections.filter((s) => s.key !== "workforceDevelopment") : sections;
  const isWorkforceActive = !!workforceSection && workforceSection.items.some((v) => location.pathname === navPath(v) || location.pathname.startsWith(navPath(v) + "/"));
  const workforceOpen = workforceOpenOverride !== null ? workforceOpenOverride : isWorkforceActive;
  const badgeCounts = {
    casemanagement: pendingApptCount(data.appointments, "case_manager"),
    jobdeveloper: pendingApptCount(data.appointments, "job_developer")
  };
  const showStudentSearch = items.indexOf("students") !== -1;
  const collapsed = showSidebar && !!config.sidebarCollapsed;
  const displayName = session ? (session.currentUserName || session.currentUserEmail || "") : "";
  const nameParts = displayName.trim().split(/\s+/).filter(Boolean);
  const initials = (nameParts.length ? (nameParts[0].charAt(0) + (nameParts[1] ? nameParts[1].charAt(0) : "")) : "?").toUpperCase();

  return (
    <Fragment>
      <TooltipProvider>
        <div className="app-shell">
          {showSidebar && (
            <aside
              className={cn(
                "sticky top-0 flex h-screen flex-col overflow-y-auto border-r border-sidebar-border bg-sidebar-bg transition-[width] duration-200",
                collapsed ? "w-[76px]" : "w-[264px]"
              )}
            >
              <div className={cn("flex items-center gap-2 border-b border-sidebar-border px-4 py-4", collapsed && "justify-center px-2")}>
                <img src={LOGO_DATA_URI} alt={ORG.name} className="h-8 w-8 shrink-0 rounded bg-white/90 object-contain p-0.5" />
                {!collapsed && (
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-extrabold text-white">{ORG.shortName}</div>
                    <div className="truncate text-[11px] font-medium text-sidebar-text">{t("appTitle")}</div>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => updateConfig({ sidebarCollapsed: !collapsed })}
                  aria-label={collapsed ? t("expandSidebarLabel") : t("collapseSidebarLabel")}
                  title={collapsed ? t("expandSidebarLabel") : t("collapseSidebarLabel")}
                  className={cn(BTN_RESET, "flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-sidebar-text hover:bg-white/10 hover:text-white", collapsed && "hidden")}
                >
                  <ChevronsLeft className="h-4 w-4" />
                </button>
              </div>

              {collapsed && (
                <button
                  type="button"
                  onClick={() => updateConfig({ sidebarCollapsed: false })}
                  aria-label={t("expandSidebarLabel")}
                  title={t("expandSidebarLabel")}
                  className={cn(BTN_RESET, "mx-auto mt-2 flex h-7 w-7 items-center justify-center rounded-md text-sidebar-text hover:bg-white/10 hover:text-white")}
                >
                  <ChevronsRight className="h-4 w-4" />
                </button>
              )}

              {showStudentSearch && !collapsed && <SidebarSearch students={data.students} classes={data.classes} t={t} />}

              <nav className="flex-1 space-y-5 px-3 py-3" aria-label={t("navManage")}>
                {displaySections.map((section) => (
                  <div key={section.key}>
                    {!collapsed && (
                      // Small gold section marker dot -- the brand spec's "left
                      // panels: add subtle gold accents (section markers)"
                      // applied sparingly, not a recolor of the label itself.
                      <div className="flex items-center gap-1.5 px-3 pb-1.5 text-[11px] font-bold uppercase tracking-wider text-sidebar-text/70">
                        <span className="h-1 w-1 shrink-0 rounded-full bg-gold" />
                        {navSectionLabel(section.key, lang)}
                      </div>
                    )}
                    <div className="space-y-0.5">
                      {section.items.map((v) => (
                        <NavItem key={v} v={v} lang={lang} collapsed={collapsed} badgeCount={badgeCounts[v] || 0} />
                      ))}
                    </div>
                    {section.key === "programs" && workforceSection && (
                      // Workforce lives nested inside Programs as a real
                      // collapsible submenu (toggle row + indented children)
                      // rather than its own top-level heading.
                      collapsed ? (
                        <div className="mt-0.5 space-y-0.5">
                          {workforceSection.items.map((v) => (
                            <NavItem key={v} v={v} lang={lang} collapsed={collapsed} badgeCount={badgeCounts[v] || 0} />
                          ))}
                        </div>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => setWorkforceOpenOverride(!workforceOpen)}
                            aria-expanded={workforceOpen}
                            className={cn(
                              "group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-sidebar-text no-underline transition-colors hover:bg-white/5 hover:text-sidebar-text-active",
                              BTN_RESET,
                              isWorkforceActive && !workforceOpen && "bg-sidebar-bg-active text-sidebar-text-active"
                            )}
                          >
                            <NavIcon name="workforceDevelopmentGroup" className="h-[18px] w-[18px] shrink-0" />
                            <span className="flex-1 truncate text-left">{navSectionLabel("workforceDevelopment", lang)}</span>
                            <ChevronDown className={cn("h-4 w-4 shrink-0 transition-transform", workforceOpen && "rotate-180")} />
                          </button>
                          {workforceOpen && (
                            <div className="mt-0.5 space-y-0.5 border-l border-white/10 pl-3.5">
                              {workforceSection.items.map((v) => (
                                <NavItem key={v} v={v} lang={lang} collapsed={collapsed} badgeCount={badgeCounts[v] || 0} />
                              ))}
                            </div>
                          )}
                        </>
                      )
                    )}
                  </div>
                ))}
              </nav>

              <div className={cn("flex flex-col gap-3 border-t border-sidebar-border p-3", collapsed && "items-center")}>
                <div className={cn("flex items-center gap-2", collapsed ? "flex-col" : "justify-between")}>
                  <SidebarThemeToggle collapsed={collapsed} />
                  <div className="text-sidebar-text"><NotificationBell /></div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className={cn(
                        BTN_RESET,
                        "flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-left hover:bg-white/5",
                        collapsed && "justify-center px-0"
                      )}
                    >
                      <Avatar className="h-8 w-8 border border-white/10">
                        <AvatarFallback className="bg-white/10 text-white">{initials}</AvatarFallback>
                      </Avatar>
                      {!collapsed && (
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-semibold text-white">{displayName}</div>
                          <div className="truncate text-xs text-sidebar-text">{roleLabel(role, lang)}</div>
                        </div>
                      )}
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" side="top">
                    <div className="px-2.5 py-1.5">
                      <div className="truncate text-sm font-semibold">{displayName}</div>
                      <div className="truncate text-xs text-muted">{roleLabel(role, lang)}</div>
                    </div>
                    <DropdownMenuItem onSelect={logout}>
                      <LogOut className="h-4 w-4" /> {t("signOut")}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </aside>
          )}

          <div className={isKioskLanding ? "content-col content-col--kiosk-landing" : "content-col"}>
            {!isKioskLanding && (
              <header className="topbar">
                {!showSidebar && (
                  <div className="brand">
                    <img src={LOGO_DATA_URI} alt={ORG.name} />
                    <span className="brand-sub no-print">{t("appTitle")}</span>
                  </div>
                )}
                <div className="no-print" style={{ display: "flex", alignItems: "center", gap: 12, marginLeft: "auto" }}>
                  {session && !showSidebar && <NotificationBell />}
                  {!showSidebar && <ThemeToggle compact />}
                  <LangSelect />
                </div>
              </header>
            )}

            {isKioskLanding ? (
              <Outlet />
            ) : (
              <main id="main-content" tabIndex={-1}>
                <Outlet />
              </main>
            )}

            {!isKioskLanding && <div className="footer-note no-print">{ORG.name} — {t("prototypeNotice")}</div>}
          </div>
        </div>
      </TooltipProvider>
    </Fragment>
  );
}
