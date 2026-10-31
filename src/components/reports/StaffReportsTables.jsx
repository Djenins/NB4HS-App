// StaffReportsTables.jsx -- the reviewer's two list sections in Staff
// Reports. Overview is one period: who owes a report, the headline counts,
// and every expected report including the ones never started (from the
// staff_reports_overview RPC, which refuses non-reviewers). All reports is
// every submitted report across periods, searchable, with a CSV export of
// the summary rows -- report text and comments are not exported.
import { useEffect, useMemo, useState } from "react";
import { Download, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useApp, useT } from "../../context/AppContext.jsx";
import {
  ORGANIZATION, REPORT_STATUSES, fetchOverview, fetchPeriods, fetchReports, fetchSchedules, filterReportRows, fmtDueAt,
  fmtPeriod, localDateIn, programsLabel, summarizeExpectations, toCsv
} from "../../lib/staffReports.js";
import { downloadBlob } from "../../lib/utils.js";
import EmptyState from "../EmptyState.jsx";
import { SectionCard } from "../SectionCard.jsx";
import { Button } from "../ui/button.jsx";
import { REPORT_CONTROL, ReportStatusBadge, TD, TH, fmtStamp, useProgramLabels } from "./ReportParts.jsx";

const SELECT = REPORT_CONTROL + " h-10";

// Names for ids, for display, search and export.
function useNames() {
  const { data } = useApp();
  const t = useT();
  const { names: programNames } = useProgramLabels();
  return useMemo(() => {
    const staff = {};
    (data.profiles || []).forEach((p) => { staff[p.id] = p.name || p.email || "—"; });
    const programs = Object.assign({ [ORGANIZATION]: t("srOrganizationWide") }, programNames);
    return { staff, programs, programsText: (keys) => programsLabel(keys, programs, t("srOrganizationWide")) || "—" };
  }, [data.profiles, programNames, t]);
}

function Filters({ filters, setFilters, staffIds, names, statuses, t }) {
  const set = (k, v) => setFilters((f) => Object.assign({}, f, { [k]: v }));
  return (
    <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden="true" />
        <input value={filters.q} onChange={(e) => set("q", e.target.value)} aria-label={t("searchLabel")} placeholder={t("srSearchStaff")} className={SELECT + " pl-9"} />
      </div>
      <select aria-label={t("srPrograms")} className={SELECT} value={filters.program} onChange={(e) => set("program", e.target.value)}>
        <option value="">{t("srAllPrograms")}</option>
        {Object.keys(names.programs).map((k) => <option key={k} value={k}>{names.programs[k]}</option>)}
      </select>
      <select aria-label={t("srStaffMember")} className={SELECT} value={filters.staffId} onChange={(e) => set("staffId", e.target.value)}>
        <option value="">{t("srAllStaff")}</option>
        {staffIds.map((id) => <option key={id} value={id}>{names.staff[id] || "—"}</option>)}
      </select>
      <select aria-label={t("srStatus")} className={SELECT} value={filters.status} onChange={(e) => set("status", e.target.value)}>
        <option value="">{t("srAllStatuses")}</option>
        {statuses.map((s) => <option key={s} value={s}>{t("srStatus_" + s)}</option>)}
      </select>
    </div>
  );
}

function ReportsTable({ rows, names, tz, showPeriod, emptyMessage }) {
  const { lang } = useApp();
  const t = useT();
  const navigate = useNavigate();
  if (!rows.length) return <EmptyState icon="inbox" message={emptyMessage} />;
  return (
    <div className="overflow-auto rounded-xl border border-border">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            <th className={TH}>{t("srStaffMember")}</th>
            <th className={TH}>{t("srPrograms")}</th>
            {showPeriod && <th className={TH}>{t("srReportingPeriod")}</th>}
            <th className={TH}>{t("srDue")}</th>
            <th className={TH}>{t("srSubmitted")}</th>
            <th className={TH}>{t("srStatus")}</th>
            <th className={TH}><span className="sr-only">{t("srReviewAction")}</span></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const reviewable = r.status === "submitted" || r.status === "under_review";
            return (
              <tr key={(r.reportId || r.id || "") + r.staffId + r.periodId} className="border-t border-border">
                <td className={TD + " font-semibold text-card-foreground"}>{names.staff[r.staffId] || "—"}</td>
                <td className={TD}>{r.programs && r.programs.length ? names.programsText(r.programs) : "—"}</td>
                {showPeriod && <td className={TD + " whitespace-nowrap"}>{fmtPeriod(r.periodStart, r.periodEnd, lang)}</td>}
                <td className={TD + " whitespace-nowrap text-muted"}>{fmtDueAt(r.dueAt, tz, lang)}</td>
                <td className={TD + " whitespace-nowrap text-muted"}>{r.submittedAt ? fmtStamp(r.submittedAt, lang) : "—"}</td>
                <td className={TD}><ReportStatusBadge status={r.status} overdue={r.overdue} /></td>
                <td className={TD + " text-right"}>
                  {r.submittedAt && (r.reportId || r.id) ? (
                    <Button size="sm" variant={reviewable ? "default" : "secondary"} onClick={() => navigate("/staffreports/" + (r.reportId || r.id))}>
                      {t(reviewable ? "srReview" : "srView")}
                    </Button>
                  ) : <span className="text-meta text-muted">{t("srNotSubmitted")}</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function useReferenceData() {
  const [periods, setPeriods] = useState(null);
  const [tz, setTz] = useState("America/New_York");
  const [loadError, setLoadError] = useState(false);
  useEffect(() => {
    Promise.all([fetchPeriods(), fetchSchedules()])
      .then(([p, s]) => { setPeriods(p); setTz((s.find((x) => x.active) || s[0] || {}).timeZone || "America/New_York"); })
      .catch((err) => { console.warn("Staff Reports load failed", err); setLoadError(true); });
  }, []);
  return { periods, tz, loadError };
}

const EMPTY_FILTERS = { q: "", program: "", staffId: "", status: "" };

export function StaffReportsOverview() {
  const { lang } = useApp();
  const t = useT();
  const { periods, tz, loadError } = useReferenceData();
  const names = useNames();
  const [periodId, setPeriodId] = useState("");
  const [rows, setRows] = useState(null);
  const [rowsError, setRowsError] = useState(false);
  const [filters, setFilters] = useState(EMPTY_FILTERS);

  // Default to the period containing today, else the latest one already started, else the first upcoming.
  useEffect(() => {
    if (!periods || !periods.length || periodId) return;
    const today = localDateIn(tz);
    const current = periods.find((p) => p.start <= today && today <= p.end)
      || periods.find((p) => p.start <= today) || periods[periods.length - 1];
    setPeriodId(current.id);
  }, [periods, tz]);

  useEffect(() => {
    if (!periodId) return;
    setRows(null);
    fetchOverview(periodId).then((r) => { setRows(r); setRowsError(false); }).catch((err) => { console.warn("fetchOverview failed", err); setRowsError(true); });
  }, [periodId]);

  if (loadError) return <SectionCard title={t("srSectionOverview")}><EmptyState icon="inbox" message={t("srLoadError")} /></SectionCard>;
  if (!periods) return null;
  const period = periods.find((p) => p.id === periodId);
  const scoped = filterReportRows(rows || [], { program: filters.program, staffId: filters.staffId }, names);
  const stats = summarizeExpectations(scoped);
  const list = filterReportRows(scoped, filters, names);
  const staffIds = Array.from(new Set((rows || []).map((r) => r.staffId)));
  const tiles = [
    ["srKpiExpected", stats.expected, ""], ["srKpiSubmitted", stats.submitted, ""], ["srKpiPending", stats.pending, ""],
    ["srKpiOverdue", stats.overdue, stats.overdue ? "text-accent" : ""], ["srKpiAwaitingReview", stats.awaitingReview, stats.awaitingReview ? "text-primary" : ""],
    ["srKpiRevision", stats.revisionRequested, ""], ["srKpiRate", stats.rate === null ? "—" : stats.rate + "%", ""]
  ];

  return (
    <div className="grid gap-5">
      <SectionCard
        title={t("srSectionOverview")}
        action={
          <select aria-label={t("srReportingPeriod")} className={SELECT + " w-auto min-w-[240px]"} value={periodId} onChange={(e) => setPeriodId(e.target.value)}>
            {periods.map((p) => <option key={p.id} value={p.id}>{fmtPeriod(p.start, p.end, lang)}</option>)}
          </select>
        }
      >
        {period && <p className="!mb-4 !mt-0 !text-sm text-muted">{t("srDue")} {fmtDueAt(period.dueAt, tz, lang)}</p>}
        <dl className="m-0 grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-7">
          {tiles.map(([label, value, tone]) => (
            <div key={label} className="rounded-lg bg-background px-4 py-3">
              <dt className="text-meta font-semibold text-muted">{t(label)}</dt>
              <dd className={"m-0 mt-1 text-2xl font-bold text-card-foreground " + tone}>{rows ? value : "…"}</dd>
            </div>
          ))}
        </dl>
      </SectionCard>

      <SectionCard title={t("srReportsThisPeriod")}>
        <Filters filters={filters} setFilters={setFilters} staffIds={staffIds} names={names}
          statuses={["not_started", "draft"].concat(REPORT_STATUSES.slice(1), ["overdue"])} t={t} />
        {rowsError ? <EmptyState icon="inbox" message={t("srLoadError")} />
          : rows === null ? null
          : <ReportsTable rows={list.map((r) => Object.assign({}, r, { periodStart: period && period.start, periodEnd: period && period.end }))}
              names={names} tz={tz} emptyMessage={rows.length ? t("srNoMatches") : t("srNobodyExpected")} />}
      </SectionCard>
    </div>
  );
}

export function StaffReportsAll() {
  const { lang } = useApp();
  const t = useT();
  const { periods, tz, loadError } = useReferenceData();
  const names = useNames();
  const [reports, setReports] = useState(null);
  const [filters, setFilters] = useState(Object.assign({ from: "", to: "" }, EMPTY_FILTERS));

  useEffect(() => {
    fetchReports({ submittedOnly: true }).then(setReports).catch((err) => { console.warn("fetchReports failed", err); setReports([]); });
  }, []);

  if (loadError) return <SectionCard title={t("srSectionAll")}><EmptyState icon="inbox" message={t("srLoadError")} /></SectionCard>;
  if (!periods || reports === null) return null;

  const inRange = reports.filter((r) => (!filters.from || r.periodEnd >= filters.from) && (!filters.to || r.periodStart <= filters.to));
  const list = filterReportRows(inRange, filters, names)
    .sort((a, b) => (b.periodStart || "").localeCompare(a.periodStart || "") || (names.staff[a.staffId] || "").localeCompare(names.staff[b.staffId] || ""));
  const staffIds = Array.from(new Set(reports.map((r) => r.staffId)));

  function exportCsv() {
    const header = [t("srStaffMember"), t("srPrograms"), t("srPeriodStart"), t("srPeriodEnd"), t("srDue"), t("srSubmitted"), t("srStatus"), t("srVersion")];
    const rows = list.map((r) => [
      names.staff[r.staffId] || "", names.programsText(r.programs), r.periodStart, r.periodEnd,
      fmtDueAt(r.dueAt, tz, "en"), r.submittedAt || "", t("srStatus_" + r.status), r.version
    ]);
    downloadBlob("﻿" + toCsv(header, rows), "nb4hs-staff-reports-" + localDateIn(tz) + ".csv", "text/csv;charset=utf-8");
  }

  return (
    <SectionCard
      title={t("srSectionAll")}
      action={<Button variant="secondary" className="gap-1.5" onClick={exportCsv} disabled={!list.length}><Download className="h-4 w-4" aria-hidden="true" /> {t("srExportCsv")}</Button>}
    >
      <Filters filters={filters} setFilters={setFilters} staffIds={staffIds} names={names} statuses={REPORT_STATUSES.slice(1)} t={t} />
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <label className="grid gap-1 text-meta font-semibold text-muted">{t("srFrom")}
          <input type="date" className={SELECT + " w-auto"} value={filters.from} onChange={(e) => setFilters((f) => Object.assign({}, f, { from: e.target.value }))} />
        </label>
        <label className="grid gap-1 text-meta font-semibold text-muted">{t("srTo")}
          <input type="date" className={SELECT + " w-auto"} value={filters.to} onChange={(e) => setFilters((f) => Object.assign({}, f, { to: e.target.value }))} />
        </label>
        <span className="pb-2 text-meta text-muted">{t("srExportNote")}</span>
      </div>
      <ReportsTable rows={list} names={names} tz={tz} showPeriod emptyMessage={reports.length ? t("srNoMatches") : t("srNoSubmittedReports")} />
    </SectionCard>
  );
}
