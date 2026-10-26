// StaffReports.jsx -- the reviewer side of biweekly staff reporting
// (sidebar "Staff Reports"; plans/staff-reporting-architecture.md §4). One
// sidebar entry, a ModuleNav strip like SnapOutreach.jsx: reviewers
// (program_staff 'staff_reports' / 'reviewer') get Overview and All reports;
// whoever can configure reporting (system administrators, reporting program
// admins) gets Settings. A system administrator who is not a reviewer sees
// only Settings -- configuring reporting does not mean reading reports.
// /staffreports/:id opens one report for review.
import { useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { LayoutGrid, ListChecks, Settings2 } from "lucide-react";
import { useApp, useT } from "../context/AppContext.jsx";
import ModuleNav from "../components/ModuleNav.jsx";
import ReportReview from "../components/reports/ReportReview.jsx";
import ReportingSettings from "../components/reports/ReportingSettings.jsx";
import { StaffReportsAll, StaffReportsOverview } from "../components/reports/StaffReportsTables.jsx";

const SECTIONS = {
  overview: { label: "srSectionOverview", icon: LayoutGrid, Component: StaffReportsOverview },
  all: { label: "srSectionAll", icon: ListChecks, Component: StaffReportsAll },
  settings: { label: "srSectionSettings", icon: Settings2, Component: ReportingSettings }
};

// Which sections a person sees, from their system role and their
// staff_reports program role. Empty means no access.
export function staffReportSectionsFor(systemRole, programRole) {
  var out = [];
  if (programRole === "reviewer") out.push("overview", "all");
  if (systemRole === "administrator" || programRole === "program_admin") out.push("settings");
  return out;
}

export default function StaffReports() {
  const { reportId } = useParams();
  const navigate = useNavigate();
  const { session, data } = useApp();
  const t = useT();
  const visible = staffReportSectionsFor(session ? session.role : null, (data.programRoles || {}).staff_reports || null);
  const [chosen, setChosen] = useState(null);

  if (visible.length === 0) return <Navigate to="/dashboard" replace />;
  const isReviewer = visible.indexOf("overview") !== -1;
  if (reportId && !isReviewer) return <Navigate to="/staffreports" replace />;

  const section = reportId ? "overview" : chosen && visible.indexOf(chosen) !== -1 ? chosen : visible[0];
  const ActiveComponent = SECTIONS[section].Component;

  return (
    <>
      <ModuleNav
        label={t("navStaffReports")}
        items={visible.map((key) => ({ key, label: t(SECTIONS[key].label), icon: SECTIONS[key].icon }))}
        value={section}
        onChange={(key) => { setChosen(key); if (reportId) navigate("/staffreports"); }}
      />
      {reportId ? <ReportReview reportId={reportId} /> : <ActiveComponent />}
    </>
  );
}
