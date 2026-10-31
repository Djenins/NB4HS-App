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
// The sidebar is the floating, theme-aware AppSidebar (components/sidebar/),
// mounted here once so every staff page -- Workforce, SNAP, Adult
// Education, Case Management and the rest -- shares the same navigation.
// Which entries it shows comes from the signed-in person's permissions
// (useNavItems: my_permissions(), with today's role rules as the fallback
// while they load); Shell picks the layout (floating rail, tablet rail,
// phone drawer), owns the ⌘K search palette, and shows a breadcrumb --
// workspace › page -- in the topbar (plans/unified-access-architecture.md
// §7.2).
import { AnimatePresence } from "framer-motion";
import { ChevronRight, Menu } from "lucide-react";
import { Fragment, Suspense, useEffect, useState } from "react";
import { Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useApp, useStaffT } from "../context/AppContext.jsx";
import { isClientFacingPath } from "../lib/i18n.js";
import { ORG } from "../lib/constants.js";
import { LOGO_URL } from "../lib/logo.js";
import { pendingApptCount } from "../lib/appointments.js";
import { navLabel } from "../lib/nav.js";
import { useNavItems } from "../lib/useNavItems.js";
import { navKeyForPath, visibleWorkspaces, workspaceOfItem } from "../lib/workspaces.js";
import { fetchOutreachPrograms } from "../lib/outreachPrograms.js";
import { searchPlaceholderKey, searchScopes } from "../lib/commandSearch.js";
import { routeAllowed } from "./RequireRoute.jsx";
import { cn } from "../lib/cn.js";
import { TooltipProvider } from "./ui/tooltip.jsx";
import AppSidebar from "./sidebar/AppSidebar.jsx";
import CommandPalette from "./sidebar/CommandPalette.jsx";
import SidebarDrawer from "./sidebar/SidebarDrawer.jsx";
import { sidebarSections } from "./sidebar/sidebarNav.js";
import KioskTopBar from "./kiosk/KioskTopBar.jsx";
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

// Three layouts, by viewport width:
//   * desktop (>= 1280px): the floating sidebar, expanded or collapsed per
//     the user's stored preference (config.sidebarCollapsed)
//   * tablet (768-1279px): starts as the collapsed icon rail; it can be
//     expanded for the visit, and that never rewrites the stored preference
//   * phone (< 768px): no rail at all -- a menu button in the topbar opens
//     the sidebar as a drawer
// 767px is the app's existing phone/tablet boundary (main.css switches
// layouts at 768px).
const MOBILE_QUERY = "(max-width: 767px)";
const DESKTOP_QUERY = "(min-width: 1280px)";

function useMediaQuery(query) {
  const [matches, setMatches] = useState(
    () => typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia(query).matches
  );

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return undefined;
    const mql = window.matchMedia(query);
    const onChange = (e) => setMatches(e.matches);
    setMatches(mql.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [query]);

  return matches;
}

function useViewport() {
  const isMobile = useMediaQuery(MOBILE_QUERY);
  const isDesktop = useMediaQuery(DESKTOP_QUERY);
  return isMobile ? "mobile" : isDesktop ? "desktop" : "tablet";
}

// The outreach programs this person can open become their own sidebar
// entries (SNAP). Fetched once per signed-in user; RLS decides what comes
// back. Until it lands -- or if it fails -- the sidebar shows the single
// Outreach entry it always had.
function useOutreachPrograms(enabled, userKey) {
  const [programs, setPrograms] = useState(null);
  useEffect(() => {
    if (!enabled) return undefined;
    let live = true;
    fetchOutreachPrograms().then((list) => { if (live) setPrograms(list); }).catch(() => {});
    return () => { live = false; };
  }, [enabled, userKey]);
  return programs;
}

export default function Shell() {
  const { data, session, authLoading, kiosk, setKiosk, config, updateConfig, can } = useApp();
  // Staff chrome is English-only; client screens below carry their own
  // translated top bar.
  const t = useStaffT();
  const lang = "en";
  const navigate = useNavigate();
  const location = useLocation();
  // Everything from here to the early returns below must run on every
  // render: hooks have to keep the same order, and the first render
  // (authLoading) returns early.
  const viewport = useViewport();
  const [tabletExpanded, setTabletExpanded] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const nav = useNavItems();

  const role = session ? session.role : null;
  const items = !kiosk && role ? nav.items : [];
  const showSidebar = !authLoading && !kiosk && !!role && items.length > 0;
  const outreachPrograms = useOutreachPrograms(items.indexOf("outreach") !== -1, session ? session.currentUserEmail : "");

  // The drawer closes on navigation and when the window grows past phone width.
  useEffect(() => { setDrawerOpen(false); }, [location.pathname, viewport]);

  // ⌘K / Ctrl+K opens the search palette from anywhere in the staff app.
  useEffect(() => {
    if (!showSidebar) return undefined;
    function onKeyDown(e) {
      if ((e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        setDrawerOpen(false);
        setPaletteOpen((open) => !open);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [showSidebar]);
  // Someone signed out on a client screen (a phone that opened a kiosk link,
  // refreshed, or followed a bookmark) is using the kiosk, so give them the
  // kiosk version of it. Registration is the exception: its QR code is for
  // signing up from home, and a kiosk registration also checks you in.
  const anonClientScreen = !authLoading && !session && isClientFacingPath(location.pathname) && location.pathname.indexOf("/register") !== 0;
  // And the reverse: a signed-in staff member who opened the kiosk in this
  // tab and then goes to a staff screen leaves kiosk mode (it's remembered
  // for the tab, so it would otherwise hide the sidebar until the tab closes).
  const staffScreenInKiosk = !authLoading && !!session && kiosk && !isClientFacingPath(location.pathname);
  useEffect(() => {
    if (anonClientScreen && !kiosk) setKiosk(true);
    if (staffScreenInKiosk) setKiosk(false);
  }, [anonClientScreen, staffScreenInKiosk, kiosk, setKiosk]);

  // Wait for Supabase to finish restoring any existing session before
  // deciding to redirect -- otherwise a valid session in localStorage loses
  // the race against this render and gets bounced to the kiosk home.
  if (authLoading) return null;
  const isClientRegister = location.pathname === "/register" || location.pathname === "/register/success";
  // Client screens are public: a phone opening a kiosk link (or refreshing
  // one) goes straight in. Everything else needs a staff session.
  if (!session && !kiosk && !isClientFacingPath(location.pathname)) return <Navigate to="/" replace />;

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
  // ClientRegister.jsx / ClientRegisterSuccess.jsx reuse the same frame.
  const isApptRequest = location.pathname.indexOf("/appointments/request") === 0 || isClientRegister;
  // The shared calendar is an internal productivity screen whose week grid
  // needs the whole content column rather than <main>'s 1200px reading
  // measure -- see main--calendar in main.css. It keeps Shell's topbar; only
  // the width/padding changes.
  const isCalendar = location.pathname === "/calendar";
  const clientView = isClientFacingPath(location.pathname);

  const sections = sidebarSections(items, { programs: outreachPrograms, role, programRoles: data.programRoles, lang });
  const badges = {
    casemanagement: pendingApptCount(data.appointments, "case_manager"),
    // Job Developer's page lives inside the Workforce program now.
    workforce: items.indexOf("jobdeveloper") !== -1 ? pendingApptCount(data.appointments, "job_developer") : 0
  };
  const scopes = searchScopes(items, can("admin.users.view"), routeAllowed("clients", items, { can, fromPermissions: nav.source === "permissions" }));
  const searchPlaceholder = t(searchPlaceholderKey(scopes));
  const pages = sections.flatMap((s) => s.entries.map((e) => ({ key: e.key, label: e.label, to: e.to, icon: e.icon, section: s.label })));
  const isMobile = viewport === "mobile";
  // Desktop staff screens: the content column floats beside the sidebar as
  // its own panel (main.css, .content-col--floating).
  const floating = showSidebar && !isMobile && !isKioskLanding;
  const collapsed = viewport === "tablet" ? !tabletExpanded : viewport === "desktop" ? !!config.sidebarCollapsed : false;
  function toggleCollapsed() {
    if (viewport === "tablet") setTabletExpanded(collapsed);
    else updateConfig({ sidebarCollapsed: !collapsed });
  }
  function openSearch() {
    setDrawerOpen(false);
    setPaletteOpen(true);
  }
  const sidebarProps = { sections, badges, searchPlaceholder, onOpenSearch: openSearch, t };
  // Breadcrumb: the workspace the page belongs to, then the page.
  const pageKey = navKeyForPath(location.pathname);
  const crumbWorkspace = pageKey ? visibleWorkspaces(items).find((w) => w.key === (workspaceOfItem(pageKey) || "home")) : null;

  return (
    <Fragment>
      <TooltipProvider>
        <div className={cn("app-shell", floating && "app-shell--floating")}>
          {showSidebar && !isMobile && (
            // Floats 16px in from the viewport's edges and stays put while
            // the page scrolls. It sits in the normal flow, so the content
            // column narrows and widens with it -- no hard-coded offsets.
            <div className="no-print sticky top-0 z-20 h-dvh shrink-0 py-4 pl-4">
              <AppSidebar {...sidebarProps} collapsed={collapsed} onToggleCollapse={toggleCollapsed} />
            </div>
          )}
          <AnimatePresence>
            {showSidebar && isMobile && drawerOpen && (
              <SidebarDrawer key="drawer" label={t("sidebarMainNav")} onClose={() => setDrawerOpen(false)}>
                <AppSidebar {...sidebarProps} drawer collapsed={false} onClose={() => setDrawerOpen(false)} />
              </SidebarDrawer>
            )}
          </AnimatePresence>
          {paletteOpen && (
            <CommandPalette pages={pages} scopes={scopes} placeholder={searchPlaceholder} onClose={() => setPaletteOpen(false)} t={t} />
          )}

          <div className={cn("content-col", isKioskLanding && "content-col--kiosk-landing", floating && "content-col--floating")}>
            {/* Every client-facing screen gets the same kiosk top bar (Back,
                logo, clock, language); the kiosk home draws its own copy
                inside its full-screen frame. Back is left off the kiosk
                home and for a client registering on their own phone. */}
            {clientView && !isKioskLanding && (
              <KioskTopBar
                onBack={location.pathname === "/checkin" || (!kiosk && !session) ? null
                  // Staff who reached a kiosk form from Visitor Search but
                  // can't open check-in go back there instead.
                  : () => navigate(kiosk || items.indexOf("checkin") !== -1 ? "/checkin" : "/search")}
              />
            )}
            {!clientView && (
              <header className="topbar">
                {showSidebar && isMobile && (
                  <button
                    type="button"
                    onClick={() => setDrawerOpen(true)}
                    aria-label={t("sidebarOpenMenu")}
                    aria-haspopup="dialog"
                    aria-expanded={drawerOpen}
                    className="no-print flex h-10 min-h-0 w-10 shrink-0 transform-none items-center justify-center rounded-xl border border-border bg-card p-0 text-[color:var(--text)] hover:bg-background focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  >
                    <Menu aria-hidden="true" className="h-5 w-5" strokeWidth={2} />
                  </button>
                )}
                {showSidebar && crumbWorkspace && navLabel(pageKey, lang) ? (
                  <nav aria-label={t("breadcrumbLabel")} className="no-print min-w-0">
                    <ol className="m-0 flex min-w-0 list-none items-center gap-1.5 p-0 text-meta text-muted">
                      <li className="truncate">{t(crumbWorkspace.label)}</li>
                      <li aria-hidden="true"><ChevronRight className="h-3.5 w-3.5" /></li>
                      <li className="truncate font-semibold text-card-foreground" aria-current="page">{navLabel(pageKey, lang)}</li>
                    </ol>
                  </nav>
                ) : null}
                {(!showSidebar || (isMobile && !crumbWorkspace)) && (
                  <div className="brand">
                    <img src={LOGO_URL} alt={ORG.name} />
                    {/* Next to the phone menu button the subtitle would wrap the bar onto two rows. */}
                    <span className={cn("brand-sub no-print", showSidebar && "hidden")}>{t("appTitle")}</span>
                  </div>
                )}
                <div className="no-print" style={{ display: "flex", alignItems: "center", gap: 12, marginLeft: "auto" }}>
                  {session && !showSidebar && <NotificationBell />}
                  {!showSidebar && <ThemeToggle compact />}
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

          </div>
        </div>
      </TooltipProvider>
    </Fragment>
  );
}
