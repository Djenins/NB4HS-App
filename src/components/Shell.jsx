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
import { AnimatePresence, m } from "framer-motion";
import { Check, ChevronRight, ChevronsLeft, ChevronsRight, ChevronsUpDown, GraduationCap, LogOut, Menu, Moon, Search, Sun, X } from "lucide-react";
import { Fragment, Suspense, useEffect, useState } from "react";
import { NavLink, Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useApp, useT } from "../context/AppContext.jsx";
import { ORG } from "../lib/constants.js";
import { LOGO_DATA_URI } from "../lib/logo.js";
import { pendingApptCount } from "../lib/appointments.js";
import { NAV_ICONS } from "../lib/navIcons.js";
import { navLabel, navPath, navSectionLabel, navSectionsForItems } from "../lib/nav.js";
import { useNavItems } from "../lib/useNavItems.js";
import { useWorkspace } from "../lib/useWorkspace.js";
import { navKeyForPath } from "../lib/workspaces.js";
import { studentMatchesSearch } from "../lib/students.js";
import { cn } from "../lib/cn.js";
import { roleLabel } from "../lib/utils.js";
import { Avatar, AvatarFallback } from "./ui/avatar.jsx";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "./ui/dropdown-menu.jsx";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip.jsx";
import LangSelect from "./LangSelect.jsx";
import NotificationBell from "./NotificationBell.jsx";
import ThemeToggle from "./ThemeToggle.jsx";

// Shown while a lazily-loaded staff page's chunk is fetched. On a normal
// connection that's under the 300ms delay in .route-loading, so nothing
// flashes; only a genuinely slow fetch shows the thin progress rule.
function RouteLoading({ label }) {
  return (
    <div className="route-loading" role="status" aria-live="polite">
      <span className="route-loading-bar" aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </div>
  );
}

function NavIcon({ name, className }) {
  const Cmp = NAV_ICONS[name] || GraduationCap;
  return <Cmp className={className} strokeWidth={2} />;
}

// Below this width the sidebar is always icon-only, regardless of the
// user's stored preference: at 264px wide it would otherwise eat most of a
// phone screen, and the collapsed rail already has everything it needs
// (icons, badges, tooltips). 767px is the app's existing phone/tablet
// boundary -- main.css already switches layouts at 768px.
//
// This deliberately does NOT write config.sidebarCollapsed. The stored value
// stays whatever the user last chose on a wide screen, so rotating a tablet
// or resizing a window back doesn't silently rewrite their preference.
const MOBILE_SIDEBAR_QUERY = "(max-width: 767px)";

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia(MOBILE_SIDEBAR_QUERY).matches
  );

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return undefined;
    const mql = window.matchMedia(MOBILE_SIDEBAR_QUERY);
    const onChange = (e) => setIsMobile(e.matches);
    setIsMobile(mql.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return isMobile;
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
  // "users" opens Administration, whose other sections (roles, positions)
  // should keep it highlighted too -- but not System Settings (/admin/settings),
  // its own item.
  const path = useLocation().pathname;
  const inAdmin = path.indexOf("/admin/") === 0 && path.indexOf("/admin/settings") !== 0;
  const link = (
    <NavLink
      to={navPath(v)}
      // Collapsed, the link's only content is an icon. The tooltip below
      // covers a mouse, but not a screen reader or a touch device (Radix
      // tooltips don't open on tap) -- which is every phone, now that the
      // rail is the mobile default. So name the link itself.
      aria-label={collapsed ? navLabel(v, lang) : undefined}
      className={({ isActive }) =>
        cn(
          "group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-sidebar-text no-underline transition-colors hover:bg-white/5 hover:text-sidebar-text-active",
          collapsed && "justify-center px-2",
          (isActive || (v === "users" && inAdmin)) && "bg-sidebar-bg-active text-sidebar-text-active"
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
      <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 transition-colors focus-within:border-white/60 focus-within:bg-white/10">
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
          <m.div
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
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// The workspace switcher at the top of the sidebar (plans/unified-access-
// architecture.md §7.2): Home, each program the person can open, and
// Administration. Hidden for people with a single workspace.
function WorkspaceSwitcher({ ws, collapsed, t }) {
  if (!ws.current || ws.workspaces.length < 2) return null;
  const CurrentIcon = ws.current.icon;
  return (
    <div className={cn("px-3 pt-3", collapsed && "px-2")}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={collapsed ? t("wsSwitchLabel") + ": " + t(ws.current.label) : undefined}
            className={cn(
              BTN_RESET,
              "flex w-full items-center gap-2.5 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-left text-sm font-semibold text-white hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60",
              collapsed && "justify-center px-0"
            )}
          >
            <CurrentIcon className="h-[18px] w-[18px] shrink-0" strokeWidth={2} aria-hidden="true" />
            {!collapsed && (
              <>
                <span className="min-w-0 flex-1">
                  <span className="block text-[10px] font-bold uppercase tracking-wider text-sidebar-text">{t("wsSwitchLabel")}</span>
                  <span className="block truncate">{t(ws.current.label)}</span>
                </span>
                <ChevronsUpDown className="h-4 w-4 shrink-0 text-sidebar-text" aria-hidden="true" />
              </>
            )}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" side={collapsed ? "right" : "bottom"} className="min-w-[232px]">
          <DropdownMenuLabel>{t("wsSwitchLabel")}</DropdownMenuLabel>
          {ws.workspaces.map((w) => (
            <DropdownMenuItem key={w.key} onSelect={() => ws.switchTo(w.key)}>
              <w.icon className="h-4 w-4" aria-hidden="true" />
              <span className="flex-1">{t(w.label)}</span>
              {w.key === ws.current.key ? <Check className="h-4 w-4 text-primary" aria-label={t("wsCurrent")} /> : null}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
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
  // Must stay above the early returns below: hooks have to run in the same
  // order every render, and the first render (authLoading) returns early.
  const isMobile = useIsMobile();
  const nav = useNavItems();
  const ws = useWorkspace(!kiosk && session ? nav.items : [], session ? session.primaryWorkspace : null);
  // Phones: the sidebar is an off-canvas drawer; it closes on every navigation.
  const [drawerOpen, setDrawerOpen] = useState(false);
  useEffect(() => { setDrawerOpen(false); }, [location.pathname]);

  // Wait for Supabase to finish restoring any existing session before
  // deciding to redirect -- otherwise a valid session in localStorage loses
  // the race against this render and gets bounced to the kiosk home.
  if (authLoading) return null;
  if (!session && !kiosk) return <Navigate to="/" replace />;

  // The kiosk landing page (CheckIn.jsx) is a full-bleed self-service
  // design that owns its own header/footer chrome -- skip Shell's default
  // topbar/footer-note there instead of nesting one inside the other.
  const isKioskLanding = kiosk && location.pathname === "/checkin";
  // Both check-in screens (CheckInVisitor.jsx's form and CheckInStudent.jsx's
  // class rosters) are landscape kiosk layouts -- sidebar | content | action
  // panel -- so they need the full width of the content column rather than
  // <main>'s usual 1200px reading measure, and (on a landscape screen) a
  // definite height so their centre column can scroll on its own instead of
  // scrolling the whole page. Both come from main--kiosk-form in main.css.
  // In kiosk mode the form also drops Shell's prototype footer note: the
  // kiosk frame has its own closing line, and the landing screen already
  // hides that note in kiosk mode for the same reason.
  const isKioskForm = location.pathname === "/checkin/visitor" || location.pathname === "/checkin/student";
  // The public appointment lookup (AppointmentLookup.jsx) is the other half
  // of that same visitor-facing design: it carries the NB4HS logo, the Back
  // control and the language picker inside its own frame, so Shell's topbar
  // would only repeat them. It also wants the full width of the content
  // column rather than <main>'s 1200px reading measure -- see
  // main--appt-lookup in main.css.
  const isApptLookup = location.pathname === "/appointments/lookup";
  // The public appointment request form and its confirmation screen are the
  // third screen of that same visitor-facing family (ApptRequest.jsx /
  // ApptRequestSuccess.jsx) and carry their own logo/Back/language header for
  // the same reason -- see main--appt-request in main.css.
  const isApptRequest = location.pathname.indexOf("/appointments/request") === 0;
  // The shared calendar is an internal productivity screen whose week grid
  // needs the whole content column rather than <main>'s 1200px reading
  // measure -- see main--calendar in main.css. It keeps Shell's topbar; only
  // the width/padding changes.
  const isCalendar = location.pathname === "/calendar";

  const role = session ? session.role : null;
  const items = !kiosk && role ? nav.items : [];
  const showSidebar = !kiosk && role && items.length > 0;
  // The current workspace's pages: Home keeps its section headings; a
  // program workspace is one list under its own name. Shared links follow.
  const current = ws.current;
  const displaySections = !current ? []
    : current.key === "home" ? navSectionsForItems(current.items)
    : [{ key: current.key, label: t(current.label), items: current.items }];
  const sharedItems = ws.shared;
  const pageKey = navKeyForPath(location.pathname);
  const badgeCounts = {
    casemanagement: pendingApptCount(data.appointments, "case_manager"),
    jobdeveloper: pendingApptCount(data.appointments, "job_developer")
  };
  const showStudentSearch = items.indexOf("students") !== -1;
  // The rail is a wide-screen preference; phones get the full drawer instead.
  const collapsed = showSidebar && !isMobile && !!config.sidebarCollapsed;
  const displayName = session ? (session.currentUserName || session.currentUserEmail || "") : "";
  const nameParts = displayName.trim().split(/\s+/).filter(Boolean);
  const initials = (nameParts.length ? (nameParts[0].charAt(0) + (nameParts[1] ? nameParts[1].charAt(0) : "")) : "?").toUpperCase();

  return (
    <Fragment>
      <TooltipProvider>
        <div className="app-shell">
          {showSidebar && isMobile && drawerOpen && (
            <div className="fixed inset-0 z-[1099] bg-surface-overlay" onMouseDown={() => setDrawerOpen(false)} aria-hidden="true" />
          )}
          {showSidebar && (
            <aside
              id="app-sidebar"
              aria-label={t("navMainLabel")}
              className={cn(
                "flex flex-col overflow-y-auto border-r border-sidebar-border bg-sidebar-bg",
                isMobile
                  ? cn("fixed inset-y-0 left-0 z-[1100] w-[288px] max-w-[85vw] shadow-overlay transition-transform duration-200", drawerOpen ? "translate-x-0" : "-translate-x-full invisible")
                  : cn("sticky top-0 h-screen transition-[width] duration-200", collapsed ? "w-[76px]" : "w-[264px]")
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
                {isMobile && (
                  <button
                    type="button"
                    onClick={() => setDrawerOpen(false)}
                    aria-label={t("closeLabel")}
                    className={cn(BTN_RESET, "flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-sidebar-text hover:bg-white/10 hover:text-white")}
                  >
                    <X className="h-5 w-5" />
                  </button>
                )}
                {!isMobile && (
                  <button
                    type="button"
                    onClick={() => updateConfig({ sidebarCollapsed: !collapsed })}
                    aria-label={collapsed ? t("expandSidebarLabel") : t("collapseSidebarLabel")}
                    title={collapsed ? t("expandSidebarLabel") : t("collapseSidebarLabel")}
                    className={cn(BTN_RESET, "flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-sidebar-text hover:bg-white/10 hover:text-white", collapsed && "hidden")}
                  >
                    <ChevronsLeft className="h-4 w-4" />
                  </button>
                )}
              </div>

              {collapsed && !isMobile && (
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

              <WorkspaceSwitcher ws={ws} collapsed={collapsed} t={t} />

              {showStudentSearch && !collapsed && current && current.key === "students" && <div className="pt-3"><SidebarSearch students={data.students} classes={data.classes} t={t} /></div>}

              <nav className="flex-1 space-y-5 px-3 py-3" aria-label={current ? t(current.label) : t("navMainLabel")}>
                {displaySections.map((section) => (
                  <div key={section.key}>
                    {!collapsed && (
                      // Small gold section marker dot -- the brand spec's "left
                      // panels: add subtle gold accents (section markers)"
                      // applied sparingly, not a recolor of the label itself.
                      <div className="flex items-center gap-1.5 px-3 pb-1.5 text-[11px] font-bold uppercase tracking-wider text-sidebar-text/70">
                        <span className="h-1 w-1 shrink-0 rounded-full bg-gold" />
                        {section.label || navSectionLabel(section.key, lang)}
                      </div>
                    )}
                    <div className="space-y-0.5">
                      {section.items.map((v) => (
                        <NavItem key={v} v={v} lang={lang} collapsed={collapsed} badgeCount={badgeCounts[v] || 0} />
                      ))}
                    </div>
                  </div>
                ))}
                {sharedItems.length ? (
                  // Reachable from every workspace.
                  <div className="space-y-0.5 border-t border-sidebar-border pt-3">
                    {sharedItems.map((v) => (
                      <NavItem key={v} v={v} lang={lang} collapsed={collapsed} badgeCount={0} />
                    ))}
                  </div>
                ) : null}
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
            {!isKioskLanding && !isApptLookup && !isApptRequest && (
              <header className="topbar">
                {showSidebar && isMobile && (
                  <button
                    type="button"
                    onClick={() => setDrawerOpen(true)}
                    aria-label={t("openMenuLabel")}
                    aria-controls="app-sidebar"
                    aria-expanded={drawerOpen}
                    className={cn(BTN_RESET, "flex h-11 w-11 items-center justify-center rounded-lg text-card-foreground hover:bg-surface-sunken")}
                  >
                    <Menu className="h-5 w-5" />
                  </button>
                )}
                {showSidebar && current && pageKey && navLabel(pageKey, lang) ? (
                  <nav aria-label={t("breadcrumbLabel")} className="no-print min-w-0">
                    <ol className="m-0 flex min-w-0 list-none items-center gap-1.5 p-0 text-meta text-muted">
                      <li className="truncate">{t(current.label)}</li>
                      <li aria-hidden="true"><ChevronRight className="h-3.5 w-3.5" /></li>
                      <li className="truncate font-semibold text-card-foreground" aria-current="page">{navLabel(pageKey, lang)}</li>
                    </ol>
                  </nav>
                ) : null}
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
              <main id="main-content" tabIndex={-1} className={cn(isKioskForm && "main--kiosk-form", isApptLookup && "main--appt-lookup", isApptRequest && "main--appt-request", isCalendar && "main--calendar")}>
                <Suspense fallback={<RouteLoading label={t("pageLoading")} />}>
                  <Outlet />
                </Suspense>
              </main>
            )}

            {!isKioskLanding && !isApptLookup && !isApptRequest && !(kiosk && isKioskForm) && <div className="footer-note no-print">{ORG.name} — {t("prototypeNotice")}</div>}
          </div>
        </div>
      </TooltipProvider>
    </Fragment>
  );
}
