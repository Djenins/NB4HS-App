// ForYouPanel.jsx -- the personal strip at the top of Home (plans/unified-
// access-architecture.md §7.1, "Home built from widgets the user is
// authorized for"): your reports due, your SNAP follow-ups, your
// appointments today. Each tile shows only if you can open the page it links
// to; with none, the panel renders nothing.
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CalendarClock, ClipboardPen, ListTodo } from "lucide-react";
import { useApp, useT } from "../../context/AppContext.jsx";
import { currentPeriodGroup, fetchMyExpectations } from "../../lib/staffReports.js";
import { fetchTasks, taskBuckets } from "../../lib/snapTasks.js";
import { navPath } from "../../lib/nav.js";
import { useNavItems } from "../../lib/useNavItems.js";
import { todayStr } from "../../lib/utils.js";
import { KpiCard } from "../ui/kpi-card.jsx";

// The numbers behind the tiles; null where the source isn't available.
export function forYouCounts({ expectations, tasks, appointments, email, today }) {
  // Reports: anything overdue, from any period, plus what's still due in the
  // current period (later periods aren't due yet).
  var reports = null;
  if (expectations) {
    var current = currentPeriodGroup(expectations, today);
    reports = {
      overdue: expectations.filter(function (e) { return !e.submittedAt && e.overdue; }).length,
      due: current ? current.rows.filter(function (e) { return !e.submittedAt && !e.overdue; }).length : 0
    };
  }
  var followUps = null;
  if (tasks) {
    var b = taskBuckets(tasks, today);
    followUps = { overdue: b.overdue.length, dueSoon: b.dueSoon.length };
  }
  var appts = null;
  if (appointments && email) {
    var me = email.toLowerCase();
    appts = appointments.filter(function (a) {
      return (a.assignedEmail || "").toLowerCase() === me && a.date === today && a.status !== "cancelled";
    }).length;
  }
  return { reports: reports, followUps: followUps, appointments: appts };
}

export default function ForYouPanel() {
  const { session, data } = useApp();
  const t = useT();
  const navigate = useNavigate();
  const { items } = useNavItems();
  const canReports = items.indexOf("myreports") !== -1;
  const canSnap = items.indexOf("outreach") !== -1 && !!(data.programRoles || {}).snap;
  const canCaseload = items.indexOf("mycaseload") !== -1;
  const [expectations, setExpectations] = useState(null);
  const [tasks, setTasks] = useState(null);
  const userId = session ? session.id : null;

  useEffect(() => {
    let cancelled = false;
    if (canReports) fetchMyExpectations().then((rows) => { if (!cancelled) setExpectations(rows); }).catch(() => {});
    if (canSnap && userId) fetchTasks({ program: "snap", assignedTo: userId }).then((rows) => { if (!cancelled) setTasks(rows); }).catch(() => {});
    return () => { cancelled = true; };
  }, [canReports, canSnap, userId]);

  const c = forYouCounts({
    expectations: canReports ? expectations : null,
    tasks: canSnap ? tasks : null,
    appointments: canCaseload ? data.appointments : null,
    email: session ? session.currentUserEmail : null,
    today: todayStr()
  });

  const tiles = [];
  if (c.reports) {
    const hint = c.reports.overdue ? t("forYouReportsOverdue").replace("{n}", c.reports.overdue) : t("forYouReportsHint");
    tiles.push(<KpiCard key="reports" icon={ClipboardPen} tone={c.reports.overdue ? "danger" : "info"} value={c.reports.due + c.reports.overdue}
      label={t("forYouReports")} hint={hint} onClick={() => navigate(navPath("myreports"))} />);
  }
  if (c.followUps) {
    tiles.push(<KpiCard key="tasks" icon={ListTodo} tone={c.followUps.overdue ? "danger" : "warning"} value={c.followUps.overdue + c.followUps.dueSoon}
      label={t("forYouFollowUps")} hint={c.followUps.overdue ? t("forYouFollowUpsOverdue").replace("{n}", c.followUps.overdue) : t("forYouFollowUpsHint")}
      onClick={() => navigate(navPath("outreach") + "/tasks")} />);
  }
  if (c.appointments !== null) {
    tiles.push(<KpiCard key="appts" icon={CalendarClock} tone="violet" value={c.appointments}
      label={t("forYouAppointments")} hint={t("forYouAppointmentsHint")} onClick={() => navigate(navPath("mycaseload"))} />);
  }
  if (!tiles.length) return null;

  return (
    <section aria-labelledby="for-you-title">
      <h2 id="for-you-title" className="m-0 mb-3 text-section font-semibold text-card-foreground">{t("forYouTitle")}</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">{tiles}</div>
    </section>
  );
}
