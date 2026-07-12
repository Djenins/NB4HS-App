// Dashboard.jsx -- Tailwind/shadcn/Recharts/Framer Motion redesign pass
// (client-provided NB4HS dashboard mockup). Every *data* computation below
// is unchanged from the previous version of this file (computeStats(),
// rangeForPreset(), allDistributions(), classesMeetingToday(), etc. --
// all still coming from the same lib/ modules); only the presentation
// layer changed: shadcn Card instead of the plain .card/.stat-card classes,
// Lucide icons instead of the inline SVG set, Recharts instead of Chart.js
// (DashChart.jsx), Framer Motion for entrance animation. No section was
// removed -- Today/TodaysClassWidget/Totals/Instructional Hours/gated Food
// Distribution/Trends are all still here. One panel was *added* ("Check-
// Ins Over Time" + "Recent Check-Ins", matching the mockup's most
// prominent visual block) -- it's built entirely from data.visits +
// computeDailyTrend(), both of which already existed and are already used
// this same way on Reports.jsx, so nothing new was invented to build it.
// Reports.jsx/StatCard.jsx/DashChart.jsx are untouched and keep using the
// old plain-CSS/Chart.js system.
import { AnimatePresence, motion } from "framer-motion";
import { CalendarDays, Clock3, DoorOpen, GraduationCap, LogIn, ShoppingBasket, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis } from "recharts";
import { useApp, useT } from "../context/AppContext.jsx";
import { WEEKDAYS } from "../lib/constants.js";
import { allDistributions } from "../lib/clients.js";
import { navItemsForRole } from "../lib/nav.js";
import { computeDailyTrend, computeStats, fmtHour, inRange, rangeForPreset } from "../lib/reports_data.js";
import { classesMeetingToday, studentsForClass } from "../lib/students.js";
import { dateStrFromDate, fmtDuration, fmtTime, fullServiceList, labelFor, todayStr } from "../lib/utils.js";
import { Avatar, AvatarFallback } from "../components/ui/avatar.jsx";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card.jsx";
import { Badge } from "../components/ui/badge.jsx";
import EmptyState from "../components/EmptyState.jsx";

// Same brand hex values DashChart.jsx already hardcodes for its own chart
// palette (PALETTE const in that file) -- duplicated here rather than
// imported since DashChart.jsx doesn't export it. NB4HS Design System chart
// palette: Blue, Green, Gold, Purple only ("never use random colors"); red
// is excluded since charts aren't error states.
const CHART_PALETTE = ["#2563EB", "#1a7f37", "#D99E32", "#6b21a8"];

// Reads the live theme's neutral colors (same CSS custom properties
// DashChart.jsx already reads) so Recharts axis/grid/tooltip colors stay in
// sync with light/dark mode, re-reading whenever the app's data-theme
// attribute changes (ThemeToggle.jsx / storage.js's applyTheme()).
function useChartColors() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const obs = new MutationObserver(() => setTick((x) => x + 1));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => obs.disconnect();
  }, []);
  return useMemo(() => {
    const s = getComputedStyle(document.documentElement);
    return {
      muted: s.getPropertyValue("--muted").trim() || "#5b6572",
      border: s.getPropertyValue("--border").trim() || "#d9dee4",
      card: s.getPropertyValue("--card").trim() || "#ffffff",
      text: s.getPropertyValue("--text").trim() || "#231F20"
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick]);
}

function StatTile({ icon: Icon, num, label, index }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: index * 0.05 }}
    >
      <Card>
        <CardContent className="flex items-center justify-between gap-4 p-5">
          <div className="min-w-0">
            <div className="truncate text-sm font-medium text-muted">{label}</div>
            <div className="mt-1 text-3xl font-extrabold tracking-tight text-card-foreground">{num}</div>
          </div>
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-tint text-primary">
            <Icon className="h-5 w-5" strokeWidth={2} />
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function TodaysClassWidget() {
  const { data } = useApp();
  const t = useT();
  const today = classesMeetingToday(data.classes);
  const todayStrVal = todayStr();
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("todaysClassCheckIns")}</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        {!today.length ? (
          <EmptyState icon="calendar" message={t("noClassesMeetingToday")} />
        ) : (
          <div className="space-y-3">
            {today.map((c) => {
              const roster = studentsForClass(data.students, c.key);
              const rosterIds = roster.map((s) => s.id);
              const checkedIn = data.visits.filter((v) => v.date === todayStrVal && v.studentId && rosterIds.indexOf(v.studentId) !== -1).length;
              const pct = roster.length ? Math.round((checkedIn / roster.length) * 100) : 0;
              return (
                <div key={c.key}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="font-semibold text-card-foreground">{c.name}</span>
                    <span className="text-muted">{checkedIn}/{roster.length}</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-tint-neutral">
                    <div className="h-full rounded-full bg-primary transition-all" style={{ width: pct + "%" }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function RecentCheckIns({ visits, services, lang, t }) {
  const recent = visits.slice().sort((a, b) => new Date(b.timeIn) - new Date(a.timeIn)).slice(0, 5);
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("recentCheckInsTitle")}</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        {!recent.length ? (
          <p className="text-sm text-muted">{t("noRecentCheckIns")}</p>
        ) : (
          <div className="space-y-1">
            {recent.map((v) => {
              const initials = ((v.firstName || "").charAt(0) + (v.lastName || "").charAt(0)).toUpperCase() || "?";
              const programLabel = v.className || labelFor(services, v.service, lang);
              return (
                <div key={v.id} className="flex items-center gap-3 rounded-lg px-1 py-2">
                  <Avatar className="h-9 w-9">
                    <AvatarFallback>{initials}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-card-foreground">{v.firstName} {v.lastName}</div>
                    <div className="truncate text-xs text-muted">{programLabel}</div>
                  </div>
                  <Badge variant="success" className="shrink-0">{fmtTime(v.timeIn)}</Badge>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Small gold marker dot in front of each Dashboard section header -- the
// brand spec calls out "Section headers" as one of the sparing places gold
// belongs on this page. Scoped to Dashboard.jsx only (not main.css's shared
// .section-label rule, which is also used by many other pages where gold
// isn't called for) so it can't spread gold anywhere it wasn't asked for.
function SectionLabel({ children, className }) {
  return (
    <div className={"section-label flex items-center gap-1.5" + (className ? " " + className : "")}>
      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-gold" />
      {children}
    </div>
  );
}

function ChartCard({ title, children }) {
  return (
    <Card>
      <CardHeader><CardTitle>{title}</CardTitle></CardHeader>
      <CardContent className="pt-0">
        <div className="h-[240px]">{children}</div>
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const { data, lang, session } = useApp();
  const t = useT();
  const colors = useChartColors();

  const range = rangeForPreset("today");
  const s = computeStats(data.visits, range);
  const totalRange = rangeForPreset("month");
  const allStats = computeStats(data.visits, totalRange);

  // Rolling 7-day "Check-Ins Over Time" trend -- reuses computeDailyTrend(),
  // the same function Reports.jsx's own trend chart (and the Food
  // Distribution trend) already call; nothing new was built to compute this.
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
  const trendRange = { from: dateStrFromDate(sevenDaysAgo), to: todayStr() };
  const checkInsTrend = computeDailyTrend(data.visits, trendRange);
  const trendData = checkInsTrend.labels.map((label, i) => ({ label, count: checkInsTrend.data[i] }));

  // Food Distribution has its own nav item (Administrator + Staff only) --
  // only show its dashboard numbers to roles that actually have access to
  // that section, same gate as the nav itself.
  const role = session ? session.role : null;
  const showFoodStats = navItemsForRole(role).indexOf("fooddistribution") !== -1;
  const distributions = allDistributions(data.foodClients);
  const distWeekRange = rangeForPreset("week");
  const distMonthRange = rangeForPreset("month");
  const distYearRange = rangeForPreset("year");
  const distWeek = distributions.filter((d) => inRange(d, distWeekRange.from, distWeekRange.to)).length;
  const distMonth = distributions.filter((d) => inRange(d, distMonthRange.from, distMonthRange.to)).length;
  const distYear = distributions.filter((d) => inRange(d, distYearRange.from, distYearRange.to)).length;

  const services = fullServiceList(data.customServices);
  const svcTop6 = allStats.svcSorted.slice(0, 6);
  const svcPieData = svcTop6.map((x) => ({ name: labelFor(services, x.key, lang), value: x.count }));
  const hourTop6 = allStats.hourSorted.slice(0, 6);
  const dayNames = WEEKDAYS[lang] || WEEKDAYS.en;
  const dayData = allStats.dayCounts.map((c, i) => ({ day: dayNames[i], count: c }));
  const hourData = hourTop6.map((x) => ({ hour: fmtHour(x.hour), count: x.count }));
  const newVsReturning = [
    { name: t("newClients"), value: allStats.newCount, color: "#1a7f37" },
    { name: t("returningClients"), value: allStats.returningCount, color: "#2563EB" }
  ];

  return (
    <>
      <h1>{t("dashboardTitle")}</h1>
      <p className="mb-4 -mt-2 text-sm text-muted">{t("dashboardWelcomeSubtitle")}</p>

      <SectionLabel>{t("dashSectionToday")}</SectionLabel>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile icon={Users} num={s.todayVisits.length} label={t("todaysVisitors")} index={0} />
        <StatTile icon={LogIn} num={s.currentlyIn.length} label={t("currentlyInBuilding")} index={1} />
        <StatTile icon={DoorOpen} num={s.checkedOutToday.length} label={t("checkedOutToday")} index={2} />
        <StatTile icon={Clock3} num={fmtDuration(s.avgLen, lang)} label={t("avgVisitLength")} index={3} />
      </div>

      <div className="mt-5">
        <TodaysClassWidget />
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle>{t("checkInsOverTimeTitle")}</CardTitle>
              <Badge variant="neutral">{t("last7DaysLabel")}</Badge>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="h-[240px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trendData} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                    <defs>
                      <linearGradient id="checkinsFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#2563EB" stopOpacity={0.28} />
                        <stop offset="100%" stopColor="#2563EB" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke={colors.border} vertical={false} />
                    <XAxis dataKey="label" tick={{ fill: colors.muted, fontSize: 12 }} axisLine={false} tickLine={false} />
                    <YAxis allowDecimals={false} tick={{ fill: colors.muted, fontSize: 12 }} axisLine={false} tickLine={false} />
                    <RTooltip contentStyle={{ background: colors.card, border: "1px solid " + colors.border, borderRadius: 10, color: colors.text }} />
                    <Area type="monotone" dataKey="count" stroke="#2563EB" strokeWidth={2.5} fill="url(#checkinsFill)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>
        <RecentCheckIns visits={s.todayVisits} services={services} lang={lang} t={t} />
      </div>

      <SectionLabel>{t("dashSectionTotals")}</SectionLabel>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile icon={CalendarDays} num={s.totalToday} label={t("totalToday")} index={0} />
        <StatTile icon={CalendarDays} num={s.totalWeek} label={t("totalWeek")} index={1} />
        <StatTile icon={CalendarDays} num={s.totalMonth} label={t("totalMonth")} index={2} />
        <StatTile icon={CalendarDays} num={s.totalYear} label={t("totalYear")} index={3} />
      </div>

      {/* Flat NRS/grant-reporting credit: every completed student check-in
          counts as STUDENT_VISIT_HOURS (4) hours regardless of actual Time
          In/Time Out -- see reports_data.js's computeStats(). Visitor/Case
          Management/Job Developer visits never count here. */}
      <SectionLabel>{t("dashSectionInstructionalHours")}</SectionLabel>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile icon={GraduationCap} num={s.studentHoursToday} label={t("instructionalHoursToday")} index={0} />
        <StatTile icon={GraduationCap} num={s.studentHoursWeek} label={t("instructionalHoursWeek")} index={1} />
        <StatTile icon={GraduationCap} num={s.studentHoursMonth} label={t("instructionalHoursMonth")} index={2} />
        <StatTile icon={GraduationCap} num={s.studentHoursYear} label={t("instructionalHoursYear")} index={3} />
      </div>

      <AnimatePresence>
        {showFoodStats && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {/* Not a :first-child on the page, but it is the first child of
                this motion.div wrapper -- main.css's .section-label:first-child
                rule (margin-top:0) would otherwise match it by accident, so
                the normal 22px top margin is restored explicitly here. */}
            <SectionLabel className="!mt-[22px]">{t("dashSectionFoodDistribution")}</SectionLabel>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatTile icon={ShoppingBasket} num={(data.foodClients || []).length} label={t("totalHouseholdsLabel")} index={0} />
              <StatTile icon={ShoppingBasket} num={distWeek} label={t("distributionsWeekLabel")} index={1} />
              <StatTile icon={ShoppingBasket} num={distMonth} label={t("distributionsMonthLabel")} index={2} />
              <StatTile icon={ShoppingBasket} num={distYear} label={t("distributionsYearLabel")} index={3} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <SectionLabel>{t("dashSectionTrends")}</SectionLabel>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard title={t("mostRequestedServices")}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={svcPieData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={2}>
                {svcPieData.map((_, i) => <Cell key={i} fill={CHART_PALETTE[i % CHART_PALETTE.length]} />)}
              </Pie>
              <Legend verticalAlign="middle" align="right" layout="vertical" iconType="circle" wrapperStyle={{ fontSize: 12, color: colors.muted }} />
              <RTooltip contentStyle={{ background: colors.card, border: "1px solid " + colors.border, borderRadius: 10, color: colors.text }} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title={t("newVsReturning")}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={newVsReturning} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={2}>
                {newVsReturning.map((entry, i) => <Cell key={i} fill={entry.color} />)}
              </Pie>
              <Legend verticalAlign="bottom" iconType="circle" wrapperStyle={{ fontSize: 12, color: colors.muted }} />
              <RTooltip contentStyle={{ background: colors.card, border: "1px solid " + colors.border, borderRadius: 10, color: colors.text }} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard title={t("mostActiveDays")}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dayData} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
              <CartesianGrid stroke={colors.border} vertical={false} />
              <XAxis dataKey="day" tick={{ fill: colors.muted, fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fill: colors.muted, fontSize: 12 }} axisLine={false} tickLine={false} />
              <RTooltip contentStyle={{ background: colors.card, border: "1px solid " + colors.border, borderRadius: 10, color: colors.text }} />
              <Bar dataKey="count" fill="#2563EB" radius={[6, 6, 0, 0]} maxBarSize={42} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title={t("mostActiveHours")}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={hourData} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
              <CartesianGrid stroke={colors.border} vertical={false} />
              <XAxis dataKey="hour" tick={{ fill: colors.muted, fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fill: colors.muted, fontSize: 12 }} axisLine={false} tickLine={false} />
              <RTooltip contentStyle={{ background: colors.card, border: "1px solid " + colors.border, borderRadius: 10, color: colors.text }} />
              <Bar dataKey="count" fill="#D99E32" radius={[6, 6, 0, 0]} maxBarSize={42} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </>
  );
}
