// SnapOutreach.jsx -- the SNAP Outreach module: one sidebar entry
// (Shell.jsx, "snap" in nav.js) opening a page that owns its own section
// strip, same shape as Workforce.jsx. Which sections show comes from
// snapSectionsFor() (lib/programStaff.js): program members get the module's
// working sections, whoever can grant SNAP roles gets Staff & Access, and a
// system administrator without a SNAP role gets only the latter.
//
// Sections are added here as each stage ships (plans/
// snap-outreach-architecture.md §10) -- nothing is listed before it works.
import { useState } from "react";
import { Navigate } from "react-router-dom";
import { Contact, FolderOpen, LayoutGrid, ListChecks, ShieldCheck } from "lucide-react";
import { useApp, useT } from "../context/AppContext.jsx";
import { snapSectionsFor } from "../lib/programStaff.js";
import ModuleNav from "../components/ModuleNav.jsx";
import SnapCases from "../components/snap/SnapCases.jsx";
import SnapContacts from "../components/snap/SnapContacts.jsx";
import SnapDashboard from "../components/snap/SnapDashboard.jsx";
import SnapStaffSettings from "../components/snap/SnapStaffSettings.jsx";
import SnapTasks from "../components/snap/SnapTasks.jsx";

const SECTIONS = {
  dashboard: { label: "snapSectionDashboard", icon: LayoutGrid, Component: SnapDashboard },
  contacts: { label: "snapSectionContacts", icon: Contact, Component: SnapContacts },
  cases: { label: "snapSectionCases", icon: FolderOpen, Component: SnapCases },
  tasks: { label: "snapSectionTasks", icon: ListChecks, Component: SnapTasks },
  staff: { label: "snapSectionStaff", icon: ShieldCheck, Component: SnapStaffSettings }
};

export default function SnapOutreach() {
  const { session, data } = useApp();
  const t = useT();
  const role = session ? session.role : null;
  const programRole = (data.programRoles || {}).snap || null;
  const visible = snapSectionsFor(role, programRole);
  // { section, intent, n }: the dashboard's quick actions jump to a section
  // and ask it to open its "new" form; `n` remounts the section so a repeated
  // quick action re-opens the form.
  const [nav, setNav] = useState({ section: null, intent: null, n: 0 });

  if (visible.length === 0) return <Navigate to="/dashboard" replace />;

  const section = nav.section && visible.indexOf(nav.section) !== -1 ? nav.section : visible[0];
  const go = (key, intent) => setNav((prev) => ({ section: key, intent: intent || null, n: prev.n + 1 }));
  const ActiveComponent = SECTIONS[section].Component;

  return (
    <>
      <ModuleNav
        label={t("navSnapOutreach")}
        items={visible.map((key) => ({ key, label: t(SECTIONS[key].label), icon: SECTIONS[key].icon }))}
        value={section}
        onChange={(key) => go(key)}
      />
      <ActiveComponent key={section + nav.n} intent={nav.intent} onNavigate={go} />
    </>
  );
}
