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
import { useEffect, useRef } from "react";
import { Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { useApp } from "./context/AppContext.jsx";
import Shell from "./components/Shell.jsx";
import Login from "./pages/Login.jsx";
import StaffLogin from "./pages/StaffLogin.jsx";
import ResetPassword from "./pages/ResetPassword.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import MyCaseload from "./pages/MyCaseload.jsx";
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
import Search from "./pages/Search.jsx";
import Reports from "./pages/Reports.jsx";
import QRCode from "./pages/QRCode.jsx";
import Manage from "./pages/Manage.jsx";
import Students from "./pages/Students.jsx";
import Assessments from "./pages/Assessments.jsx";
import FoodDistribution from "./pages/FoodDistribution.jsx";
import CalendarPage from "./pages/Calendar.jsx";
import CaseManagement from "./pages/CaseManagement.jsx";
import JobDeveloper from "./pages/JobDeveloper.jsx";
import Workforce from "./pages/Workforce.jsx";
import ClientProfile from "./pages/ClientProfile.jsx";
import JobClientProfile from "./pages/JobClientProfile.jsx";
import WorkforceDashboard from "./pages/WorkforceDashboard.jsx";
import Employers from "./pages/Employers.jsx";
import EmployerProfile from "./pages/EmployerProfile.jsx";
import JobOpenings from "./pages/JobOpenings.jsx";
import CandidateMatching from "./pages/CandidateMatching.jsx";
import Referrals from "./pages/Referrals.jsx";
import Placements from "./pages/Placements.jsx";
import PlacementDetail from "./pages/PlacementDetail.jsx";
import WorkforceReports from "./pages/WorkforceReports.jsx";
import Users from "./pages/Users.jsx";
import Settings from "./pages/Settings.jsx";

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
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/mycaseload" element={<MyCaseload />} />
          <Route path="/checkin" element={<CheckIn />} />
          <Route path="/checkin/student" element={<CheckInStudent />} />
          <Route path="/checkin/visitor" element={<CheckInVisitor />} />
          <Route path="/checkin/success" element={<CheckInSuccess />} />
          <Route path="/checkout" element={<CheckOut />} />
          <Route path="/checkout/scan-success" element={<CheckOutScanSuccess />} />
          <Route path="/appointments/request" element={<ApptRequest />} />
          <Route path="/appointments/request/success" element={<ApptRequestSuccess />} />
          <Route path="/appointments/lookup" element={<AppointmentLookup />} />
          <Route path="/search" element={<Search />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/fooddistribution" element={<FoodDistribution />} />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/qrcode" element={<QRCode />} />
          <Route path="/manage" element={<RequireRoute routeKey="manage"><Manage /></RequireRoute>} />
          <Route path="/students" element={<Students />} />
          <Route path="/assessments" element={<Assessments />} />
          <Route path="/casemanagement" element={<CaseManagement />} />
          <Route path="/workforce" element={<Workforce />} />
          <Route path="/jobdeveloper" element={<JobDeveloper />} />
          <Route path="/jobdeveloper/:clientId" element={<JobClientProfile />} />
          <Route path="/workforcedashboard" element={<RequireRoute routeKey="workforcedashboard"><WorkforceDashboard /></RequireRoute>} />
          <Route path="/employers" element={<RequireRoute routeKey="employers"><Employers /></RequireRoute>} />
          <Route path="/employers/:employerId" element={<RequireRoute routeKey="employers"><EmployerProfile /></RequireRoute>} />
          <Route path="/jobopenings" element={<RequireRoute routeKey="jobopenings"><JobOpenings /></RequireRoute>} />
          <Route path="/candidatematching" element={<RequireRoute routeKey="candidatematching"><CandidateMatching /></RequireRoute>} />
          <Route path="/referrals" element={<RequireRoute routeKey="referrals"><Referrals /></RequireRoute>} />
          <Route path="/placements" element={<RequireRoute routeKey="placements"><Placements /></RequireRoute>} />
          <Route path="/placements/:placementId" element={<RequireRoute routeKey="placements"><PlacementDetail /></RequireRoute>} />
          <Route path="/workforcereports" element={<RequireRoute routeKey="workforcereports"><WorkforceReports /></RequireRoute>} />
          <Route path="/clients/:nbId" element={<ClientProfile />} />
          <Route path="/users" element={<RequireRoute routeKey="users"><Users /></RequireRoute>} />
          <Route path="/settings" element={<RequireRoute routeKey="settings"><Settings /></RequireRoute>} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
