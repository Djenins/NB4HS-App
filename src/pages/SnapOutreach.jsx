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
import { LayoutGrid, ShieldCheck } from "lucide-react";
import { useApp, useT } from "../context/AppContext.jsx";
import { snapSectionsFor } from "../lib/programStaff.js";
import ModuleNav from "../components/ModuleNav.jsx";
import SnapOverview from "../components/snap/SnapOverview.jsx";
import SnapStaffSettings from "../components/snap/SnapStaffSettings.jsx";

const SECTIONS = {
  overview: { label: "snapSectionOverview", icon: LayoutGrid, Component: SnapOverview },
  staff: { label: "snapSectionStaff", icon: ShieldCheck, Component: SnapStaffSettings }
};

export default function SnapOutreach() {
  const { session, data } = useApp();
  const t = useT();
  const role = session ? session.role : null;
  const programRole = (data.programRoles || {}).snap || null;
  const visible = snapSectionsFor(role, programRole);
  const [sectionOverride, setSectionOverride] = useState(null);

  if (visible.length === 0) return <Navigate to="/dashboard" replace />;

  const section = sectionOverride && visible.indexOf(sectionOverride) !== -1 ? sectionOverride : visible[0];
  const ActiveComponent = SECTIONS[section].Component;

  return (
    <>
      <ModuleNav
        label={t("navSnapOutreach")}
        items={visible.map((key) => ({ key, label: t(SECTIONS[key].label), icon: SECTIONS[key].icon }))}
        value={section}
        onChange={setSectionOverride}
      />
      <ActiveComponent />
    </>
  );
}
