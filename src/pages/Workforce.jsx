// Workforce.jsx -- single flat "Workforce" sidebar entry (Shell.jsx) at the
// same level as Case Management, Assessments, etc, replacing the old
// collapsible submenu. Owns the module's secondary navigation, switching
// between the existing, otherwise-unchanged Employer & Job Opportunity
// Management pages -- this file doesn't duplicate their logic, it only
// decides which one is currently mounted.
//
// That strip now renders through components/ModuleNav.jsx (the standard
// icon + label + active-underline treatment for secondary module menus)
// instead of the old text-only tab row. Nothing about the sidebar/header
// shell changes, and the record-detail tabs inside ClientProfile.jsx /
// EmployerProfile.jsx / JobClientProfile.jsx keep their own tab idiom --
// those are local page controls, not module navigation.
import { useState } from "react";
import { Navigate } from "react-router-dom";
import { BarChart3, Briefcase, Building2, ContactRound, LayoutGrid, Send, UserSearch, Users } from "lucide-react";
import { useApp, useT } from "../context/AppContext.jsx";
import { enabledWorkforceRoles, navItemsForRole } from "../lib/nav.js";
import ModuleNav from "../components/ModuleNav.jsx";
import JobDeveloper from "./JobDeveloper.jsx";
import WorkforceDashboard from "./WorkforceDashboard.jsx";
import Employers from "./Employers.jsx";
import JobOpenings from "./JobOpenings.jsx";
import CandidateMatching from "./CandidateMatching.jsx";
import Referrals from "./Referrals.jsx";
import Placements from "./Placements.jsx";
import WorkforceReports from "./WorkforceReports.jsx";

// Icons are chosen per *section*, not reused from lib/navIcons.js: that map
// is scoped to the sidebar, where several of these keys deliberately share
// a glyph (jobdeveloper/workforce both Briefcase, two LayoutDashboards, two
// BarChart3s). Inside one module the icons have to be distinguishable from
// each other, so each section gets its own.
const TABS = [
  { key: "jobdeveloper", label: "navJobDeveloper", icon: Users, Component: JobDeveloper },
  { key: "workforcedashboard", label: "navWorkforceDashboard", icon: LayoutGrid, Component: WorkforceDashboard },
  { key: "employers", label: "navEmployers", icon: Building2, Component: Employers },
  { key: "jobopenings", label: "navJobOpenings", icon: Briefcase, Component: JobOpenings },
  { key: "candidatematching", label: "navCandidateMatching", icon: UserSearch, Component: CandidateMatching },
  { key: "referrals", label: "navReferrals", icon: Send, Component: Referrals },
  { key: "placements", label: "navPlacements", icon: ContactRound, Component: Placements },
  { key: "workforcereports", label: "navWorkforceReports", icon: BarChart3, Component: WorkforceReports }
];

export default function Workforce() {
  const { session, data } = useApp();
  const t = useT();
  const role = session ? session.role : null;
  const items = role ? navItemsForRole(role, enabledWorkforceRoles(data.workforceRoleAccess)) : [];
  const visibleTabs = TABS.filter((tab) => items.indexOf(tab.key) !== -1);
  const [tabOverride, setTabOverride] = useState(null);

  if (visibleTabs.length === 0) return <Navigate to="/dashboard" replace />;

  const tab = tabOverride && visibleTabs.some((vt) => vt.key === tabOverride) ? tabOverride : visibleTabs[0].key;
  const ActiveComponent = visibleTabs.find((vt) => vt.key === tab).Component;

  return (
    <>
      <ModuleNav
        label={t("navSectionWorkforceDevelopment")}
        items={visibleTabs.map((vt) => ({ key: vt.key, label: t(vt.label), icon: vt.icon }))}
        value={tab}
        onChange={setTabOverride}
      />
      <ActiveComponent />
    </>
  );
}
