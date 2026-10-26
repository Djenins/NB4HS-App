// AdultEdNav.jsx -- Adult Education's section menu (ModuleNav), shared by
// pages/Students.jsx (/students/:section) and pages/Assessments.jsx, which
// keeps its own guarded route at /students/assessments (App.jsx). The
// Assessments item only shows for people who can open that page.
import { CalendarRange, ClipboardCheck, LayoutGrid, ListOrdered, School, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useT } from "../context/AppContext.jsx";
import { useNavItems } from "../lib/useNavItems.js";
import ModuleNav from "./ModuleNav.jsx";

export const ADULT_ED_SECTIONS = [
  { key: "dashboard", label: "snapSectionDashboard", icon: LayoutGrid },
  { key: "students", label: "navStudents", icon: Users },
  { key: "classrooms", label: "classroomsHeading", icon: School },
  { key: "waitinglist", label: "waitingList", icon: ListOrdered },
  { key: "assessments", label: "navAssessments", icon: ClipboardCheck },
  { key: "sessions", label: "adultEdSectionSessions", icon: CalendarRange }
];

export default function AdultEdNav({ value }) {
  const t = useT();
  const navigate = useNavigate();
  const { items } = useNavItems();
  const visible = ADULT_ED_SECTIONS.filter((s) => s.key !== "assessments" || items.indexOf("assessments") !== -1);
  return (
    <ModuleNav
      label={t("navAdultEducation")}
      items={visible.map((s) => ({ key: s.key, label: t(s.label), icon: s.icon }))}
      value={value}
      onChange={(key) => navigate("/students/" + key)}
    />
  );
}
