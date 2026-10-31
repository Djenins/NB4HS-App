// WorkforceNav.jsx -- Workforce Development's section menu (ModuleNav).
// The sidebar folds Workforce into one entry (sidebar/sidebarNav.js), so
// this strip is how people move between its pages. Each Workforce page
// keeps its own guarded route (/workforce/...), so the menu is rendered by
// every list page and only lists the pages the signed-in user may open.
// Appointments isn't a nav key of its own: it goes with Job Seekers (same
// access) and carries the count of requests waiting for a job developer --
// the same number as the sidebar's Workforce badge.
import { CalendarDays } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useApp, useT } from "../context/AppContext.jsx";
import { pendingApptCount } from "../lib/appointments.js";
import { navLabel, navPath } from "../lib/nav.js";
import { NAV_ICONS } from "../lib/navIcons.js";
import { useNavItems } from "../lib/useNavItems.js";
import ModuleNav from "./ModuleNav.jsx";

const WORKFORCE_KEYS = [
  "workforcedashboard", "jobdeveloper", "employers", "jobopenings",
  "candidatematching", "referrals", "placements", "workforcereports"
];

export const APPOINTMENTS_PATH = "/workforce/appointments";

export default function WorkforceNav({ value }) {
  const { lang, data } = useApp();
  const t = useT();
  const navigate = useNavigate();
  const { items } = useNavItems();
  const entries = [];
  WORKFORCE_KEYS.filter((k) => items.indexOf(k) !== -1).forEach((k) => {
    entries.push({ key: k, label: navLabel(k, lang), icon: NAV_ICONS[k], to: navPath(k) });
    if (k === "jobdeveloper") {
      entries.push({
        key: "appointments", label: t("appointmentsTitle"), icon: CalendarDays, to: APPOINTMENTS_PATH,
        badge: pendingApptCount(data.appointments, "job_developer")
      });
    }
  });
  return (
    <ModuleNav
      label={navLabel("workforce", lang)}
      items={entries.map(({ to, ...item }) => item)}
      value={value}
      onChange={(k) => navigate(entries.find((e) => e.key === k).to)}
    />
  );
}
