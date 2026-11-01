// Outreach.jsx -- the Outreach Management module: one sidebar entry
// (Shell.jsx, "outreach" in nav.js) opening /<program>/:section (/snap/cases).
// Each outreach program (SNAP first) is a row in `programs`; this page picks
// the program from the URL, provides it to every section through
// OutreachProgramContext, and owns the section strip, same shape as
// Workforce.jsx. Which sections show comes from outreachSectionsFor()
// (lib/outreachPrograms.js): program members get the working sections the
// program has switched on, whoever can grant its roles gets Staff & Access,
// and a system administrator without a program role gets only the latter.
//
// Sections are added as each phase ships (plans/
// outreach-management-architecture.md §6) -- nothing is listed before it works.
//
// While the programs (or the program's options) load, a skeleton keeps the
// module's shape; a failed load says so and offers a retry. Each section
// renders its own PageHeader under the ModuleNav.
import { useEffect, useState } from "react";
import { Navigate, useLocation, useNavigate, useParams } from "react-router-dom";
import { Contact, FolderOpen, LayoutGrid, ListChecks, ShieldCheck } from "lucide-react";
import { useApp, useT } from "../context/AppContext.jsx";
import { OutreachProgramContext } from "../context/OutreachProgramContext.jsx";
import {
  fetchOutreachPrograms, fetchProgramOptions, outreachSectionsFor, programName, programsVisibleTo
} from "../lib/outreachPrograms.js";
import { useNavItems } from "../lib/useNavItems.js";
import { landingItem } from "../lib/workspaces.js";
import { navPath } from "../lib/nav.js";
import ModuleNav from "../components/ModuleNav.jsx";
import SnapCases from "../components/snap/SnapCases.jsx";
import SnapContacts from "../components/snap/SnapContacts.jsx";
import SnapDashboard from "../components/snap/SnapDashboard.jsx";
import SnapStaffSettings from "../components/snap/SnapStaffSettings.jsx";
import SnapTasks from "../components/snap/SnapTasks.jsx";
import { Button } from "../components/ui/button.jsx";
import { Card } from "../components/ui/card.jsx";
import { EmptyState } from "../components/ui/empty-state.jsx";
import { Select } from "../components/ui/field.jsx";
import { Skeleton } from "../components/ui/skeleton.jsx";

const SECTIONS = {
  dashboard: { label: "snapSectionDashboard", icon: LayoutGrid, Component: SnapDashboard },
  contacts: { label: "snapSectionContacts", icon: Contact, Component: SnapContacts },
  cases: { label: "snapSectionCases", icon: FolderOpen, Component: SnapCases },
  tasks: { label: "snapSectionTasks", icon: ListChecks, Component: SnapTasks },
  staff: { label: "snapSectionStaff", icon: ShieldCheck, Component: SnapStaffSettings }
};

// The module's shape while it loads: the section strip, a header, a list.
function OutreachSkeleton({ withNav }) {
  return (
    <div aria-busy="true" className="grid gap-6">
      {withNav && <Skeleton className="h-24 w-full rounded-surface" />}
      <div className="grid gap-2">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-5 w-80 max-w-full" />
      </div>
      <Card className="grid gap-2 p-5 sm:p-6">
        {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
      </Card>
    </div>
  );
}

// `program` comes from the route (/snap/:section -> "snap"); each Outreach
// program is its own workspace. The /outreach/:program URLs redirect here.
export default function Outreach({ program: routeProgram }) {
  const { session, data, lang } = useApp();
  const t = useT();
  const params = useParams();
  const { items: navItems } = useNavItems();
  const location = useLocation();
  const navigate = useNavigate();
  const role = session ? session.role : null;
  const [programs, setPrograms] = useState(null);
  const [loadError, setLoadError] = useState(false);
  const [options, setOptions] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoadError(false);
    fetchOutreachPrograms()
      .then((rows) => { if (!cancelled) setPrograms(rows); })
      .catch((err) => { console.warn("fetchOutreachPrograms failed", err); if (!cancelled) setLoadError(true); });
    return () => { cancelled = true; };
  }, [reloadKey]);

  const visiblePrograms = programsVisibleTo(programs || [], role, data.programRoles);
  // Someone with no program here goes to their own landing page.
  const landing = landingItem(navItems, session && session.primaryWorkspace);
  const home = landing && landing !== "outreach" ? navPath(landing) : "/";
  const info = visiblePrograms.find((p) => p.key === (routeProgram || params.program)) || null;
  const program = info ? info.key : null;

  useEffect(() => {
    if (!program) return undefined;
    let cancelled = false;
    setOptions(null);
    fetchProgramOptions(program)
      .then((rows) => { if (!cancelled) setOptions(rows); })
      .catch((err) => { console.warn("fetchProgramOptions failed", err); if (!cancelled) setOptions([]); });
    return () => { cancelled = true; };
  }, [program]);

  if (loadError) {
    return (
      <Card>
        <EmptyState
          variant="error"
          title={t("outreachLoadError")}
          description={t("outreachLoadErrorHint")}
          action={<Button variant="secondary" onClick={() => setReloadKey((k) => k + 1)}>{t("retryLabel")}</Button>}
        />
      </Card>
    );
  }
  if (programs === null) return <OutreachSkeleton withNav />;
  if (!visiblePrograms.length) return <Navigate to={home} replace />;
  if (!info) return <Navigate to={"/" + visiblePrograms[0].key} replace />;

  const programRole = (data.programRoles || {})[program] || null;
  const visible = outreachSectionsFor(role, programRole, info.features);
  if (!visible.length) return <Navigate to={home} replace />;
  const section = visible.indexOf(params.section) !== -1 ? params.section : visible[0];

  // The dashboard's quick actions jump to a section and ask it to open its
  // "new" form; the intent rides in history state, and each navigation's
  // location key remounts the section so a repeated quick action re-opens it.
  const intent = (location.state && location.state.intent) || null;
  const go = (key, nextIntent) => navigate("/" + program + "/" + key, { state: { intent: nextIntent || null } });
  const ActiveComponent = SECTIONS[section].Component;
  const name = programName(info, lang);

  return (
    <OutreachProgramContext.Provider value={{ program, programRole, info, options: options || [] }}>
      <ModuleNav
        label={t("navOutreach") + " · " + name}
        items={visible.map((key) => ({ key, label: t(SECTIONS[key].label), icon: SECTIONS[key].icon }))}
        value={section}
        onChange={(key) => go(key)}
      />
      {visiblePrograms.length > 1 && (
        <div className="mb-4 flex items-center justify-end gap-2">
          <label htmlFor="outreach-program" className="text-meta font-semibold text-muted">{t("outreachProgramLabel")}</label>
          <Select id="outreach-program" className="w-auto min-w-[10rem]" value={program}
            onChange={(e) => navigate("/" + e.target.value)}>
            {visiblePrograms.map((p) => <option key={p.key} value={p.key}>{programName(p, lang)}</option>)}
          </Select>
        </div>
      )}
      {options === null
        ? <OutreachSkeleton />
        : <ActiveComponent key={program + section + location.key} intent={intent} onNavigate={go} />}
    </OutreachProgramContext.Provider>
  );
}
