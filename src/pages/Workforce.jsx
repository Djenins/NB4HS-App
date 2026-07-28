// Workforce.jsx -- single flat "Workforce" sidebar entry (Shell.jsx) at the
// same level as Case Management, Assessments, etc, replacing the old
// collapsible submenu. Owns a tab strip (same idiom as ClientProfile.jsx/
// EmployerProfile.jsx) switching between the existing, otherwise-unchanged
// Employer & Job Opportunity Management pages -- this file doesn't
// duplicate their logic, it only decides which one is currently mounted.
import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useApp, useT } from "../context/AppContext.jsx";
import { enabledWorkforceRoles, navItemsForRole } from "../lib/nav.js";
import JobDeveloper from "./JobDeveloper.jsx";
import WorkforceDashboard from "./WorkforceDashboard.jsx";
import Employers from "./Employers.jsx";
import JobOpenings from "./JobOpenings.jsx";
import CandidateMatching from "./CandidateMatching.jsx";
import Referrals from "./Referrals.jsx";
import Placements from "./Placements.jsx";
import WorkforceReports from "./WorkforceReports.jsx";

const TABS = [
  { key: "jobdeveloper", label: "navJobDeveloper", Component: JobDeveloper },
  { key: "workforcedashboard", label: "navWorkforceDashboard", Component: WorkforceDashboard },
  { key: "employers", label: "navEmployers", Component: Employers },
  { key: "jobopenings", label: "navJobOpenings", Component: JobOpenings },
  { key: "candidatematching", label: "navCandidateMatching", Component: CandidateMatching },
  { key: "referrals", label: "navReferrals", Component: Referrals },
  { key: "placements", label: "navPlacements", Component: Placements },
  { key: "workforcereports", label: "navWorkforceReports", Component: WorkforceReports }
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
      <div className="mb-5 flex flex-wrap gap-1 overflow-x-auto border-b border-border">
        {visibleTabs.map((vt) => (
          <button
            key={vt.key}
            type="button"
            onClick={() => setTabOverride(vt.key)}
            className={
              "shrink-0 rounded-t-lg px-3 py-2 text-sm font-semibold transition-colors " +
              (tab === vt.key ? "border-b-2 border-primary text-primary" : "text-muted hover:text-card-foreground")
            }
          >
            {t(vt.label)}
          </button>
        ))}
      </div>
      <ActiveComponent />
    </>
  );
}
