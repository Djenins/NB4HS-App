// StaffReports.jsx -- the reviewer side of biweekly staff reporting
// (sidebar "Staff Reports"; plans/staff-reporting-architecture.md §4). One
// sidebar entry, a ModuleNav strip like SnapOutreach.jsx: whoever holds
// staff_reports.review or .view_all gets Overview and All reports; whoever
// holds staff_reports.schedule.manage gets Settings. An administrator who
// doesn't review sees only Settings -- configuring reporting does not mean
// reading reports. With a single section there is nothing to switch
// between, so a page header stands in for the strip.
// /staffreports/:id opens one report for review.
import { useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { LayoutGrid, ListChecks, Settings2 } from "lucide-react";
import { useApp, useT } from "../context/AppContext.jsx";
import ModuleNav from "../components/ModuleNav.jsx";
import { PageHeader } from "../components/ui/page-header.jsx";
import ReportReview from "../components/reports/ReportReview.jsx";
import ReportingSettings from "../components/reports/ReportingSettings.jsx";
import { StaffReportsAll, StaffReportsOverview } from "../components/reports/StaffReportsTables.jsx";

const SECTIONS = {
  overview: { label: "srSectionOverview", icon: LayoutGrid, Component: StaffReportsOverview },
  all: { label: "srSectionAll", icon: ListChecks, Component: StaffReportsAll },
  settings: { label: "srSectionSettings", icon: Settings2, Component: ReportingSettings }
};

// Which sections a person sees, from their permissions. Empty means no access.
export function staffReportSectionsFor(can) {
  var out = [];
  if (can("staff_reports.review") || can("staff_reports.view_all")) out.push("overview", "all");
  if (can("staff_reports.schedule.manage")) out.push("settings");
  return out;
}

export default function StaffReports() {
  const { reportId } = useParams();
  const navigate = useNavigate();
  const { can, permissionsLoaded } = useApp();
  const t = useT();
  const visible = staffReportSectionsFor(can);
  const [chosen, setChosen] = useState(null);

  if (!permissionsLoaded) return null;
  if (visible.length === 0) return <Navigate to="/dashboard" replace />;
  const isReviewer = visible.indexOf("overview") !== -1;
  if (reportId && !isReviewer) return <Navigate to="/staffreports" replace />;

  const section = reportId ? "overview" : chosen && visible.indexOf(chosen) !== -1 ? chosen : visible[0];
  const ActiveComponent = SECTIONS[section].Component;

  return (
    <>
      {visible.length > 1 ? (
        <ModuleNav
          label={t("navStaffReports")}
          items={visible.map((key) => ({ key, label: t(SECTIONS[key].label), icon: SECTIONS[key].icon }))}
          value={section}
          onChange={(key) => { setChosen(key); if (reportId) navigate("/staffreports"); }}
        />
      ) : (
        <PageHeader title={t("navStaffReports")} description={t("srSettingsOnlyIntro")} />
      )}
      {reportId ? <ReportReview reportId={reportId} /> : <ActiveComponent />}
    </>
  );
}
