// Reports.jsx -- Tailwind/shadcn redesign pass (same idiom as
// CaseManagement.jsx/Students.jsx/Dashboard.jsx). All the underlying data
// (range presets, stats, trends, exports) is unchanged from the original
// port of reports_view.js -- only the presentation layer changed, plus two
// new reports_data.js helpers (previousRange/trendPct/computeMostActiveDay)
// to drive the KPI cards' "vs previous period" badges and the new "Most
// Active Day"/"Peak Visit Time" card, both taken from the requested design.
import { useEffect, useState } from "react";
import {
  Award, Briefcase, Calendar, Clock, FileSpreadsheet, FileText, GraduationCap, Home,
  Printer, Repeat, TrendingDown, TrendingUp, UserPlus, Users
} from "lucide-react";
import { useApp, useT } from "../context/AppContext.jsx";
import { WEEKDAYS } from "../lib/constants.js";
import { navItemsForRole } from "../lib/nav.js";
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
import DatePicker from "../components/DatePicker.jsx";
import Sparkline from "../components/Sparkline.jsx";
import { Button } from "../components/ui/button.jsx";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card.jsx";

const PRESETS = ["today", "week", "month", "quarter", "year", "custom"];
const PRESET_LABEL_KEY = { today: "today", week: "thisWeek", month: "thisMonth", quarter: "thisQuarter", year: "thisYear", custom: "custom" };

function TrendBadge({ pct, none, t }) {
  if (none) return <span className="text-xs font-medium text-muted">{t("noChangeVsPreviousPeriod")}</span>;
  const up = pct >= 0;
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs font-semibold", up ? "text-success" : "text-accent")}>
      {up ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
      {up ? "+" : ""}{pct}%
      <span className="font-medium text-muted">{t("vsPreviousPeriod")}</span>
    </span>
  );
}

function KpiCard({ icon: Icon, tint, iconColor, value, label, pct, none, t }) {
  return (
    <Card>
      <CardContent className="flex items-start gap-3 p-5">
        <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl", tint)}>
          <Icon className={cn("h-5 w-5", iconColor)} strokeWidth={2} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-2xl font-extrabold tracking-tight text-card-foreground">{value}</div>
          <div className="mt-0.5 truncate text-sm font-semibold text-muted">{label}</div>
          <div className="mt-2"><TrendBadge pct={pct} none={none} t={t} /></div>
        </div>
      </CardContent>
    </Card>
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
    })();
    return () => { cancelled = true; };
  }, [visitIdsKey, range.from, range.to]);

  // Food Distribution is Administrator/Staff only -- only show its numbers
  // here to roles that actually have that nav item, same gate as the nav.
  const role = session ? session.role : null;
  const showFoodStats = navItemsForRole(role).indexOf("fooddistribution") !== -1;

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
  const showJobStats = navItemsForRole(role).indexOf("jobdeveloper") !== -1;
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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="m-0 text-2xl font-extrabold tracking-tight text-card-foreground">{t("reportsTitle")}</h1>
          <p className="mt-1 text-sm text-muted">{t("reportsSubtitle")}</p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-semibold text-card-foreground shadow-card">
          <Calendar className="h-4 w-4 text-primary" />
          {range.from} &ndash; {range.to}
        </div>
      </div>

      <Card className="no-print">
        <CardContent className="p-5">
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <button
                key={p}
                onClick={() => setReportRange(p)}
                className={cn(
                  "rounded-full px-4 py-2 text-sm font-semibold transition-colors",
                  reportRange === p ? "bg-primary text-primary-foreground" : "bg-background text-muted hover:bg-primary-tint hover:text-primary"
                )}
              >
                {t(PRESET_LABEL_KEY[p])}
              </button>
            ))}
          </div>
          {reportRange === "custom" && (
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="rep-from" className="mb-1 block text-xs font-semibold text-muted">{t("filterDateFrom")}</label>
                <DatePicker id="rep-from" value={customFrom} onChange={setCustomFrom} />
              </div>
              <div>
                <label htmlFor="rep-to" className="mb-1 block text-xs font-semibold text-muted">{t("filterDateTo")}</label>
                <DatePicker id="rep-to" value={customTo} onChange={setCustomTo} />
              </div>
            </div>
          )}
          <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-4">
            <Button variant="secondary" onClick={handleExportCSV}>
              <FileText className="h-4 w-4 text-primary" /> {t("exportCSV")}
            </Button>
            <Button variant="secondary" onClick={handleExportExcel}>
              <FileSpreadsheet className="h-4 w-4 text-success" /> {t("exportExcel")}
            </Button>
            <Button variant="secondary" onClick={() => window.print()}>
              <Printer className="h-4 w-4 text-accent" /> {t("printPdf")}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard icon={Users} tint="bg-primary-tint" iconColor="text-primary" value={s.inRangeVisits.length} label={t("numVisitors")} pct={visitorsTrend.pct} none={visitorsTrend.none} t={t} />
        <KpiCard icon={UserPlus} tint="bg-tint-success" iconColor="text-success" value={s.newCount} label={t("firstTime")} pct={firstTimeTrend.pct} none={firstTimeTrend.none} t={t} />
        <KpiCard icon={Repeat} tint="bg-gold-tint" iconColor="text-gold-dark" value={s.returningCount} label={t("repeatVisitors")} pct={repeatTrend.pct} none={repeatTrend.none} t={t} />
        <KpiCard icon={Clock} tint="bg-tint-warn" iconColor="text-warn" value={fmtDuration(s.avgLen, lang)} label={t("avgVisitLength")} pct={avgLenTrend.pct} none={avgLenTrend.none} t={t} />
      </div>

      {/* Flat NRS/grant-reporting credit for the currently selected range --
          4 hours per completed student check-in, see reports_data.js. Also
          included as a summary line above the CSV/Excel export table. */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard icon={GraduationCap} tint="bg-primary-tint" iconColor="text-primary" value={s.studentHours} label={t("studentInstructionalHoursLabel")} pct={studentHoursTrend.pct} none={studentHoursTrend.none} t={t} />
      </div>

      <Card>
        <CardHeader><CardTitle>{t("trendVisitsPerDay")}</CardTitle></CardHeader>
        <CardContent className="pt-0">
          <DashChart
            type="line"
            labels={trend.labels}
            datasets={[{ data: trend.data, fill: true, tension: 0.3 }]}
            fallback={<Sparkline labels={trend.labels} data={trend.data} />}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
          <CardTitle>Grant Attribution</CardTitle>
          <div className="flex items-center gap-1.5 text-sm font-semibold text-muted">
            <Award className="h-4 w-4 text-primary" />
            {grantTotals.tagged} tagged &middot; {grantTotals.untagged} untagged
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {grantBreakdown.length ? (
            <DashChart
              type="bar"
              labels={grantBreakdown.map((x) => x.label)}
              datasets={[{ data: grantBreakdown.map((x) => x.count) }]}
              fallback={<BarList items={grantBreakdown} />}
            />
          ) : (
            <p className="text-sm text-muted">No services in this range are tagged to a grant yet. Tag visits from Search and case notes from Case Management to see a breakdown here.</p>
          )}
        </CardContent>
      </Card>

      {showFoodStats && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard icon={FileText} tint="bg-gold-tint" iconColor="text-gold-dark" value={distInRange.length} label={t("distributionsInRangeLabel")} pct={distTrendPct.pct} none={distTrendPct.none} t={t} />
            <KpiCard icon={Home} tint="bg-tint-success" iconColor="text-success" value={householdsServedCount} label={t("householdsServedLabel")} pct={householdsTrendPct.pct} none={householdsTrendPct.none} t={t} />
            <Card className="sm:col-span-2 lg:col-span-2">
              <CardContent className="grid h-full grid-cols-2 gap-4 p-5">
                <div>
                  <div className="text-xs font-semibold text-muted">{t("mostActiveDayLabel")}</div>
                  <div className="mt-1 text-xl font-extrabold text-card-foreground">
                    {mostActiveDay ? dayNames[new Date(mostActiveDay.date + "T00:00:00").getDay()] : "–"}
                  </div>
                  {mostActiveDay && (
                    <div className="mt-1 flex items-center gap-1 text-xs text-muted">
                      <Calendar className="h-3.5 w-3.5" /> {mostActiveDay.date}
                    </div>
                  )}
                </div>
                <div>
                  <div className="text-xs font-semibold text-muted">{t("peakVisitTimeLabel")}</div>
                  <div className="mt-1 text-xl font-extrabold text-card-foreground">
                    {peakHour ? fmtHour(peakHour.hour) : "–"}
                  </div>
                  {peakHour && (
                    <div className="mt-1 flex items-center gap-1 text-xs text-muted">
                      <Users className="h-3.5 w-3.5" /> {peakHour.count} {t("visitorsSuffix")}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle>{t("trendDistributionsPerDay")}</CardTitle></CardHeader>
              <CardContent className="pt-0">
                <DashChart
                  type="line"
                  labels={distTrend.labels}
                  datasets={[{ data: distTrend.data, fill: true, tension: 0.3 }]}
                  fallback={<Sparkline labels={distTrend.labels} data={distTrend.data} />}
                />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>{t("estimatedVolumeTrendTitle")}</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="mb-2 text-xs text-muted">{t("estimatedVolumeTrendNote")}</p>
                <DashChart
                  type="line"
                  labels={distVolumeTrend.labels}
                  datasets={[{ data: distVolumeTrend.data, fill: true, tension: 0.3 }]}
                  fallback={<Sparkline labels={distVolumeTrend.labels} data={distVolumeTrend.data} />}
                />
              </CardContent>
            </Card>
          </div>
        </>
      )}

      {showJobStats && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard icon={Briefcase} tint="bg-primary-tint" iconColor="text-primary" value={jobOutcomes.applicationsInRange} label={t("applicationsInRangeLabel")} pct={0} none t={t} />
            <KpiCard icon={UserPlus} tint="bg-tint-success" iconColor="text-success" value={jobOutcomes.placementsInRange} label={t("placementsInRangeLabel")} pct={0} none t={t} />
          </div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle>{t("currentPipelineTitle")}</CardTitle></CardHeader>
              <CardContent className="pt-0">
                <p className="mb-2 text-xs text-muted">{t("currentPipelineNote")}</p>
                <DashChart
                  type="bar"
                  labels={pipelineRows.map((x) => x.label)}
                  datasets={[{ data: pipelineRows.map((x) => x.count) }]}
                  fallback={<BarList items={pipelineRows} />}
                />
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>{t("applicationsByStatusTitle")}</CardTitle></CardHeader>
              <CardContent className="pt-0">
                {statusRows.length ? (
                  <DashChart
                    type="bar"
                    labels={statusRows.map((x) => x.label)}
                    datasets={[{ data: statusRows.map((x) => x.count) }]}
                    fallback={<BarList items={statusRows} />}
                  />
                ) : (
                  <p className="py-8 text-center text-sm text-muted">{t("noApplicationsInRange")}</p>
                )}
              </CardContent>
            </Card>
          </div>
          <Card>
            <CardHeader><CardTitle>{t("trendApplicationsPerDay")}</CardTitle></CardHeader>
            <CardContent className="pt-0">
              <DashChart
                type="line"
                labels={jobOutcomes.applicationsTrend.labels}
                datasets={[{ data: jobOutcomes.applicationsTrend.data, fill: true, tension: 0.3 }]}
                fallback={<Sparkline labels={jobOutcomes.applicationsTrend.labels} data={jobOutcomes.applicationsTrend.data} />}
              />
            </CardContent>
          </Card>
        </>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>{t("mostRequestedServices")}</CardTitle></CardHeader>
          <CardContent className="pt-0">
            <DashChart
              type="bar"
              labels={s.svcSorted.map((x) => labelFor(services, x.key, lang))}
              datasets={[{ data: s.svcSorted.map((x) => x.count) }]}
              fallback={<BarList items={s.svcSorted.map((x) => ({ label: labelFor(services, x.key, lang), count: x.count }))} />}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>{t("visitsByStaff")}</CardTitle></CardHeader>
          <CardContent className="pt-0">
            <DashChart
              type="bar"
              labels={s.staffSorted.map((x) => labelFor(staffList, x.key, lang))}
              datasets={[{ data: s.staffSorted.map((x) => x.count) }]}
              fallback={<BarList items={s.staffSorted.map((x) => ({ label: labelFor(staffList, x.key, lang), count: x.count }))} />}
            />
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>{t("visitsByWeekday")}</CardTitle></CardHeader>
          <CardContent className="pt-0">
            <DashChart
              type="bar"
              labels={dayNames}
              datasets={[{ data: s.dayCounts }]}
              fallback={<BarList items={s.dayCounts.map((c, i) => ({ label: dayNames[i], count: c }))} />}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>{t("visitsByHour")}</CardTitle></CardHeader>
          <CardContent className="pt-0">
            <DashChart
              type="bar"
              labels={hourTop8.map((x) => fmtHour(x.hour))}
              datasets={[{ data: hourTop8.map((x) => x.count) }]}
              fallback={<BarList items={hourTop8.map((x) => ({ label: fmtHour(x.hour), count: x.count }))} />}
            />
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>{t("visitsByCity")}</CardTitle></CardHeader>
          <CardContent className="pt-0">
            <DashChart
              type="bar"
              labels={cityTop8.map((x) => x.label || t("locationUnknown"))}
              datasets={[{ data: cityTop8.map((x) => x.count) }]}
              fallback={<BarList items={cityTop8.map((x) => ({ label: x.label || t("locationUnknown"), count: x.count }))} />}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>{t("visitsByZip")}</CardTitle></CardHeader>
          <CardContent className="pt-0">
            <DashChart
              type="bar"
              labels={zipTop8.map((x) => x.label || t("locationUnknown"))}
              datasets={[{ data: zipTop8.map((x) => x.count) }]}
              fallback={<BarList items={zipTop8.map((x) => ({ label: x.label || t("locationUnknown"), count: x.count }))} />}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
