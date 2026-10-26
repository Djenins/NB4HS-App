// Reports.jsx -- visit, food distribution and job reporting for a chosen
// date range, on the design system's dashboard template
// (plans/ui-design-system.md §2.4): PageHeader with export and print, one
// range row above everything it scopes, KpiCard rows with a signed
// "vs previous period" delta, then charts and ranked lists in SectionCards
// on a 12-column grid.
//
// All the underlying data (range presets, previous-period comparison, stats,
// trends, grant attribution, food and job numbers, CSV/Excel export) is
// unchanged -- only the presentation layer changed.
import { useEffect, useState } from "react";
import {
  Award, Briefcase, Calendar, ChevronDown, Clock, Download, FileText, GraduationCap, Home,
  Printer, Repeat, UserPlus, Users
} from "lucide-react";
import { useApp, useT } from "../context/AppContext.jsx";
import { WEEKDAYS } from "../lib/constants.js";
import { useNavItems } from "../lib/useNavItems.js";
import { fetchAllApplications, fetchAllDistributions, subscribeClientsTable } from "../lib/clientsData.js";
import { applicationStatusLabel, pipelineStageLabel } from "../lib/jobProfile.js";
import {
  computeDailyTrend, computeDailyValueTrend, computeGeoBreakdown, computeJobOutcomes, computeMostActiveDay,
  computeStats, exportCSV, exportExcel, fmtHour, inRange, parseQuantity, previousRange, rangeForPreset, trendPct
} from "../lib/reports_data.js";
import { fetchGrants } from "../lib/grants.js";
import { fetchCaseNoteIdsInRange, fetchGrantTagsForRecords } from "../lib/serviceGrantTags.js";
import { fmtDuration, fullServiceList, fullStaffList, labelFor, todayStr } from "../lib/utils.js";
import { cn } from "../lib/cn.js";
import BarList from "../components/BarList.jsx";
import DashChart from "../components/DashChart.jsx";
import { Button } from "../components/ui/button.jsx";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../components/ui/dropdown-menu.jsx";
import { EmptyState } from "../components/ui/empty-state.jsx";
import { KpiCard } from "../components/ui/kpi-card.jsx";
import { PageHeader } from "../components/ui/page-header.jsx";
import { RangeBar } from "../components/ui/range-bar.jsx";
import { TrendDelta } from "../components/ui/trend-delta.jsx";
import { SectionCard } from "../components/ui/section-card.jsx";
import { Skeleton } from "../components/ui/skeleton.jsx";

const PRESETS = ["today", "week", "month", "quarter", "year", "custom"];
const PRESET_LABEL_KEY = { today: "today", week: "thisWeek", month: "thisMonth", quarter: "thisQuarter", year: "thisYear", custom: "custom" };

// Two-up / four-up KPI rows: 2 columns on phones, `cols` from lg.
function KpiGrid({ cols = 4, children }) {
  return <div className={cn("grid grid-cols-2 gap-4", cols === 4 ? "lg:grid-cols-4" : "lg:grid-cols-2")}>{children}</div>;
}

// A titled group of KPIs and panels.
function Section({ id, title, children }) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-4">
      <h2 id={id} className="m-0 text-section font-semibold text-card-foreground">{title}</h2>
      {children}
    </section>
  );
}

export default function Reports() {
  const { data, lang, showToast, session } = useApp();
  const t = useT();
  const [reportRange, setReportRange] = useState("today");
  const [customFrom, setCustomFrom] = useState(todayStr());
  const [customTo, setCustomTo] = useState(todayStr());

  const range = reportRange === "custom" ? { from: customFrom || todayStr(), to: customTo || todayStr() } : rangeForPreset(reportRange);
  const prevRange = previousRange(range);
  const s = computeStats(data.visits, range);
  const prevS = computeStats(data.visits, prevRange);
  const trend = computeDailyTrend(data.visits, range);
  const geo = computeGeoBreakdown(data.visits, data.students, range);
  const dayNames = WEEKDAYS[lang] || WEEKDAYS.en;
  const services = fullServiceList(data.customServices);
  const staffList = fullStaffList(data.customStaff);
  const hourTop8 = s.hourSorted.slice(0, 8);
  const cityTop8 = geo.citySorted.slice(0, 8);
  const zipTop8 = geo.zipSorted.slice(0, 8);
  const mostActiveDay = computeMostActiveDay(data.visits, range);
  const peakHour = s.hourSorted[0];

  const [grantBreakdown, setGrantBreakdown] = useState([]);
  const [grantTotals, setGrantTotals] = useState({ tagged: 0, untagged: 0 });
  // Only the first load shows a skeleton; a range change keeps the previous
  // breakdown on screen until the new one arrives (no flash).
  const [grantsLoaded, setGrantsLoaded] = useState(false);
  const visitIdsKey = s.inRangeVisits.map((v) => v.id).join(",");

  useEffect(() => {
    let cancelled = false;
    const visitIds = visitIdsKey ? visitIdsKey.split(",") : [];
    (async () => {
      const [grants, noteIds] = await Promise.all([fetchGrants(), fetchCaseNoteIdsInRange(range.from, range.to)]);
      const [visitTags, noteTags] = await Promise.all([
        fetchGrantTagsForRecords("visits", visitIds),
        fetchGrantTagsForRecords("case_client_notes", noteIds),
      ]);
      if (cancelled) return;
      const counts = {};
      Object.values(visitTags).concat(Object.values(noteTags)).forEach((gid) => { counts[gid] = (counts[gid] || 0) + 1; });
      const taggedTotal = Object.values(counts).reduce((a, b) => a + b, 0);
      const totalServices = visitIds.length + noteIds.length;
      const rows = grants
        .map((g) => ({ label: g.name, count: counts[g.id] || 0 }))
        .filter((r) => r.count > 0)
        .sort((a, b) => b.count - a.count);
      setGrantBreakdown(rows);
      setGrantTotals({ tagged: taggedTotal, untagged: Math.max(0, totalServices - taggedTotal) });
      setGrantsLoaded(true);
    })();
    return () => { cancelled = true; };
  }, [visitIdsKey, range.from, range.to]);

  // Food Distribution is Administrator/Staff only -- only show its numbers
  // here to roles that actually have that nav item, same gate as the nav.
  const { items: navItems } = useNavItems();
  const showFoodStats = navItems.indexOf("fooddistribution") !== -1;

  // food_distributions is its own table (not embedded on data.foodClients),
  // so it's fetched here directly -- same pattern FoodDistribution.jsx uses
  // for its own household-level `.distributions` attachment.
  const [distributions, setDistributions] = useState([]);
  useEffect(() => {
    if (!showFoodStats) return undefined;
    let cancelled = false;
    fetchAllDistributions().then((rows) => { if (!cancelled) setDistributions(rows); });
    const unsub = subscribeClientsTable("food_distributions", () => {
      fetchAllDistributions().then((rows) => { if (!cancelled) setDistributions(rows); });
    });
    return () => { cancelled = true; unsub(); };
  }, [showFoodStats]);

  const distInRange = distributions.filter((d) => inRange(d, range.from, range.to));
  const distInPrev = distributions.filter((d) => inRange(d, prevRange.from, prevRange.to));
  const householdsServedCount = new Set(distInRange.map((d) => d.foodClientId)).size;
  const householdsServedPrevCount = new Set(distInPrev.map((d) => d.foodClientId)).size;
  const distTrend = computeDailyTrend(distributions, range);
  const distVolumeTrend = computeDailyValueTrend(distributions, range, (d) => parseQuantity(d.quantity));

  // Job Developer outcome/funnel reporting.
  const showJobStats = navItems.indexOf("jobdeveloper") !== -1;
  const [applications, setApplications] = useState([]);
  useEffect(() => {
    if (!showJobStats) return undefined;
    let cancelled = false;
    fetchAllApplications().then((rows) => { if (!cancelled) setApplications(rows); });
    const unsub = subscribeClientsTable("job_applications", () => {
      fetchAllApplications().then((rows) => { if (!cancelled) setApplications(rows); });
    });
    return () => { cancelled = true; unsub(); };
  }, [showJobStats]);
  const jobOutcomes = computeJobOutcomes(data.jobClients, applications, range);
  const pipelineRows = Object.keys(jobOutcomes.pipelineCounts).map((key) => ({ label: pipelineStageLabel(key), count: jobOutcomes.pipelineCounts[key] }));
  const statusRows = Object.keys(jobOutcomes.statusCounts).map((key) => ({ label: applicationStatusLabel(key), count: jobOutcomes.statusCounts[key] }));

  function handleExportCSV() {
    exportCSV(data.visits, range, data.customServices, data.customStaff, lang);
    showToast(t("exportCSV") + " ✓");
  }
  function handleExportExcel() {
    exportExcel(data.visits, range, data.customServices, data.customStaff, lang);
    showToast(t("exportExcel") + " ✓");
  }

  const visitorsTrend = trendPct(s.inRangeVisits.length, prevS.inRangeVisits.length);
  const firstTimeTrend = trendPct(s.newCount, prevS.newCount);
  const repeatTrend = trendPct(s.returningCount, prevS.returningCount);
  const avgLenTrend = trendPct(Math.round(s.avgLen), Math.round(prevS.avgLen));
  const studentHoursTrend = trendPct(s.studentHours, prevS.studentHours);
  const distTrendPct = trendPct(distInRange.length, distInPrev.length);
  const householdsTrendPct = trendPct(householdsServedCount, householdsServedPrevCount);

  const noData = <EmptyState compact title={t("noReportDataMessage")} description={t("reportEmptyHint")} />;
  const rangeOptions = PRESETS.map((p) => ({ value: p, label: t(PRESET_LABEL_KEY[p]) }));
  const half = "lg:col-span-6";

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title={t("reportsTitle")}
        description={t("reportsSubtitle")}
        meta={
          <span className="inline-flex items-center gap-1.5 text-meta font-medium tabular-nums text-card-foreground">
            <Calendar className="h-4 w-4 text-muted" aria-hidden="true" />
            {range.from} &ndash; {range.to}
          </span>
        }
        actions={
          <div className="no-print flex flex-wrap items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="secondary">
                  <Download className="h-4 w-4" aria-hidden="true" />{t("exportLabel")}<ChevronDown className="h-4 w-4 text-muted" aria-hidden="true" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleExportCSV}>{t("exportCSV")}</DropdownMenuItem>
                <DropdownMenuItem onClick={handleExportExcel}>{t("exportExcel")}</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="secondary" onClick={() => window.print()}>
              <Printer className="h-4 w-4" aria-hidden="true" />{t("printPdf")}
            </Button>
          </div>
        }
      />

      <RangeBar
        idBase="rep"
        label={t("dateRangeLabel")}
        value={reportRange}
        onChange={setReportRange}
        options={rangeOptions}
        custom={{ from: customFrom, to: customTo, onFrom: setCustomFrom, onTo: setCustomTo, fromLabel: t("filterDateFrom"), toLabel: t("filterDateTo") }}
      />

      <Section id="rep-visits" title={t("reportSectionVisits")}>
        <KpiGrid>
          <KpiCard icon={Users} tone="info" value={s.inRangeVisits.length} label={t("numVisitors")} hint={<TrendDelta trend={visitorsTrend} t={t} />} />
          <KpiCard icon={UserPlus} tone="success" value={s.newCount} label={t("firstTime")} hint={<TrendDelta trend={firstTimeTrend} t={t} />} />
          <KpiCard icon={Repeat} tone="violet" value={s.returningCount} label={t("repeatVisitors")} hint={<TrendDelta trend={repeatTrend} t={t} />} />
          <KpiCard icon={Clock} tone="neutral" value={fmtDuration(s.avgLen, lang)} label={t("avgVisitLength")} hint={<TrendDelta trend={avgLenTrend} goodWhenUp={null} t={t} />} />
        </KpiGrid>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          <SectionCard className="lg:col-span-8" title={t("trendVisitsPerDay")}>
            <DashChart type="line" title={t("trendVisitsPerDay")} labels={trend.labels} datasets={[{ data: trend.data }]} fallback={noData} />
          </SectionCard>

          {/* The fifth visit figure sits here instead of alone on a second
              KPI row. Flat NRS/grant-reporting credit for the selected range
              -- 4 hours per completed student check-in, see reports_data.js;
              also a summary line above the CSV/Excel export table. Most
              active day and peak time stay behind the food-distribution gate
              they have always had. */}
          <SectionCard className="lg:col-span-4" title={t("reportHighlightsTitle")}>
            <dl className="m-0 flex flex-col divide-y divide-line-subtle">
              <div className="pb-4">
                <dt className="flex items-center gap-2 text-meta text-muted">
                  <GraduationCap className="h-4 w-4" aria-hidden="true" />{t("studentInstructionalHoursLabel")}
                </dt>
                <dd className="m-0 mt-1 text-heading font-bold tabular-nums text-card-foreground">{s.studentHours}</dd>
                <dd className="m-0 mt-1"><TrendDelta trend={studentHoursTrend} t={t} /></dd>
              </div>
              {showFoodStats && (
                <>
                  <div className="py-4">
                    <dt className="flex items-center gap-2 text-meta text-muted">
                      <Calendar className="h-4 w-4" aria-hidden="true" />{t("mostActiveDayLabel")}
                    </dt>
                    <dd className="m-0 mt-1 text-heading font-bold text-card-foreground">
                      {mostActiveDay ? dayNames[new Date(mostActiveDay.date + "T00:00:00").getDay()] : "–"}
                    </dd>
                    {mostActiveDay && <dd className="m-0 mt-0.5 text-meta tabular-nums text-muted">{mostActiveDay.date}</dd>}
                  </div>
                  <div className="pt-4">
                    <dt className="flex items-center gap-2 text-meta text-muted">
                      <Clock className="h-4 w-4" aria-hidden="true" />{t("peakVisitTimeLabel")}
                    </dt>
                    <dd className="m-0 mt-1 text-heading font-bold tabular-nums text-card-foreground">
                      {peakHour ? fmtHour(peakHour.hour) : "–"}
                    </dd>
                    {peakHour && <dd className="m-0 mt-0.5 text-meta tabular-nums text-muted">{peakHour.count} {t("visitorsSuffix")}</dd>}
                  </div>
                </>
              )}
            </dl>
          </SectionCard>
        </div>

        <SectionCard
          title={t("grantAttributionTitle")}
          action={
            <span className="inline-flex items-center gap-1.5 text-meta font-medium tabular-nums text-muted">
              <Award className="h-4 w-4" aria-hidden="true" />
              {grantTotals.tagged} {t("grantTaggedLabel")} &middot; {grantTotals.untagged} {t("grantUntaggedLabel")}
            </span>
          }
        >
          {!grantsLoaded ? (
            <div className="flex flex-col gap-4" aria-busy="true">
              {[0, 1, 2].map((i) => (
                <div key={i}>
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="mt-2 h-2 w-full" />
                </div>
              ))}
            </div>
          ) : (
            <BarList
              items={grantBreakdown}
              label={t("grantAttributionTitle")}
              empty={<EmptyState compact icon={Award} title={t("grantAttributionEmptyTitle")} description={t("grantAttributionEmptyHint")} />}
            />
          )}
        </SectionCard>
      </Section>

      {showFoodStats && (
        <Section id="rep-food" title={t("dashSectionFoodDistribution")}>
          <KpiGrid cols={2}>
            <KpiCard icon={FileText} tone="info" value={distInRange.length} label={t("distributionsInRangeLabel")} hint={<TrendDelta trend={distTrendPct} t={t} />} />
            <KpiCard icon={Home} tone="success" value={householdsServedCount} label={t("householdsServedLabel")} hint={<TrendDelta trend={householdsTrendPct} t={t} />} />
          </KpiGrid>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
            <SectionCard className={half} title={t("trendDistributionsPerDay")}>
              <DashChart type="line" title={t("trendDistributionsPerDay")} labels={distTrend.labels} datasets={[{ data: distTrend.data }]} fallback={noData} />
            </SectionCard>
            <SectionCard className={half} title={t("estimatedVolumeTrendTitle")} description={t("estimatedVolumeTrendNote")}>
              <DashChart type="line" title={t("estimatedVolumeTrendTitle")} labels={distVolumeTrend.labels} datasets={[{ data: distVolumeTrend.data }]} fallback={noData} />
            </SectionCard>
          </div>
        </Section>
      )}

      {showJobStats && (
        <Section id="rep-jobs" title={t("reportSectionJobs")}>
          <KpiGrid cols={2}>
            <KpiCard icon={Briefcase} tone="info" value={jobOutcomes.applicationsInRange} label={t("applicationsInRangeLabel")} />
            <KpiCard icon={UserPlus} tone="success" value={jobOutcomes.placementsInRange} label={t("placementsInRangeLabel")} />
          </KpiGrid>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
            <SectionCard className={half} title={t("currentPipelineTitle")} description={t("currentPipelineNote")}>
              <BarList items={pipelineRows} label={t("currentPipelineTitle")} empty={noData} />
            </SectionCard>
            <SectionCard className={half} title={t("applicationsByStatusTitle")}>
              <BarList
                items={statusRows}
                label={t("applicationsByStatusTitle")}
                empty={<EmptyState compact icon={Briefcase} title={t("noApplicationsInRange")} description={t("reportEmptyHint")} />}
              />
            </SectionCard>
            <SectionCard className="lg:col-span-12" title={t("trendApplicationsPerDay")}>
              <DashChart
                type="line"
                title={t("trendApplicationsPerDay")}
                labels={jobOutcomes.applicationsTrend.labels}
                datasets={[{ data: jobOutcomes.applicationsTrend.data }]}
                fallback={noData}
              />
            </SectionCard>
          </div>
        </Section>
      )}

      <Section id="rep-breakdown" title={t("reportSectionBreakdowns")}>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          <SectionCard className={half} title={t("mostRequestedServices")}>
            <BarList items={s.svcSorted.map((x) => ({ label: labelFor(services, x.key, lang), count: x.count }))} label={t("mostRequestedServices")} empty={noData} />
          </SectionCard>
          <SectionCard className={half} title={t("visitsByStaff")}>
            <BarList items={s.staffSorted.map((x) => ({ label: labelFor(staffList, x.key, lang), count: x.count }))} label={t("visitsByStaff")} empty={noData} />
          </SectionCard>
          <SectionCard className={half} title={t("visitsByWeekday")}>
            <DashChart type="bar" title={t("visitsByWeekday")} labels={dayNames} datasets={[{ data: s.dayCounts }]} fallback={noData} />
          </SectionCard>
          <SectionCard className={half} title={t("visitsByHour")}>
            <BarList items={hourTop8.map((x) => ({ label: fmtHour(x.hour), count: x.count }))} label={t("visitsByHour")} tone="violet" empty={noData} />
          </SectionCard>
          <SectionCard className={half} title={t("visitsByCity")}>
            <BarList items={cityTop8.map((x) => ({ label: x.label || t("locationUnknown"), count: x.count }))} label={t("visitsByCity")} empty={noData} />
          </SectionCard>
          <SectionCard className={half} title={t("visitsByZip")}>
            <BarList items={zipTop8.map((x) => ({ label: x.label || t("locationUnknown"), count: x.count }))} label={t("visitsByZip")} empty={noData} />
          </SectionCard>
        </div>
      </Section>
    </div>
  );
}
