// WorkforceReports.jsx -- Phase 6 (final phase) of the Employer & Job
// Opportunity Management module. A separate page from the main Reports.jsx,
// same relationship WorkforceDashboard.jsx has to Dashboard.jsx. Every
// number is computed from tables Phases 1-5 already built -- no new
// database table, no new AppContext wiring. Reuses reports_data.js's
// range/trend primitives and DashChart/Sparkline/BarList verbatim; the only
// new reports_data.js additions are computeMonthlyCounts/computeAnnualCounts
// (month/year bucketing) and exportWorkforceCSV/exportWorkforceExcel.
//
// Presentation matches the rest of the module. This page has no result set,
// so it gets no filter panel and no list/grid toggle -- what it has instead
// is the date range, which scopes every number on the page, so that is the
// control that took the module's treatment: the round pills became a
// segmented control in the same idiom as ResultsToolbar's view toggle
// (pills were the one thing the redesign brief asked us to avoid), sitting
// in a panel card rather than floating. Every chart is now a
// components/SectionCard.jsx, shared with WorkforceDashboard.jsx, and the
// six hand-rolled "no data" paragraphs became one SectionEmpty.
//
// The printRef still wraps exactly the report body and the controls card
// still carries no-print, so PDF export and browser print are unchanged.
import { useRef, useState } from "react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import {
  Award, Briefcase, Building2, Calendar, CalendarClock, CheckCircle2, Download, FileSpreadsheet, FileText,
  Percent, Printer, TrendingDown, TrendingUp, UserPlus
} from "lucide-react";
import { useApp, useT } from "../context/AppContext.jsx";
import {
  computeAnnualCounts, computeDailyTrend, computeMonthlyCounts, exportWorkforceCSV, exportWorkforceExcel,
  inRange, previousRange, rangeForPreset, trendPct
} from "../lib/reports_data.js";
import { computeRetentionRate } from "../lib/placements.js";
import { cn } from "../lib/cn.js";
import { addDays, fmtDateLong, fullIndustryList, todayStr } from "../lib/utils.js";
import BarList from "../components/BarList.jsx";
import DashChart from "../components/DashChart.jsx";
import DatePicker from "../components/DatePicker.jsx";
import Sparkline from "../components/Sparkline.jsx";
import { SectionCard, SectionEmpty } from "../components/SectionCard.jsx";
import { Button } from "../components/ui/button.jsx";
import { Card } from "../components/ui/card.jsx";

// main.css styles the bare `button` tag app-wide (min-height:52px, 20px
// padding, 2px border) plus a 1px hover lift, so every button built here has
// to cancel it -- same reset ModuleNav.jsx and ResultsToolbar.jsx carry.
const BTN_RESET = "min-h-0 border-0 bg-transparent p-0 font-normal transform-none";

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
    <Card className="flex items-start gap-3 p-5 shadow-card hover:shadow-card">
      <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px]", tint)}>
        <Icon className={cn("h-5 w-5", iconColor)} strokeWidth={2} aria-hidden="true" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-2xl font-extrabold tracking-tight text-card-foreground">{value}</div>
        <div className="mt-0.5 truncate text-sm font-semibold text-muted">{label}</div>
        {pct !== undefined && <div className="mt-2"><TrendBadge pct={pct} none={none} t={t} /></div>}
      </div>
    </Card>
  );
}

function countInRange(items, r) { return items.filter((i) => i.date && inRange(i, r.from, r.to)).length; }

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

  const jobsPostedItems = jobOpenings.map((o) => ({ date: o.postedDate }));
  const placementsItems = placements.map((p) => ({ date: p.startDate }));
  const employersAddedItems = employers.map((e) => ({ date: (e.createdAt || "").slice(0, 10) }));
  const referralsItems = referrals.map((r) => ({ date: r.referralDate }));
  const interviewsItems = referrals.filter((r) => r.interviewDate).map((r) => ({ date: r.interviewDate }));
  // Hires -- there's no dedicated stage-change log, so "when it became
  // Hired" is only knowable as "last time this referral row was touched."
  // Disclosed approximation, kept deliberately distinct from the Placements
  // chart (actual tracked-placement records, which can lag behind a hire).
  const hiresItems = referrals.filter((r) => r.status === "hired").map((r) => ({ date: (r.updatedAt || "").slice(0, 10) }));

  function kpiFor(items) {
    const cur = countInRange(items, range);
    const prev = countInRange(items, prevRange);
    return { value: cur, trend: trendPct(cur, prev) };
  }
  const jobsPostedKpi = kpiFor(jobsPostedItems);
  const placementsKpi = kpiFor(placementsItems);
  const employersAddedKpi = kpiFor(employersAddedItems);
  const referralsKpi = kpiFor(referralsItems);
  const interviewsKpi = kpiFor(interviewsItems);
  const hiresKpi = kpiFor(hiresItems);
  const retentionRate = computeRetentionRate(placements);

  const jobsPostedTrend = computeDailyTrend(jobsPostedItems, range);
  const placementsTrend = computeDailyTrend(placementsItems, range);
  const employersAddedTrend = computeDailyTrend(employersAddedItems, range);
  const referralsTrend = computeDailyTrend(referralsItems, range);
  const interviewsTrend = computeDailyTrend(interviewsItems, range);
  const hiresTrend = computeDailyTrend(hiresItems, range);

  const cutoff90 = addDays(todayStr(), -90);
  const eligiblePlacements = placements.filter((p) => p.startDate && p.startDate <= cutoff90);
  const retainedCount = eligiblePlacements.filter((p) => p.currentStatus === "active").length;
  const notRetainedCount = eligiblePlacements.length - retainedCount;

  const placementsInRange = placements.filter((p) => inRange({ date: p.startDate }, range.from, range.to));
  const employerCounts = {};
  placementsInRange.forEach((p) => { if (p.employerName) employerCounts[p.employerName] = (employerCounts[p.employerName] || 0) + 1; });
  const topHiringEmployers = Object.entries(employerCounts).map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count).slice(0, 8);

  const employerById = {};
  employers.forEach((e) => { employerById[e.id] = e; });
  const industryList = fullIndustryList(data.customIndustries);
  function industryLabelFor(key) { const found = industryList.find((i) => i.key === key); return found ? found.en : key; }
  const industryCounts = {};
  placementsInRange.forEach((p) => {
    const emp = employerById[p.employerId];
    if (!emp || !emp.industry) return;
    var label = industryLabelFor(emp.industry);
    industryCounts[label] = (industryCounts[label] || 0) + 1;
  });
  const topIndustries = Object.entries(industryCounts).map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count).slice(0, 8);

  const referralsInRange = referrals.filter((r) => inRange({ date: r.referralDate }, range.from, range.to));
  const profileByEmail = {};
  profiles.forEach((p) => { if (p.email) profileByEmail[p.email] = p; });
  const devCounts = {};
  referralsInRange.filter((r) => r.status === "hired").forEach((r) => {
    if (!r.assignedJobDeveloperEmail) return;
    var label = (profileByEmail[r.assignedJobDeveloperEmail] && profileByEmail[r.assignedJobDeveloperEmail].name) || r.assignedJobDeveloperEmail;
    devCounts[label] = (devCounts[label] || 0) + 1;
  });
  const topJobDevelopers = Object.entries(devCounts).map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count).slice(0, 8);

  const yearOptions = Array.from(new Set(placements.map((p) => (p.startDate || "").slice(0, 4)).filter(Boolean).concat([String(currentYear)]))).sort();
  const monthlyPlacements = computeMonthlyCounts(placementsItems, selectedYear);
  const annualPlacements = computeAnnualCounts(placementsItems, currentYear - 4, currentYear);

  function handleExportCSV() { exportWorkforceCSV(placements, range); showToast(t("exportCSV") + " ✓"); }
  function handleExportExcel() { exportWorkforceExcel(placements, range); showToast(t("exportExcel") + " ✓"); }

  async function handleExportPdf() {
    const source = printRef.current;
    if (!source) return;
    setExportingPdf(true);
    try {
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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="m-0 text-2xl font-extrabold tracking-tight text-card-foreground">{t("workforceReportsTitle")}</h1>
          <p className="mt-1 text-sm text-muted">{t("workforceReportsDesc")}</p>
        </div>
        {/* The range the whole page is scoped to, spelled the way every
            other date in the app is spelled rather than as raw ISO. */}
        <div className="inline-flex items-center gap-2 rounded-[12px] border border-border bg-card px-4 py-3 text-sm font-semibold text-card-foreground shadow-card">
          <Calendar className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
          {fmtDateLong(range.from, lang)} &ndash; {fmtDateLong(range.to, lang)}
        </div>
      </div>

      {/* main.css styles the bare `button` tag app-wide, so the segmented
          range control cancels it via BTN_RESET the same way ModuleNav and
          ResultsToolbar do. */}
      <Card className="no-print p-5 shadow-card hover:shadow-card sm:p-6">
        <span className="mb-3 block text-[15px] font-bold text-card-foreground">{t("dateRangeLabel")}</span>
        <div className="flex flex-wrap items-center gap-1 rounded-[12px] border border-border p-1">
          {PRESETS.map(function (p) {
            return (
              <button
                key={p}
                type="button"
                onClick={function () { setReportRange(p); }}
                aria-pressed={reportRange === p}
                className={cn(
                  BTN_RESET,
                  "rounded-[10px] px-4 py-2 text-sm font-semibold transition-colors",
                  reportRange === p ? "bg-primary-tint text-primary" : "text-muted hover:bg-background"
                )}
              >
                {t(PRESET_LABEL_KEY[p])}
              </button>
            );
          })}
        </div>

        {reportRange === "custom" && (
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="wfrep-from" className="mb-1 block text-xs font-semibold text-muted">{t("filterDateFrom")}</label>
              <DatePicker id="wfrep-from" value={customFrom} onChange={setCustomFrom} />
            </div>
            <div>
              <label htmlFor="wfrep-to" className="mb-1 block text-xs font-semibold text-muted">{t("filterDateTo")}</label>
              <DatePicker id="wfrep-to" value={customTo} onChange={setCustomTo} />
            </div>
          </div>
        )}

        <div className="mt-5 flex flex-wrap gap-2 border-t border-border pt-4">
          <Button variant="secondary" onClick={handleExportCSV} className="h-10 gap-2 rounded-[10px] px-4 text-sm">
            <FileText className="h-4 w-4 text-primary" aria-hidden="true" /> {t("exportCSV")}
          </Button>
          <Button variant="secondary" onClick={handleExportExcel} className="h-10 gap-2 rounded-[10px] px-4 text-sm">
            <FileSpreadsheet className="h-4 w-4 text-success" aria-hidden="true" /> {t("exportExcel")}
          </Button>
          <Button variant="secondary" disabled={exportingPdf} onClick={handleExportPdf} className="h-10 gap-2 rounded-[10px] px-4 text-sm">
            <Download className="h-4 w-4 text-accent" aria-hidden="true" /> {exportingPdf ? "…" : t("exportPdf")}
          </Button>
          <Button variant="secondary" onClick={function () { window.print(); }} className="h-10 gap-2 rounded-[10px] px-4 text-sm">
            <Printer className="h-4 w-4 text-accent" aria-hidden="true" /> {t("printPdf")}
          </Button>
        </div>
      </Card>

      <div ref={printRef} className="space-y-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard icon={Briefcase} tint="bg-primary-tint" iconColor="text-primary" value={jobsPostedKpi.value} label={t("statJobsPostedLabel")} pct={jobsPostedKpi.trend.pct} none={jobsPostedKpi.trend.none} t={t} />
          <KpiCard icon={CheckCircle2} tint="bg-tint-success" iconColor="text-success" value={placementsKpi.value} label={t("placementsTitle")} pct={placementsKpi.trend.pct} none={placementsKpi.trend.none} t={t} />
          <KpiCard icon={Building2} tint="bg-gold-tint" iconColor="text-gold-dark" value={employersAddedKpi.value} label={t("statEmployersAddedLabel")} pct={employersAddedKpi.trend.pct} none={employersAddedKpi.trend.none} t={t} />
          <KpiCard icon={UserPlus} tint="bg-tint-warn" iconColor="text-gold-ink" value={referralsKpi.value} label={t("referralsLabel")} pct={referralsKpi.trend.pct} none={referralsKpi.trend.none} t={t} />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard icon={CalendarClock} tint="bg-primary-tint" iconColor="text-primary" value={interviewsKpi.value} label={t("statInterviewsLabel")} pct={interviewsKpi.trend.pct} none={interviewsKpi.trend.none} t={t} />
          <KpiCard icon={Award} tint="bg-tint-success" iconColor="text-success" value={hiresKpi.value} label={t("totalHiresLabel")} pct={hiresKpi.trend.pct} none={hiresKpi.trend.none} t={t} />
          <KpiCard icon={Percent} tint="bg-gold-tint" iconColor="text-gold-dark" value={retentionRate === null ? "—" : retentionRate + "%"} label={t("retentionRateLabel")} t={t} />
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <SectionCard title={t("statJobsPostedLabel")}>
              <DashChart type="line" labels={jobsPostedTrend.labels} datasets={[{ data: jobsPostedTrend.data, fill: true, tension: 0.3 }]} fallback={<Sparkline labels={jobsPostedTrend.labels} data={jobsPostedTrend.data} />} />
            </SectionCard>
          <SectionCard title={t("placementsTitle")}>
              <DashChart type="line" labels={placementsTrend.labels} datasets={[{ data: placementsTrend.data, fill: true, tension: 0.3 }]} fallback={<Sparkline labels={placementsTrend.labels} data={placementsTrend.data} />} />
            </SectionCard>
          <SectionCard title={t("statEmployersAddedLabel")}>
              <DashChart type="line" labels={employersAddedTrend.labels} datasets={[{ data: employersAddedTrend.data, fill: true, tension: 0.3 }]} fallback={<Sparkline labels={employersAddedTrend.labels} data={employersAddedTrend.data} />} />
            </SectionCard>
          <SectionCard title={t("referralsLabel")}>
              <DashChart type="line" labels={referralsTrend.labels} datasets={[{ data: referralsTrend.data, fill: true, tension: 0.3 }]} fallback={<Sparkline labels={referralsTrend.labels} data={referralsTrend.data} />} />
            </SectionCard>
          <SectionCard title={t("statInterviewsLabel")}>
              <DashChart type="line" labels={interviewsTrend.labels} datasets={[{ data: interviewsTrend.data, fill: true, tension: 0.3 }]} fallback={<Sparkline labels={interviewsTrend.labels} data={interviewsTrend.data} />} />
            </SectionCard>
          <SectionCard title={t("totalHiresLabel")}>
              <DashChart type="line" labels={hiresTrend.labels} datasets={[{ data: hiresTrend.data, fill: true, tension: 0.3 }]} fallback={<Sparkline labels={hiresTrend.labels} data={hiresTrend.data} />} />
            </SectionCard>
        </div>

        <SectionCard title={t("retentionRateLabel")}>
              {eligiblePlacements.length === 0 ? (
              <SectionEmpty message={t("noReportDataMessage")} />
            ) : (
              <DashChart
                type="doughnut"
                labels={[t("retainedLabel"), t("notRetainedLabel")]}
                datasets={[{ data: [retainedCount, notRetainedCount] }]}
                fallback={
                  <p className="py-6 text-center text-sm text-card-foreground">
                    {retentionRate}% {t("retainedLabel").toLowerCase()} ({retainedCount} / {eligiblePlacements.length} {t("eligiblePlacementsLabel")})
                  </p>
                }
              />
            )}
            </SectionCard>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <SectionCard title={t("topHiringEmployersLabel")}>
              {topHiringEmployers.length === 0 ? <SectionEmpty message={t("noReportDataMessage")} /> : (
                <DashChart type="bar" labels={topHiringEmployers.map((x) => x.label)} datasets={[{ data: topHiringEmployers.map((x) => x.count) }]} fallback={<BarList items={topHiringEmployers} />} />
              )}
            </SectionCard>
          <SectionCard title={t("topIndustriesLabel")}>
              {topIndustries.length === 0 ? <SectionEmpty message={t("noReportDataMessage")} /> : (
                <DashChart type="bar" labels={topIndustries.map((x) => x.label)} datasets={[{ data: topIndustries.map((x) => x.count) }]} fallback={<BarList items={topIndustries} />} />
              )}
            </SectionCard>
        </div>

        <SectionCard title={t("mostSuccessfulJobDevelopersLabel")}>
              {topJobDevelopers.length === 0 ? <SectionEmpty message={t("noReportDataMessage")} /> : (
              <DashChart type="bar" labels={topJobDevelopers.map((x) => x.label)} datasets={[{ data: topJobDevelopers.map((x) => x.count) }]} fallback={<BarList items={topJobDevelopers} />} />
            )}
            </SectionCard>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <SectionCard
              title={t("monthlyPlacementsLabel")}
              action={
                <select
                  value={selectedYear} onChange={function (e) { setSelectedYear(e.target.value); }} aria-label={t("selectYearLabel")}
                  className="h-9 min-h-0 rounded-[10px] border border-border bg-card py-0 pl-3 text-sm font-medium text-card-foreground focus:border-primary focus:outline-none focus:ring-2"
                >
                  {yearOptions.map(function (y) { return <option key={y} value={y}>{y}</option>; })}
                </select>
              }
            >
              <DashChart type="bar" labels={monthlyPlacements.labels} datasets={[{ data: monthlyPlacements.data }]} fallback={<BarList items={monthlyPlacements.labels.map((l, i) => ({ label: l, count: monthlyPlacements.data[i] }))} />} />
            </SectionCard>
          <SectionCard title={t("annualPlacementsLabel")}>
              <DashChart type="bar" labels={annualPlacements.labels} datasets={[{ data: annualPlacements.data }]} fallback={<BarList items={annualPlacements.labels.map((l, i) => ({ label: l, count: annualPlacements.data[i] }))} />} />
            </SectionCard>
        </div>
      </div>
    </div>
  );
}
