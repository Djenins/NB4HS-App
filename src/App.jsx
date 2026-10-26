// App.jsx -- top-level route table. "/" is staff-only (sign-in, or the
// dashboard once signed in); clients use the kiosk at /kiosk. Public routes plus
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
import ClientRegister from "./pages/ClientRegister.jsx";
import ClientRegisterSuccess from "./pages/ClientRegisterSuccess.jsx";

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
const Users = lazy(() => import("./pages/Users.jsx"));
const Settings = lazy(() => import("./pages/Settings.jsx"));
const Availability = lazy(() => import("./pages/Availability.jsx"));

// "/" is for staff only: the sign-in page, or straight into the app once
// signed in. Clients never land here -- they get the kiosk link (/kiosk).
function StaffHome() {
  const { session, authLoading } = useApp();
  if (authLoading) return null;
  if (session) return <Navigate to="/dashboard" replace />;
  return <StaffLogin />;
}

// The kiosk's own link (what the QR code page hands out, e.g.
// https://checkin.nb4hs.org/kiosk): switches this device into kiosk mode and
// opens the client check-in screen. Kept separate from "/" so clients never
// see the staff home page.
function KioskEntry() {
  const { setKiosk } = useApp();
  const navigate = useNavigate();
  useEffect(() => {
    setKiosk(true);
    navigate("/checkin", { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

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
        <Route path="/" element={<StaffHome />} />
        <Route path="/staff-login" element={<StaffHome />} />
        <Route path="/kiosk" element={<KioskEntry />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        <Route element={<Shell />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/mycaseload" element={<MyCaseload />} />
          <Route path="/availability" element={<RequireRoute routeKey="availability"><Availability /></RequireRoute>} />
          <Route path="/checkin" element={<CheckIn />} />
          <Route path="/checkin/student" element={<CheckInStudent />} />
          <Route path="/checkin/visitor" element={<CheckInVisitor />} />
          <Route path="/checkin/success" element={<CheckInSuccess />} />
          <Route path="/checkout" element={<CheckOut />} />
          <Route path="/checkout/scan-success" element={<CheckOutScanSuccess />} />
          <Route path="/appointments/request" element={<ApptRequest />} />
          <Route path="/appointments/request/success" element={<ApptRequestSuccess />} />
          <Route path="/appointments/lookup" element={<AppointmentLookup />} />
          <Route path="/register" element={<ClientRegister />} />
          <Route path="/register/success" element={<ClientRegisterSuccess />} />
          <Route path="/search" element={<Search />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/fooddistribution/:section?" element={<FoodDistribution />} />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/qrcode" element={<QRCode />} />
          <Route path="/manage" element={<RequireRoute routeKey="manage"><Manage /></RequireRoute>} />
          <Route path="/students/:section?" element={<Students />} />
          {/* Assessments is a tab inside Adult Education now; keep old links working. */}
          <Route path="/assessments" element={<Navigate to="/students/assessments" replace />} />
          <Route path="/casemanagement/:section?" element={<CaseManagement />} />
          <Route path="/outreach/:program?/:section?" element={<RequireRoute routeKey="outreach"><Outreach /></RequireRoute>} />
          {/* SNAP Outreach became a program inside Outreach (O1); keep old links working. */}
          <Route path="/snap/*" element={<Navigate to="/outreach/snap" replace />} />
          <Route path="/workforce/:section?" element={<Workforce />} />
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
