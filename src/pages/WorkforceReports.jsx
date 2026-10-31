// WorkforceReports.jsx -- Phase 6 (final phase) of the Employer & Job
// Opportunity Management module. A separate page from the main Reports.jsx,
// same relationship WorkforceDashboard.jsx has to Dashboard.jsx. Every
// number is computed from tables Phases 1-5 already built -- no new
// database table, no new AppContext wiring. Reuses reports_data.js's
// range/trend primitives and DashChart/Sparkline/BarList verbatim; the only
// new reports_data.js additions are computeMonthlyCounts/computeAnnualCounts
// (month/year bucketing) and exportWorkforceCSV/exportWorkforceExcel.
//
// Presentation follows the design system's dashboard template: PageHeader
// with the range SegmentedControl in its actions, a toolbar row (the range
// in words, custom dates, exports), one KpiCard row, then SectionCards on a
// 12-column grid at lg.
//
// Six range-scoped KPIs sit in grid-cols-2 lg:grid-cols-3 (3+3, no orphan).
// Retention rate is not range-scoped and has no period delta, so it moved
// out of the KPI row into the Retention panel, where a meter replaces the
// old two-slice doughnut (a ratio against 100% is a meter, not a pie). The
// three "top N" panels draw BarList directly: it labels every bar, where a
// vertical bar chart thins out long employer names on narrow screens.
//
// The printRef still wraps exactly the report body and the controls card
// still carries no-print, so PDF export and browser print are unchanged.
import { useRef, useState } from "react";
import { loadPdfLibs } from "../lib/pdfLibs.js";
import {
  Award, Briefcase, Building2, Calendar, CalendarClock, CheckCircle2, ChevronDown, Download, FileSpreadsheet, FileText,
  Printer, UserPlus
} from "lucide-react";
import { useApp, useT } from "../context/AppContext.jsx";
import {
  computeAnnualCounts, computeDailyTrend, computeMonthlyCounts, exportWorkforceCSV, exportWorkforceExcel,
  inRange, previousRange, rangeForPreset, trendPct
} from "../lib/reports_data.js";
import { computeRetentionRate } from "../lib/placements.js";
import {
  countInRange, employersAddedItems, hireItems, interviewItems, jobsPostedItems,
  placementItems, referralItems, retentionSplit, topCounts
} from "../lib/workforceMetrics.js";
import { addDays, fmtDateLong, fullIndustryList, todayStr } from "../lib/utils.js";
import BarList from "../components/BarList.jsx";
import DashChart from "../components/DashChart.jsx";
import Sparkline from "../components/Sparkline.jsx";
import { Button } from "../components/ui/button.jsx";
import { EmptyState } from "../components/ui/empty-state.jsx";
import { Select } from "../components/ui/field.jsx";
import { KpiCard } from "../components/ui/kpi-card.jsx";
import { PageHeader } from "../components/ui/page-header.jsx";
import { RangeBar } from "../components/ui/range-bar.jsx";
import { TrendDelta } from "../components/ui/trend-delta.jsx";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../components/ui/dropdown-menu.jsx";
import { SectionCard } from "../components/ui/section-card.jsx";
import WorkforceNav from "../components/WorkforceNav.jsx";

const PRESETS = ["today", "week", "month", "quarter", "year", "custom"];
const PRESET_LABEL_KEY = { today: "today", week: "thisWeek", month: "thisMonth", quarter: "thisQuarter", year: "thisYear", custom: "custom" };

// A ratio against 100% drawn as a meter: one track, one fill, the number and
// its basis spelled out beside it so nothing depends on reading the bar.
function RetentionMeter({ rate, retention, t }) {
  return (
    <div>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="text-kpi text-card-foreground">{rate}%</span>
        <span className="text-ui text-muted">{t("retainedLabel")}</span>
      </div>
      <div
        role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={rate} aria-label={t("retentionRateLabel")}
        className="mt-3 h-3 w-full overflow-hidden rounded-chip bg-surface-sunken"
      >
        <div className="h-full rounded-chip bg-primary" style={{ width: Math.max(0, Math.min(100, rate)) + "%" }} />
      </div>
      <dl className="m-0 mt-4 grid grid-cols-2 gap-3">
        <div>
          <dt className="text-meta text-muted">{t("retainedLabel")}</dt>
          <dd className="m-0 text-section font-semibold tabular-nums text-card-foreground">{retention.retained}</dd>
        </div>
        <div>
          <dt className="text-meta text-muted">{t("notRetainedLabel")}</dt>
          <dd className="m-0 text-section font-semibold tabular-nums text-card-foreground">{retention.notRetained}</dd>
        </div>
      </dl>
      <p className="m-0 mt-3 text-meta text-muted tabular-nums">
        {retention.retained} / {retention.eligible} {t("eligiblePlacementsLabel")}
      </p>
    </div>
  );
}

export default function WorkforceReports() {
  const { data, lang, showToast } = useApp();
  const t = useT();
  const [reportRange, setReportRange] = useState("today");
  const [customFrom, setCustomFrom] = useState(todayStr());
  const [customTo, setCustomTo] = useState(todayStr());
  const range = reportRange === "custom" ? { from: customFrom || todayStr(), to: customTo || todayStr() } : rangeForPreset(reportRange);
  const prevRange = previousRange(range);
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(String(currentYear));
  const printRef = useRef(null);
  const [exportingPdf, setExportingPdf] = useState(false);

  const employers = data.employers || [];
  const jobOpenings = data.jobOpenings || [];
  const referrals = data.referrals || [];
  const placements = data.placements || [];
  const profiles = data.profiles || [];

  const jobsPosted = jobsPostedItems(jobOpenings);
  const placementsSeries = placementItems(placements);
  const employersAdded = employersAddedItems(employers);
  const referralsSeries = referralItems(referrals);
  const interviews = interviewItems(referrals);
  const hires = hireItems(referrals);

  function kpiFor(items) {
    const cur = countInRange(items, range);
    const prev = countInRange(items, prevRange);
    return { value: cur, trend: trendPct(cur, prev) };
  }
  const jobsPostedKpi = kpiFor(jobsPosted);
  const placementsKpi = kpiFor(placementsSeries);
  const employersAddedKpi = kpiFor(employersAdded);
  const referralsKpi = kpiFor(referralsSeries);
  const interviewsKpi = kpiFor(interviews);
  const hiresKpi = kpiFor(hires);
  const retentionRate = computeRetentionRate(placements);

  const jobsPostedTrend = computeDailyTrend(jobsPosted, range);
  const placementsTrend = computeDailyTrend(placementsSeries, range);
  const employersAddedTrend = computeDailyTrend(employersAdded, range);
  const referralsTrend = computeDailyTrend(referralsSeries, range);
  const interviewsTrend = computeDailyTrend(interviews, range);
  const hiresTrend = computeDailyTrend(hires, range);

  const cutoff90 = addDays(todayStr(), -90);
  const retention = retentionSplit(placements, cutoff90);

  const placementsInRange = placements.filter(function (p) { return inRange({ date: p.startDate }, range.from, range.to); });
  const topHiringEmployers = topCounts(placementsInRange, function (p) { return p.employerName; }, 8);

  const employerById = {};
  employers.forEach(function (e) { employerById[e.id] = e; });
  const industryList = fullIndustryList(data.customIndustries);
  function industryLabelFor(key) { const found = industryList.find(function (i) { return i.key === key; }); return found ? found.en : key; }
  const topIndustries = topCounts(placementsInRange, function (p) {
    const emp = employerById[p.employerId];
    return emp && emp.industry ? industryLabelFor(emp.industry) : "";
  }, 8);

  const referralsInRange = referrals.filter(function (r) { return inRange({ date: r.referralDate }, range.from, range.to); });
  const profileByEmail = {};
  profiles.forEach(function (p) { if (p.email) profileByEmail[p.email] = p; });
  const topJobDevelopers = topCounts(
    referralsInRange.filter(function (r) { return r.status === "hired"; }),
    function (r) {
      if (!r.assignedJobDeveloperEmail) return "";
      return (profileByEmail[r.assignedJobDeveloperEmail] && profileByEmail[r.assignedJobDeveloperEmail].name) || r.assignedJobDeveloperEmail;
    },
    8
  );

  const yearOptions = Array.from(new Set(placements.map((p) => (p.startDate || "").slice(0, 4)).filter(Boolean).concat([String(currentYear)]))).sort();
  const monthlyPlacements = computeMonthlyCounts(placementsSeries, selectedYear);
  const annualPlacements = computeAnnualCounts(placementsSeries, currentYear - 4, currentYear);

  function handleExportCSV() { exportWorkforceCSV(placements, range); showToast(t("exportCSV") + " ✓"); }
  function handleExportExcel() { exportWorkforceExcel(placements, range); showToast(t("exportExcel") + " ✓"); }

  async function handleExportPdf() {
    const source = printRef.current;
    if (!source) return;
    setExportingPdf(true);
    try {
      const { html2canvas, jsPDF } = await loadPdfLibs();
      const bg = getComputedStyle(document.body).getPropertyValue("--bg").trim() || "#ffffff";
      const canvas = await html2canvas(source, { scale: 2, backgroundColor: bg, useCORS: true });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({ unit: "pt", format: "a4" });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = pageWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;
      pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }
      pdf.save("Workforce Report - " + todayStr() + ".pdf");
    } catch (err) {
      console.warn("exportAsPdf failed", err);
    } finally {
      setExportingPdf(false);
    }
  }

  const rangeOptions = PRESETS.map(function (p) { return { value: p, label: t(PRESET_LABEL_KEY[p]) }; });
  const emptyForRange = <EmptyState compact title={t("noReportDataMessage")} description={t("wfReportsEmptyRangeHint")} />;

  function trendPanel(title, trend) {
    return (
      <SectionCard title={title} className="lg:col-span-6">
        <DashChart type="line" labels={trend.labels} datasets={[{ data: trend.data, fill: true, tension: 0.3 }]} fallback={<Sparkline labels={trend.labels} data={trend.data} />} />
      </SectionCard>
    );
  }

  return (
    <>
      <WorkforceNav value="workforcereports" />
      <PageHeader
        title={t("workforceReportsTitle")}
        description={t("workforceReportsDesc")}
        meta={
          <span className="inline-flex items-center gap-1.5 text-meta font-medium tabular-nums text-card-foreground">
            <Calendar className="h-4 w-4 text-muted" aria-hidden="true" />
            {fmtDateLong(range.from, lang)} &ndash; {fmtDateLong(range.to, lang)}
          </span>
        }
        actions={
          <div className="no-print flex flex-wrap items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="secondary" loading={exportingPdf}>
                  {exportingPdf ? null : <Download className="h-4 w-4" aria-hidden="true" />}{t("exportLabel")}<ChevronDown className="h-4 w-4 text-muted" aria-hidden="true" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleExportCSV}><FileText className="h-4 w-4 text-muted" aria-hidden="true" />{t("exportCSV")}</DropdownMenuItem>
                <DropdownMenuItem onClick={handleExportExcel}><FileSpreadsheet className="h-4 w-4 text-muted" aria-hidden="true" />{t("exportExcel")}</DropdownMenuItem>
                <DropdownMenuItem onClick={handleExportPdf}><Download className="h-4 w-4 text-muted" aria-hidden="true" />{t("exportPdf")}</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="secondary" onClick={function () { window.print(); }}>
              <Printer className="h-4 w-4" aria-hidden="true" />{t("printPdf")}
            </Button>
          </div>
        }
      />

      <RangeBar
        idBase="wfrep"
        label={t("dateRangeLabel")}
        value={reportRange}
        onChange={setReportRange}
        options={rangeOptions}
        custom={{ from: customFrom, to: customTo, onFrom: setCustomFrom, onTo: setCustomTo, fromLabel: t("filterDateFrom"), toLabel: t("filterDateTo") }}
      />

      <div ref={printRef} className="flex flex-col gap-6">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
          <KpiCard icon={Briefcase} tone="info" value={jobsPostedKpi.value} label={t("statJobsPostedLabel")} hint={<TrendDelta trend={jobsPostedKpi.trend} t={t} />} />
          <KpiCard icon={CheckCircle2} tone="success" value={placementsKpi.value} label={t("placementsTitle")} hint={<TrendDelta trend={placementsKpi.trend} t={t} />} />
          <KpiCard icon={Building2} tone="neutral" value={employersAddedKpi.value} label={t("statEmployersAddedLabel")} hint={<TrendDelta trend={employersAddedKpi.trend} t={t} />} />
          <KpiCard icon={UserPlus} tone="info" value={referralsKpi.value} label={t("referralsLabel")} hint={<TrendDelta trend={referralsKpi.trend} t={t} />} />
          <KpiCard icon={CalendarClock} tone="violet" value={interviewsKpi.value} label={t("statInterviewsLabel")} hint={<TrendDelta trend={interviewsKpi.trend} t={t} />} />
          <KpiCard icon={Award} tone="success" value={hiresKpi.value} label={t("totalHiresLabel")} hint={<TrendDelta trend={hiresKpi.trend} t={t} />} />
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {trendPanel(t("statJobsPostedLabel"), jobsPostedTrend)}
          {trendPanel(t("placementsTitle"), placementsTrend)}
          {trendPanel(t("statEmployersAddedLabel"), employersAddedTrend)}
          {trendPanel(t("referralsLabel"), referralsTrend)}
          {trendPanel(t("statInterviewsLabel"), interviewsTrend)}
          {trendPanel(t("totalHiresLabel"), hiresTrend)}

          <SectionCard title={t("retentionRateLabel")} description={t("wfRetentionBasisHint")} className="lg:col-span-5">
            {retention.eligible === 0 || retentionRate === null ? (
              <EmptyState compact title={t("noReportDataMessage")} description={t("wfRetentionEmptyHint")} />
            ) : (
              <RetentionMeter rate={retentionRate} retention={retention} t={t} />
            )}
          </SectionCard>

          <SectionCard title={t("mostSuccessfulJobDevelopersLabel")} className="lg:col-span-7">
            {topJobDevelopers.length === 0 ? emptyForRange : <BarList items={topJobDevelopers} />}
          </SectionCard>

          <SectionCard title={t("topHiringEmployersLabel")} className="lg:col-span-6">
            {topHiringEmployers.length === 0 ? emptyForRange : <BarList items={topHiringEmployers} />}
          </SectionCard>
          <SectionCard title={t("topIndustriesLabel")} className="lg:col-span-6">
            {topIndustries.length === 0 ? emptyForRange : <BarList items={topIndustries} />}
          </SectionCard>

          <SectionCard
            title={t("monthlyPlacementsLabel")}
            className="lg:col-span-6"
            action={
              <div className="flex items-center gap-2">
                <label htmlFor="wfrep-year" className="text-meta font-semibold text-card-foreground">{t("selectYearLabel")}</label>
                <Select id="wfrep-year" value={selectedYear} onChange={function (e) { setSelectedYear(e.target.value); }} className="h-8 w-auto tabular-nums">
                  {yearOptions.map(function (y) { return <option key={y} value={y}>{y}</option>; })}
                </Select>
              </div>
            }
          >
            <DashChart type="bar" labels={monthlyPlacements.labels} datasets={[{ data: monthlyPlacements.data }]} fallback={<BarList items={monthlyPlacements.labels.map((l, i) => ({ label: l, count: monthlyPlacements.data[i] }))} />} />
          </SectionCard>
          <SectionCard title={t("annualPlacementsLabel")} className="lg:col-span-6">
            <DashChart type="bar" labels={annualPlacements.labels} datasets={[{ data: annualPlacements.data }]} fallback={<BarList items={annualPlacements.labels.map((l, i) => ({ label: l, count: annualPlacements.data[i] }))} />} />
          </SectionCard>
        </div>
      </div>
    </>
  );
}
