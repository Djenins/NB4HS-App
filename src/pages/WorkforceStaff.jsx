// WorkforceStaff.jsx -- Workforce's Staff & Access section (/workforce/staff):
// who can open the Workforce program (components/ProgramStaffAccess.jsx).
// Only for people who can see staff accounts; anyone else goes back to the
// Workforce dashboard.
import { Navigate } from "react-router-dom";
import { useApp } from "../context/AppContext.jsx";
import { navLabel } from "../lib/nav.js";
import ProgramStaffAccess, { programStaffVisible } from "../components/ProgramStaffAccess.jsx";
import WorkforceNav from "../components/WorkforceNav.jsx";

export default function WorkforceStaff() {
  const { can, lang, permissionsLoaded } = useApp();
  if (!permissionsLoaded) return null;
  if (!programStaffVisible(can)) return <Navigate to="/workforce" replace />;
  return (
    <>
      <WorkforceNav value="staff" />
      <ProgramStaffAccess program="workforce" programName={navLabel("workforce", lang)} />
    </>
  );
}
