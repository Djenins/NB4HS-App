// App.jsx -- top-level route table. Public routes (Login, StaffLogin) plus
// a Shell layout route that owns everything reachable while signed in or in
// kiosk mode. Route paths mirror the original's `view` string vocabulary
// (see lib/nav.js) so this is a faithful reshaping of nav_shell.js's
// switch-based renderCurrentView(), not a new IA.
//
// Every screen from the original prototype now has a real React page --
// see task #105 for the final cross-check before delivery.
//
// Also owns one bit of bootstrap logic that used to live at the top of the
// original's init() (lines 3882-3903): the `?kiosk=1`/`#checkin` kiosk entry
// point. This only runs once, on mount.
import { lazy, useEffect, useRef } from "react";
import { Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { useApp } from "./context/AppContext.jsx";
import Shell from "./components/Shell.jsx";
import Login from "./pages/Login.jsx";
import StaffLogin from "./pages/StaffLogin.jsx";
import ResetPassword from "./pages/ResetPassword.jsx";
import RequireRoute from "./components/RequireRoute.jsx";
import CheckIn from "./pages/CheckIn.jsx";
import CheckInStudent from "./pages/CheckInStudent.jsx";
import CheckInVisitor from "./pages/CheckInVisitor.jsx";
import CheckInSuccess from "./pages/CheckInSuccess.jsx";
import CheckOut from "./pages/CheckOut.jsx";
import CheckOutScanSuccess from "./pages/CheckOutScanSuccess.jsx";
import ApptRequest from "./pages/ApptRequest.jsx";
import ApptRequestSuccess from "./pages/ApptRequestSuccess.jsx";
import AppointmentLookup from "./pages/AppointmentLookup.jsx";

// Code-split by route. The public kiosk/appointment pages above load eagerly
// -- they're the first thing a client's device sees and should never wait on
// a second request. Every staff page below is its own chunk, fetched the
// first time it's opened (Shell wraps <Outlet/> in the Suspense boundary), so
// the kiosk no longer downloads the dashboard, charts, reports and PDF export
// just to show "Check in".
const Dashboard = lazy(() => import("./pages/Dashboard.jsx"));
const MyCaseload = lazy(() => import("./pages/MyCaseload.jsx"));
const Search = lazy(() => import("./pages/Search.jsx"));
const Reports = lazy(() => import("./pages/Reports.jsx"));
const QRCode = lazy(() => import("./pages/QRCode.jsx"));
const Manage = lazy(() => import("./pages/Manage.jsx"));
const Students = lazy(() => import("./pages/Students.jsx"));
const Assessments = lazy(() => import("./pages/Assessments.jsx"));
const FoodDistribution = lazy(() => import("./pages/FoodDistribution.jsx"));
const CalendarPage = lazy(() => import("./pages/Calendar.jsx"));
const CaseManagement = lazy(() => import("./pages/CaseManagement.jsx"));
const JobDeveloper = lazy(() => import("./pages/JobDeveloper.jsx"));
const Workforce = lazy(() => import("./pages/Workforce.jsx"));
const ClientProfile = lazy(() => import("./pages/ClientProfile.jsx"));
const JobClientProfile = lazy(() => import("./pages/JobClientProfile.jsx"));
const WorkforceDashboard = lazy(() => import("./pages/WorkforceDashboard.jsx"));
const Employers = lazy(() => import("./pages/Employers.jsx"));
const EmployerProfile = lazy(() => import("./pages/EmployerProfile.jsx"));
const JobOpenings = lazy(() => import("./pages/JobOpenings.jsx"));
const CandidateMatching = lazy(() => import("./pages/CandidateMatching.jsx"));
const Referrals = lazy(() => import("./pages/Referrals.jsx"));
const Placements = lazy(() => import("./pages/Placements.jsx"));
const PlacementDetail = lazy(() => import("./pages/PlacementDetail.jsx"));
const WorkforceReports = lazy(() => import("./pages/WorkforceReports.jsx"));
const Outreach = lazy(() => import("./pages/Outreach.jsx"));
const MyReports = lazy(() => import("./pages/MyReports.jsx"));
const StaffReports = lazy(() => import("./pages/StaffReports.jsx"));
const Admin = lazy(() => import("./pages/Admin.jsx"));
const Settings = lazy(() => import("./pages/Settings.jsx"));

function BootstrapEntry() {
  const { setKiosk } = useApp();
  const navigate = useNavigate();
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    const params = new URLSearchParams(window.location.search);
    if (params.get("kiosk") === "1" || window.location.hash === "#checkin") {
      setKiosk(true);
      navigate("/checkin", { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}

export default function App() {
  return (
    <>
      <BootstrapEntry />
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/staff-login" element={<StaffLogin />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        <Route element={<Shell />}>
          <Route path="/dashboard" element={<RequireRoute routeKey="dashboard"><Dashboard /></RequireRoute>} />
          <Route path="/mycaseload" element={<RequireRoute routeKey="mycaseload"><MyCaseload /></RequireRoute>} />
          <Route path="/checkin" element={<RequireRoute routeKey="checkin" kiosk><CheckIn /></RequireRoute>} />
          <Route path="/checkin/student" element={<RequireRoute routeKey="checkin" kiosk><CheckInStudent /></RequireRoute>} />
          <Route path="/checkin/visitor" element={<RequireRoute routeKey={["checkin", "search"]} kiosk><CheckInVisitor /></RequireRoute>} />
          <Route path="/checkin/success" element={<RequireRoute routeKey={["checkin", "search"]} kiosk><CheckInSuccess /></RequireRoute>} />
          <Route path="/checkout" element={<RequireRoute routeKey="checkout" kiosk><CheckOut /></RequireRoute>} />
          <Route path="/checkout/scan-success" element={<RequireRoute routeKey="checkout" kiosk><CheckOutScanSuccess /></RequireRoute>} />
          <Route path="/appointments/request" element={<ApptRequest />} />
          <Route path="/appointments/request/success" element={<ApptRequestSuccess />} />
          <Route path="/appointments/lookup" element={<AppointmentLookup />} />
          <Route path="/search" element={<RequireRoute routeKey="search"><Search /></RequireRoute>} />
          <Route path="/reports" element={<RequireRoute routeKey="reports"><Reports /></RequireRoute>} />
          <Route path="/fooddistribution" element={<RequireRoute routeKey="fooddistribution"><FoodDistribution /></RequireRoute>} />
          <Route path="/calendar" element={<RequireRoute routeKey="calendar"><CalendarPage /></RequireRoute>} />
          <Route path="/qrcode" element={<RequireRoute routeKey="qrcode"><QRCode /></RequireRoute>} />
          <Route path="/manage" element={<RequireRoute routeKey="manage"><Manage /></RequireRoute>} />
          <Route path="/students" element={<RequireRoute routeKey="students"><Students /></RequireRoute>} />
          <Route path="/assessments" element={<RequireRoute routeKey="assessments"><Assessments /></RequireRoute>} />
          <Route path="/casemanagement" element={<RequireRoute routeKey="casemanagement"><CaseManagement /></RequireRoute>} />
          <Route path="/myreports" element={<RequireRoute routeKey="myreports"><MyReports /></RequireRoute>} />
          <Route path="/myreports/:reportId" element={<RequireRoute routeKey="myreports"><MyReports /></RequireRoute>} />
          <Route path="/staffreports" element={<RequireRoute routeKey="staffreports"><StaffReports /></RequireRoute>} />
          <Route path="/staffreports/:reportId" element={<RequireRoute routeKey="staffreports"><StaffReports /></RequireRoute>} />
          <Route path="/outreach/:program?/:section?" element={<RequireRoute routeKey="outreach"><Outreach /></RequireRoute>} />
          {/* SNAP Outreach became a program inside Outreach (O1); keep old links working. */}
          <Route path="/snap/*" element={<Navigate to="/outreach/snap" replace />} />
          <Route path="/workforce" element={<RequireRoute routeKey="workforce"><Workforce /></RequireRoute>} />
          <Route path="/jobdeveloper" element={<RequireRoute routeKey="jobdeveloper"><JobDeveloper /></RequireRoute>} />
          <Route path="/jobdeveloper/:clientId" element={<RequireRoute routeKey="jobdeveloper"><JobClientProfile /></RequireRoute>} />
          <Route path="/workforcedashboard" element={<RequireRoute routeKey="workforcedashboard"><WorkforceDashboard /></RequireRoute>} />
          <Route path="/employers" element={<RequireRoute routeKey="employers"><Employers /></RequireRoute>} />
          <Route path="/employers/:employerId" element={<RequireRoute routeKey="employers"><EmployerProfile /></RequireRoute>} />
          <Route path="/jobopenings" element={<RequireRoute routeKey="jobopenings"><JobOpenings /></RequireRoute>} />
          <Route path="/candidatematching" element={<RequireRoute routeKey="candidatematching"><CandidateMatching /></RequireRoute>} />
          <Route path="/referrals" element={<RequireRoute routeKey="referrals"><Referrals /></RequireRoute>} />
          <Route path="/placements" element={<RequireRoute routeKey="placements"><Placements /></RequireRoute>} />
          <Route path="/placements/:placementId" element={<RequireRoute routeKey="placements"><PlacementDetail /></RequireRoute>} />
          <Route path="/workforcereports" element={<RequireRoute routeKey="workforcereports"><WorkforceReports /></RequireRoute>} />
          <Route path="/clients/:nbId" element={<RequireRoute routeKey="clients"><ClientProfile /></RequireRoute>} />
          {/* Administration is gated by the new permissions inside Admin.jsx. */}
          <Route path="/admin/:section?/:id?" element={<Admin />} />
          <Route path="/users" element={<Navigate to="/admin/users" replace />} />
          <Route path="/settings" element={<RequireRoute routeKey="settings"><Settings /></RequireRoute>} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
