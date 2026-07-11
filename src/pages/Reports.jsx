// Reports.jsx -- ported from reports_view.js's renderReports()/
// renderReportBody(). Report-range selection (preset pill + custom from/to)
// used to live on App.state.reportRange/customFrom/customTo; local state
// here, same reasoning as Search's filters -- nothing outside this page
// read it.
import { useState } from "react";
import { useApp, useT } from "../context/AppContext.jsx";
import { WEEKDAYS } from "../lib/constants.js";
import { allDistributions } from "../lib/clients.js";
import { navItemsForRole } from "../lib/nav.js";
import {
  computeDailyTrend, computeGeoBreakdown, computeStats, exportCSV, exportExcel, fmtHour, inRange, rangeForPreset
} from "../lib/reports_data.js";
import { fmtDuration, fullServiceList, fullStaffList, labelFor, todayStr } from "../lib/utils.js";
import BarList from "../components/BarList.jsx";
import DashChart from "../components/DashChart.jsx";
import DatePicker from "../components/DatePicker.jsx";
import Sparkline from "../components/Sparkline.jsx";
import StatCard from "../components/StatCard.jsx";

const PRESETS = ["today", "week", "month", "quarter", "year", "custom"];
const PRESET_LABEL_KEY = { today: "today", week: "thisWeek", month: "thisMonth", quarter: "thisQuarter", year: "thisYear", custom: "custom" };

export default function Reports() {
  const { data, lang, showToast, session } = useApp();
  const t = useT();
  const [reportRange, setReportRange] = useState("today");
  const [customFrom, setCustomFrom] = useState(todayStr());
  const [customTo, setCustomTo] = useState(todayStr());

  const range = reportRange === "custom" ? { from: customFrom || todayStr(), to: customTo || todayStr() } : rangeForPreset(reportRange);
  const s = computeStats(data.visits, range);
  const trend = computeDailyTrend(data.visits, range);
  const geo = computeGeoBreakdown(data.visits, data.students, range);
  const dayNames = WEEKDAYS[lang] || WEEKDAYS.en;
  const services = fullServiceList(data.customServices);
  const staffList = fullStaffList(data.customStaff);
  const hourTop8 = s.hourSorted.slice(0, 8);
  const cityTop8 = geo.citySorted.slice(0, 8);
  const zipTop8 = geo.zipSorted.slice(0, 8);

  // Food Distribution is Administrator/Staff only -- only show its numbers
  // here to roles that actually have that nav item, same gate as the nav.
  const role = session ? session.role : null;
  const showFoodStats = navItemsForRole(role).indexOf("fooddistribution") !== -1;
  const distributions = allDistributions(data.foodClients);
  const distInRange = distributions.filter((d) => inRange(d, range.from, range.to));
  const householdsServedCount = new Set(distInRange.map((d) => d.clientId)).size;
  const distTrend = computeDailyTrend(distributions, range);

  function handleExportCSV() {
    exportCSV(data.visits, range, data.customServices, data.customStaff, lang);
    showToast(t("exportCSV") + " ✓");
  }
  function handleExportExcel() {
    exportExcel(data.visits, range, data.customServices, data.customStaff, lang);
    showToast(t("exportExcel") + " ✓");
  }

  return (
    <>
      <h1>{t("reportsTitle")}</h1>
      <div className="card no-print">
        <div className="pill-row">
          {PRESETS.map((p) => (
            <button
              key={p}
              className={"pill" + (reportRange === p ? " active" : "")}
              onClick={() => setReportRange(p)}
            >
              {t(PRESET_LABEL_KEY[p])}
            </button>
          ))}
        </div>
        {reportRange === "custom" && (
          <div className="grid grid-2" style={{ marginTop: 10 }}>
            <div className="field">
              <label htmlFor="rep-from">{t("filterDateFrom")}</label>
              <DatePicker id="rep-from" value={customFrom} onChange={setCustomFrom} />
            </div>
            <div className="field">
              <label htmlFor="rep-to">{t("filterDateTo")}</label>
              <DatePicker id="rep-to" value={customTo} onChange={setCustomTo} />
            </div>
          </div>
        )}
        <div className="pill-row" style={{ marginTop: 14 }}>
          <button className="btn-secondary" onClick={handleExportCSV}>{t("exportCSV")}</button>
          <button className="btn-secondary" onClick={handleExportExcel}>{t("exportExcel")}</button>
          <button className="btn-secondary" onClick={() => window.print()}>{t("printPdf")}</button>
        </div>
      </div>

      <div className="grid grid-4">
        <StatCard num={s.inRangeVisits.length} label={t("numVisitors")} />
        <StatCard num={s.newCount} label={t("firstTime")} />
        <StatCard num={s.returningCount} label={t("repeatVisitors")} />
        <StatCard num={fmtDuration(s.avgLen, lang)} label={t("avgVisitLength")} />
      </div>

      {/* Flat NRS/grant-reporting credit for the currently selected range --
          4 hours per completed student check-in, see reports_data.js. Also
          included as a summary line above the CSV/Excel export table. */}
      <div className="grid grid-4">
        <StatCard num={s.studentHours} label={t("studentInstructionalHoursLabel")} icon="students" />
      </div>

      <div className="card">
        <h3>{t("trendVisitsPerDay")}</h3>
        <DashChart
          type="line"
          labels={trend.labels}
          datasets={[{ data: trend.data, fill: true, tension: 0.3 }]}
          fallback={<Sparkline labels={trend.labels} data={trend.data} />}
        />
      </div>

      {showFoodStats && (
        <>
          <div className="grid grid-4">
            <StatCard num={distInRange.length} label={t("distributionsInRangeLabel")} icon="fooddistribution" />
            <StatCard num={householdsServedCount} label={t("householdsServedLabel")} icon="fooddistribution" />
          </div>
          <div className="card">
            <h3>{t("trendDistributionsPerDay")}</h3>
            <DashChart
              type="line"
              labels={distTrend.labels}
              datasets={[{ data: distTrend.data, fill: true, tension: 0.3 }]}
              fallback={<Sparkline labels={distTrend.labels} data={distTrend.data} />}
            />
          </div>
        </>
      )}

      <div className="grid grid-2">
        <div className="card">
          <h3>{t("mostRequestedServices")}</h3>
          <DashChart
            type="bar"
            labels={s.svcSorted.map((x) => labelFor(services, x.key, lang))}
            datasets={[{ data: s.svcSorted.map((x) => x.count) }]}
            fallback={<BarList items={s.svcSorted.map((x) => ({ label: labelFor(services, x.key, lang), count: x.count }))} />}
          />
        </div>
        <div className="card">
          <h3>{t("visitsByStaff")}</h3>
          <DashChart
            type="bar"
            labels={s.staffSorted.map((x) => labelFor(staffList, x.key, lang))}
            datasets={[{ data: s.staffSorted.map((x) => x.count) }]}
            fallback={<BarList items={s.staffSorted.map((x) => ({ label: labelFor(staffList, x.key, lang), count: x.count }))} />}
          />
        </div>
      </div>

      <div className="grid grid-2">
        <div className="card">
          <h3>{t("visitsByWeekday")}</h3>
          <DashChart
            type="bar"
            labels={dayNames}
            datasets={[{ data: s.dayCounts }]}
            fallback={<BarList items={s.dayCounts.map((c, i) => ({ label: dayNames[i], count: c }))} />}
          />
        </div>
        <div className="card">
          <h3>{t("visitsByHour")}</h3>
          <DashChart
            type="bar"
            labels={hourTop8.map((x) => fmtHour(x.hour))}
            datasets={[{ data: hourTop8.map((x) => x.count) }]}
            fallback={<BarList items={hourTop8.map((x) => ({ label: fmtHour(x.hour), count: x.count }))} />}
          />
        </div>
      </div>

      <div className="grid grid-2">
        <div className="card">
          <h3>{t("visitsByCity")}</h3>
          <DashChart
            type="bar"
            labels={cityTop8.map((x) => x.label || t("locationUnknown"))}
            datasets={[{ data: cityTop8.map((x) => x.count) }]}
            fallback={<BarList items={cityTop8.map((x) => ({ label: x.label || t("locationUnknown"), count: x.count }))} />}
          />
        </div>
        <div className="card">
          <h3>{t("visitsByZip")}</h3>
          <DashChart
            type="bar"
            labels={zipTop8.map((x) => x.label || t("locationUnknown"))}
            datasets={[{ data: zipTop8.map((x) => x.count) }]}
            fallback={<BarList items={zipTop8.map((x) => ({ label: x.label || t("locationUnknown"), count: x.count }))} />}
          />
        </div>
      </div>
    </>
  );
}
