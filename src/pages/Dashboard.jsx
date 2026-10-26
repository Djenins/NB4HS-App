// Dashboard.jsx -- the staff home page, on the design system's dashboard
// template (plans/ui-design-system.md §2.4): PageHeader, titled KPI groups
// of KpiCards, then charts and lists in SectionCards on a 12-column grid.
//
// Every *data* computation is unchanged (computeStats(), rangeForPreset(),
// allDistributions(), classesMeetingToday(), computeDailyTrend(), ...), and
// every section is still here: Right now, today's class check-ins, check-ins
// over the last 7 days, recent check-ins, Totals, ESL instructional hours,
// the role-gated Food distribution group and the monthly Trends.
//
// No range control in the header: each KPI group is a fixed period by
// design (today / week / month / year side by side), so there is no single
// range for a control to drive.
import { CalendarDays, Clock3, DoorOpen, GraduationCap, LogIn, ShoppingBasket, Users } from "lucide-react";
import { useApp, useT } from "../context/AppContext.jsx";
import { WEEKDAYS } from "../lib/constants.js";
import { allDistributions } from "../lib/clients.js";
import { navItemsForRole } from "../lib/nav.js";
import { computeDailyTrend, computeStats, fmtHour, inRange, rangeForPreset } from "../lib/reports_data.js";
import { classesMeetingToday, studentsForClass } from "../lib/students.js";
import { dateStrFromDate, fmtDuration, fmtTime, fullServiceList, labelFor, todayStr } from "../lib/utils.js";
import BarList from "../components/BarList.jsx";
import DashChart from "../components/DashChart.jsx";
import { Avatar, AvatarFallback } from "../components/ui/avatar.jsx";
import { EmptyState } from "../components/ui/empty-state.jsx";
import { KpiCard } from "../components/ui/kpi-card.jsx";
import { PageHeader } from "../components/ui/page-header.jsx";
import { SectionCard } from "../components/ui/section-card.jsx";

// A titled group of KPIs or panels. The h2 replaces the old uppercase
// gold-dot overline: the heading carries the group on its own.
function Section({ id, title, description, children }) {
  return (
    <section aria-labelledby={id}>
      <div className="mb-3">
        <h2 id={id} className="m-0 text-section font-semibold text-card-foreground">{title}</h2>
        {description ? <p className="m-0 mt-0.5 text-meta text-muted">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

function KpiGrid({ children }) {
  return <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">{children}</div>;
}

function TodaysClassWidget() {
  const { data } = useApp();
  const t = useT();
  const today = classesMeetingToday(data.classes);
  const todayStrVal = todayStr();
  return (
    <SectionCard title={t("todaysClassCheckIns")}>
      {!today.length ? (
        <EmptyState compact icon={CalendarDays} title={t("noClassesMeetingToday")} description={t("noClassesMeetingTodayHint")} />
      ) : (
        <ul className="m-0 grid list-none grid-cols-1 gap-x-8 gap-y-4 p-0 md:grid-cols-2">
          {today.map((c) => {
            const roster = studentsForClass(data.students, c.key);
            const rosterIds = roster.map((s) => s.id);
            const checkedIn = data.visits.filter((v) => v.date === todayStrVal && v.studentId && rosterIds.indexOf(v.studentId) !== -1).length;
            const pct = roster.length ? Math.round((checkedIn / roster.length) * 100) : 0;
            return (
              <li key={c.key} className="m-0">
                <div className="mb-1.5 flex items-baseline justify-between gap-3 text-ui">
                  <span className="min-w-0 break-words font-semibold text-card-foreground">{c.name}</span>
                  <span className="shrink-0 tabular-nums text-muted">{checkedIn}/{roster.length}</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-chip bg-surface-sunken" aria-hidden="true">
                  {/* width is the live check-in share, so it stays inline */}
                  <div className="h-full rounded-chip bg-tone-info-solid" style={{ width: pct + "%" }} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </SectionCard>
  );
}

function RecentCheckIns({ visits, services, lang, t, className }) {
  const recent = visits.slice().sort((a, b) => new Date(b.timeIn) - new Date(a.timeIn)).slice(0, 5);
  return (
    <SectionCard title={t("recentCheckInsTitle")} className={className}>
      {!recent.length ? (
        <EmptyState compact icon={Users} title={t("noRecentCheckIns")} description={t("noRecentCheckInsHint")} />
      ) : (
        <ul className="m-0 flex list-none flex-col divide-y divide-line-subtle p-0">
          {recent.map((v) => {
            const initials = ((v.firstName || "").charAt(0) + (v.lastName || "").charAt(0)).toUpperCase() || "?";
            const programLabel = v.className || labelFor(services, v.service, lang);
            return (
              <li key={v.id} className="m-0 flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                <Avatar className="h-9 w-9">
                  <AvatarFallback>{initials}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-ui font-semibold text-card-foreground">{v.firstName} {v.lastName}</div>
                  <div className="truncate text-meta text-muted">{programLabel}</div>
                </div>
                <span className="shrink-0 text-meta tabular-nums text-muted">{fmtTime(v.timeIn)}</span>
              </li>
            );
          })}
        </ul>
      )}
    </SectionCard>
  );
}

// New vs. returning is a two-part whole, so it is one proportion bar with
// both numbers printed beside their swatches -- a two-slice donut would make
// readers compare angles to read two numbers.
function SplitBar({ parts, emptyTitle }) {
  const total = parts.reduce((sum, p) => sum + p.value, 0);
  if (!total) return <EmptyState compact title={emptyTitle} />;
  return (
    <div>
      <div className="flex h-3 w-full gap-0.5 overflow-hidden rounded-chip" aria-hidden="true">
        {parts.map((p) => (p.value > 0 ? (
          // width is the data share, so it stays inline
          <div key={p.label} className={"h-full " + p.fill} style={{ width: (p.value / total) * 100 + "%" }} />
        ) : null))}
      </div>
      <dl className="m-0 mt-4 grid grid-cols-2 gap-4">
        {parts.map((p) => (
          <div key={p.label} className="min-w-0">
            <dt className="flex items-center gap-2 text-meta text-muted">
              <span className={"h-2.5 w-2.5 shrink-0 rounded-chip " + p.fill} aria-hidden="true" />
              <span className="min-w-0 break-words">{p.label}</span>
            </dt>
            <dd className="m-0 mt-1 flex items-baseline gap-2">
              <span className="text-heading font-bold tabular-nums text-card-foreground">{p.value}</span>
              <span className="text-meta tabular-nums text-muted">{Math.round((p.value / total) * 100)}%</span>
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export default function Dashboard() {
  const { data, lang, session } = useApp();
  const t = useT();

  const range = rangeForPreset("today");
  const s = computeStats(data.visits, range);
  const totalRange = rangeForPreset("month");
  const allStats = computeStats(data.visits, totalRange);

  // Rolling 7-day "Check-Ins Over Time" trend -- reuses computeDailyTrend(),
  // the same function Reports.jsx's own trend chart already calls.
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
  const trendRange = { from: dateStrFromDate(sevenDaysAgo), to: todayStr() };
  const checkInsTrend = computeDailyTrend(data.visits, trendRange);

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
  const svcItems = svcTop6.map((x) => ({ label: labelFor(services, x.key, lang), count: x.count }));
  const hourTop6 = allStats.hourSorted.slice(0, 6);
  const dayNames = WEEKDAYS[lang] || WEEKDAYS.en;
  const hourItems = hourTop6.map((x) => ({ label: fmtHour(x.hour), count: x.count }));
  const newVsReturning = [
    { label: t("newClients"), value: allStats.newCount, fill: "bg-tone-success-solid" },
    { label: t("returningClients"), value: allStats.returningCount, fill: "bg-tone-info-solid" }
  ];
  const noData = <EmptyState compact title={t("noReportDataMessage")} />;

  return (
    <div className="flex flex-col gap-8">
      <PageHeader className="mb-0" title={t("dashboardTitle")} description={t("dashboardWelcomeSubtitle")} />

      <Section id="dash-now" title={t("dashSectionToday")}>
        <div className="flex flex-col gap-4">
          <KpiGrid>
            <KpiCard icon={Users} tone="info" value={s.todayVisits.length} label={t("todaysVisitors")} />
            <KpiCard icon={LogIn} tone="success" value={s.currentlyIn.length} label={t("currentlyInBuilding")} />
            <KpiCard icon={DoorOpen} tone="neutral" value={s.checkedOutToday.length} label={t("checkedOutToday")} />
            <KpiCard icon={Clock3} tone="violet" value={fmtDuration(s.avgLen, lang)} label={t("avgVisitLength")} />
          </KpiGrid>

          <TodaysClassWidget />

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
            <SectionCard className="lg:col-span-8" title={t("checkInsOverTimeTitle")} description={t("last7DaysLabel")}>
              <DashChart
                type="line"
                title={t("checkInsOverTimeTitle")}
                labels={checkInsTrend.labels}
                datasets={[{ data: checkInsTrend.data }]}
                fallback={noData}
              />
            </SectionCard>
            <RecentCheckIns className="lg:col-span-4" visits={s.todayVisits} services={services} lang={lang} t={t} />
          </div>
        </div>
      </Section>

      <Section id="dash-totals" title={t("dashSectionTotals")}>
        <KpiGrid>
          <KpiCard icon={CalendarDays} tone="info" value={s.totalToday} label={t("totalToday")} />
          <KpiCard icon={CalendarDays} tone="info" value={s.totalWeek} label={t("totalWeek")} />
          <KpiCard icon={CalendarDays} tone="info" value={s.totalMonth} label={t("totalMonth")} />
          <KpiCard icon={CalendarDays} tone="info" value={s.totalYear} label={t("totalYear")} />
        </KpiGrid>
      </Section>

      {/* Flat NRS/grant-reporting credit: every completed student check-in
          counts as STUDENT_VISIT_HOURS (4) hours regardless of actual Time
          In/Time Out -- see reports_data.js's computeStats(). Visitor/Case
          Management/Job Developer visits never count here. */}
      <Section id="dash-hours" title={t("dashSectionInstructionalHours")}>
        <KpiGrid>
          <KpiCard icon={GraduationCap} tone="violet" value={s.studentHoursToday} label={t("instructionalHoursToday")} />
          <KpiCard icon={GraduationCap} tone="violet" value={s.studentHoursWeek} label={t("instructionalHoursWeek")} />
          <KpiCard icon={GraduationCap} tone="violet" value={s.studentHoursMonth} label={t("instructionalHoursMonth")} />
          <KpiCard icon={GraduationCap} tone="violet" value={s.studentHoursYear} label={t("instructionalHoursYear")} />
        </KpiGrid>
      </Section>

      {showFoodStats && (
        <Section id="dash-food" title={t("dashSectionFoodDistribution")}>
          <KpiGrid>
            <KpiCard icon={ShoppingBasket} tone="success" value={(data.foodClients || []).length} label={t("totalHouseholdsLabel")} />
            <KpiCard icon={ShoppingBasket} tone="success" value={distWeek} label={t("distributionsWeekLabel")} />
            <KpiCard icon={ShoppingBasket} tone="success" value={distMonth} label={t("distributionsMonthLabel")} />
            <KpiCard icon={ShoppingBasket} tone="success" value={distYear} label={t("distributionsYearLabel")} />
          </KpiGrid>
        </Section>
      )}

      {/* Every Trends panel reads the current month (allStats). */}
      <Section id="dash-trends" title={t("dashSectionTrends")} description={t("thisMonth")}>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          <SectionCard className="lg:col-span-6" title={t("mostRequestedServices")}>
            <BarList items={svcItems} label={t("mostRequestedServices")} empty={noData} />
          </SectionCard>
          <SectionCard className="lg:col-span-6" title={t("newVsReturning")}>
            <SplitBar parts={newVsReturning} emptyTitle={t("noReportDataMessage")} />
          </SectionCard>
          <SectionCard className="lg:col-span-6" title={t("mostActiveDays")}>
            <DashChart
              type="bar"
              title={t("mostActiveDays")}
              labels={dayNames}
              datasets={[{ data: allStats.dayCounts }]}
              fallback={noData}
            />
          </SectionCard>
          <SectionCard className="lg:col-span-6" title={t("mostActiveHours")}>
            <BarList items={hourItems} label={t("mostActiveHours")} tone="violet" empty={noData} />
          </SectionCard>
        </div>
      </Section>
    </div>
  );
}
