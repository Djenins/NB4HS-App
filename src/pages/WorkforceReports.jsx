// WorkforceReports.jsx -- Phase 6 (final phase) of the Employer & Job
// Opportunity Management module. A separate page from the main Reports.jsx,
// same relationship WorkforceDashboard.jsx has to Dashboard.jsx. Every
// number is computed from tables Phases 1-5 already built -- no new
// database table, no new AppContext wiring. Reuses reports_data.js's
// range/trend primitives and DashChart/Sparkline/BarList verbatim; the only
// new reports_data.js additions are computeMonthlyCounts/computeAnnualCounts
// (month/year bucketing) and exportWorkforceCSV/exportWorkforceExcel.
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
import { addDays, fullIndustryList, todayStr } from "../lib/utils.js";
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
          {pct !== undefined && <div className="mt-2"><TrendBadge pct={pct} none={none} t={t} /></div>}
        </div>
      </CardContent>
    </Card>
  );
}

function countInRange(items, r) { return items.filter((i) => i.date && inRange(i, r.from, r.to)).length; }

export default function WorkforceReports() {
  const { data, showToast } = useApp();
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
                <label htmlFor="wfrep-from" className="mb-1 block text-xs font-semibold text-muted">{t("filterDateFrom")}</label>
                <DatePicker id="wfrep-from" value={customFrom} onChange={setCustomFrom} />
              </div>
              <div>
                <label htmlFor="wfrep-to" className="mb-1 block text-xs font-semibold text-muted">{t("filterDateTo")}</label>
                <DatePicker id="wfrep-to" value={customTo} onChange={setCustomTo} />
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
            <Button variant="secondary" disabled={exportingPdf} onClick={handleExportPdf}>
              <Download className="h-4 w-4 text-accent" /> {exportingPdf ? "…" : t("exportPdf")}
            </Button>
            <Button variant="secondary" onClick={() => window.print()}>
              <Printer className="h-4 w-4 text-accent" /> {t("printPdf")}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div ref={printRef} className="space-y-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard icon={Briefcase} tint="bg-primary-tint" iconColor="text-primary" value={jobsPostedKpi.value} label={t("statJobsPostedLabel")} pct={jobsPostedKpi.trend.pct} none={jobsPostedKpi.trend.none} t={t} />
          <KpiCard icon={CheckCircle2} tint="bg-tint-success" iconColor="text-success" value={placementsKpi.value} label={t("placementsTitle")} pct={placementsKpi.trend.pct} none={placementsKpi.trend.none} t={t} />
          <KpiCard icon={Building2} tint="bg-gold-tint" iconColor="text-gold-dark" value={employersAddedKpi.value} label={t("statEmployersAddedLabel")} pct={employersAddedKpi.trend.pct} none={employersAddedKpi.trend.none} t={t} />
          <KpiCard icon={UserPlus} tint="bg-tint-warn" iconColor="text-warn" value={referralsKpi.value} label={t("referralsLabel")} pct={referralsKpi.trend.pct} none={referralsKpi.trend.none} t={t} />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard icon={CalendarClock} tint="bg-primary-tint" iconColor="text-primary" value={interviewsKpi.value} label={t("statInterviewsLabel")} pct={interviewsKpi.trend.pct} none={interviewsKpi.trend.none} t={t} />
          <KpiCard icon={Award} tint="bg-tint-success" iconColor="text-success" value={hiresKpi.value} label={t("totalHiresLabel")} pct={hiresKpi.trend.pct} none={hiresKpi.trend.none} t={t} />
          <KpiCard icon={Percent} tint="bg-gold-tint" iconColor="text-gold-dark" value={retentionRate === null ? "—" : retentionRate + "%"} label={t("retentionRateLabel")} t={t} />
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader><CardTitle>{t("statJobsPostedLabel")}</CardTitle></CardHeader>
            <CardContent className="pt-0">
              <DashChart type="line" labels={jobsPostedTrend.labels} datasets={[{ data: jobsPostedTrend.data, fill: true, tension: 0.3 }]} fallback={<Sparkline labels={jobsPostedTrend.labels} data={jobsPostedTrend.data} />} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>{t("placementsTitle")}</CardTitle></CardHeader>
            <CardContent className="pt-0">
              <DashChart type="line" labels={placementsTrend.labels} datasets={[{ data: placementsTrend.data, fill: true, tension: 0.3 }]} fallback={<Sparkline labels={placementsTrend.labels} data={placementsTrend.data} />} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>{t("statEmployersAddedLabel")}</CardTitle></CardHeader>
            <CardContent className="pt-0">
              <DashChart type="line" labels={employersAddedTrend.labels} datasets={[{ data: employersAddedTrend.data, fill: true, tension: 0.3 }]} fallback={<Sparkline labels={employersAddedTrend.labels} data={employersAddedTrend.data} />} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>{t("referralsLabel")}</CardTitle></CardHeader>
            <CardContent className="pt-0">
              <DashChart type="line" labels={referralsTrend.labels} datasets={[{ data: referralsTrend.data, fill: true, tension: 0.3 }]} fallback={<Sparkline labels={referralsTrend.labels} data={referralsTrend.data} />} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>{t("statInterviewsLabel")}</CardTitle></CardHeader>
            <CardContent className="pt-0">
              <DashChart type="line" labels={interviewsTrend.labels} datasets={[{ data: interviewsTrend.data, fill: true, tension: 0.3 }]} fallback={<Sparkline labels={interviewsTrend.labels} data={interviewsTrend.data} />} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>{t("totalHiresLabel")}</CardTitle></CardHeader>
            <CardContent className="pt-0">
              <DashChart type="line" labels={hiresTrend.labels} datasets={[{ data: hiresTrend.data, fill: true, tension: 0.3 }]} fallback={<Sparkline labels={hiresTrend.labels} data={hiresTrend.data} />} />
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader><CardTitle>{t("retentionRateLabel")}</CardTitle></CardHeader>
          <CardContent className="pt-0">
            {eligiblePlacements.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted">{t("noReportDataMessage")}</p>
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
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader><CardTitle>{t("topHiringEmployersLabel")}</CardTitle></CardHeader>
            <CardContent className="pt-0">
              {topHiringEmployers.length === 0 ? <p className="py-6 text-center text-sm text-muted">{t("noReportDataMessage")}</p> : (
                <DashChart type="bar" labels={topHiringEmployers.map((x) => x.label)} datasets={[{ data: topHiringEmployers.map((x) => x.count) }]} fallback={<BarList items={topHiringEmployers} />} />
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>{t("topIndustriesLabel")}</CardTitle></CardHeader>
            <CardContent className="pt-0">
              {topIndustries.length === 0 ? <p className="py-6 text-center text-sm text-muted">{t("noReportDataMessage")}</p> : (
                <DashChart type="bar" labels={topIndustries.map((x) => x.label)} datasets={[{ data: topIndustries.map((x) => x.count) }]} fallback={<BarList items={topIndustries} />} />
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader><CardTitle>{t("mostSuccessfulJobDevelopersLabel")}</CardTitle></CardHeader>
          <CardContent className="pt-0">
            {topJobDevelopers.length === 0 ? <p className="py-6 text-center text-sm text-muted">{t("noReportDataMessage")}</p> : (
              <DashChart type="bar" labels={topJobDevelopers.map((x) => x.label)} datasets={[{ data: topJobDevelopers.map((x) => x.count) }]} fallback={<BarList items={topJobDevelopers} />} />
            )}
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <CardTitle>{t("monthlyPlacementsLabel")}</CardTitle>
              <select
                value={selectedYear} onChange={(e) => setSelectedYear(e.target.value)} aria-label={t("selectYearLabel")}
                className="h-9 min-h-0 rounded-lg border border-border bg-background px-2 text-sm text-card-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
              >
                {yearOptions.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </CardHeader>
            <CardContent className="pt-0">
              <DashChart type="bar" labels={monthlyPlacements.labels} datasets={[{ data: monthlyPlacements.data }]} fallback={<BarList items={monthlyPlacements.labels.map((l, i) => ({ label: l, count: monthlyPlacements.data[i] }))} />} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>{t("annualPlacementsLabel")}</CardTitle></CardHeader>
            <CardContent className="pt-0">
              <DashChart type="bar" labels={annualPlacements.labels} datasets={[{ data: annualPlacements.data }]} fallback={<BarList items={annualPlacements.labels.map((l, i) => ({ label: l, count: annualPlacements.data[i] }))} />} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
