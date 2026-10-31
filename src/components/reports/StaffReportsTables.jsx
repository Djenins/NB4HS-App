// StaffReportsTables.jsx -- the reviewer's two list sections in Staff
// Reports. Overview is one period: who owes a report, the headline counts,
// and every expected report including the ones never started (from the
// staff_reports_overview RPC, which refuses non-reviewers). All reports is
// every submitted report across periods, searchable, with a CSV export of
// the summary rows -- report text and comments are not exported.
import { useEffect, useMemo, useState } from "react";
import { AlarmClock, CheckCircle2, ClipboardList, Download, Hourglass, Inbox, Percent, RotateCcw } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useApp, useT } from "../../context/AppContext.jsx";
import {
  ORGANIZATION, REPORT_STATUSES, fetchOverview, fetchPeriods, fetchReports, fetchSchedules, filterReportRows, fmtDueAt,
  fmtPeriod, localDateIn, programsLabel, summarizeExpectations, toCsv
} from "../../lib/staffReports.js";
import { downloadBlob } from "../../lib/utils.js";
import { Button } from "../ui/button.jsx";
import { DataTable } from "../ui/data-table.jsx";
import { EmptyState } from "../ui/empty-state.jsx";
import { Field, Select } from "../ui/field.jsx";
import { FilterBar, FilterField } from "../ui/filter-bar.jsx";
import { KpiCard } from "../ui/kpi-card.jsx";
import { RangeBar } from "../ui/range-bar.jsx";
import { SearchInput } from "../ui/search-input.jsx";
import { SectionCard } from "../ui/section-card.jsx";
import { Skeleton } from "../ui/skeleton.jsx";
import { ReportStatusBadge, fmtStamp, useProgramLabels } from "./ReportParts.jsx";

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

// List-page filters: search on its own row, the three selects underneath
// (collapsed behind "Filters" on a phone).
function Filters({ idBase, filters, setFilters, staffIds, names, statuses, t }) {
  const set = (k, v) => setFilters((f) => Object.assign({}, f, { [k]: v }));
  const active = ["program", "staffId", "status"].filter((k) => filters[k]).length;
  return (
    <FilterBar
      search={<SearchInput value={filters.q} onChange={(e) => set("q", e.target.value)} onClear={() => set("q", "")} clearLabel={t("clearLabel")} aria-label={t("searchLabel")} placeholder={t("srSearchStaff")} />}
      activeCount={active}
      canClear={active > 0 || !!filters.q}
      onClear={() => setFilters((f) => Object.assign({}, f, EMPTY_FILTERS))}
      clearLabel={t("clearLabel")}
      filtersLabel={t("filtersLabel")}
      gridClassName="sm:grid-cols-3"
    >
      <FilterField label={t("srPrograms")} htmlFor={idBase + "-program"}>
        <Select id={idBase + "-program"} value={filters.program} onChange={(e) => set("program", e.target.value)}>
          <option value="">{t("srAllPrograms")}</option>
          {Object.keys(names.programs).map((k) => <option key={k} value={k}>{names.programs[k]}</option>)}
        </Select>
      </FilterField>
      <FilterField label={t("srStaffMember")} htmlFor={idBase + "-staff"}>
        <Select id={idBase + "-staff"} value={filters.staffId} onChange={(e) => set("staffId", e.target.value)}>
          <option value="">{t("srAllStaff")}</option>
          {staffIds.map((id) => <option key={id} value={id}>{names.staff[id] || "—"}</option>)}
        </Select>
      </FilterField>
      <FilterField label={t("srStatus")} htmlFor={idBase + "-status"}>
        <Select id={idBase + "-status"} value={filters.status} onChange={(e) => set("status", e.target.value)}>
          <option value="">{t("srAllStatuses")}</option>
          {statuses.map((st) => <option key={st} value={st}>{t("srStatus_" + st)}</option>)}
        </Select>
      </FilterField>
    </FilterBar>
  );
}

// Review-list template: one DataTable, a stacked row per report on phones
// and tablets, the review action at the end of every row.
function ReportsTable({ rows, names, tz, showPeriod, loading, empty }) {
  const { lang } = useApp();
  const t = useT();
  const navigate = useNavigate();
  const action = (r) => {
    const reviewable = r.status === "submitted" || r.status === "under_review";
    return r.submittedAt && (r.reportId || r.id) ? (
      <Button size="sm" variant={reviewable ? "default" : "secondary"} onClick={() => navigate("/staffreports/" + (r.reportId || r.id))}>
        {t(reviewable ? "srReview" : "srView")}
      </Button>
    ) : <span className="text-meta text-muted">{t("srNotSubmitted")}</span>;
  };
  const programsOf = (r) => (r.programs && r.programs.length ? names.programsText(r.programs) : "—");
  return (
    <DataTable
      caption={t("srReportsThisPeriod")}
      loading={loading}
      empty={empty}
      columns={[
        { key: "staff", header: t("srStaffMember"), cell: (r) => names.staff[r.staffId] || "—", className: "font-semibold" },
        { key: "programs", header: t("srPrograms"), cell: programsOf },
        { key: "period", header: t("srReportingPeriod"), hidden: !showPeriod, cell: (r) => fmtPeriod(r.periodStart, r.periodEnd, lang) },
        { key: "due", header: t("srDue"), cell: (r) => fmtDueAt(r.dueAt, tz, lang), className: "text-muted" },
        { key: "submitted", header: t("srSubmitted"), cell: (r) => (r.submittedAt ? fmtStamp(r.submittedAt, lang) : "—"), className: "text-muted" },
        { key: "status", header: t("srStatus"), cell: (r) => <ReportStatusBadge status={r.status} overdue={r.overdue} />, className: "whitespace-nowrap" },
        { key: "action", header: <span className="sr-only">{t("srReviewAction")}</span>, cell: action, className: "whitespace-nowrap text-right" }
      ]}
      rows={rows}
      getRowId={(r) => (r.reportId || r.id || "") + r.staffId + r.periodId}
      renderCard={(r) => (
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-ui font-semibold text-card-foreground">{names.staff[r.staffId] || "—"}</span>
              <ReportStatusBadge status={r.status} overdue={r.overdue} />
            </div>
            {r.programs && r.programs.length || showPeriod ? (
              <div className="text-meta text-muted">{[r.programs && r.programs.length ? programsOf(r) : null, showPeriod ? fmtPeriod(r.periodStart, r.periodEnd, lang) : null].filter(Boolean).join(" · ")}</div>
            ) : null}
            <div className="text-meta tabular-nums text-muted">
              {r.submittedAt ? t("srSubmitted") + ": " + fmtStamp(r.submittedAt, lang) : t("srDue") + " " + fmtDueAt(r.dueAt, tz, lang)}
            </div>
          </div>
          <div className="shrink-0">{action(r)}</div>
        </div>
      )}
    />
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

  if (loadError) return <SectionCard><EmptyState variant="error" title={t("srLoadError")} /></SectionCard>;
  if (!periods) return <Skeleton className="h-64 w-full" />;
  const period = periods.find((p) => p.id === periodId);
  const scoped = filterReportRows(rows || [], { program: filters.program, staffId: filters.staffId }, names);
  const stats = summarizeExpectations(scoped);
  const list = filterReportRows(scoped, filters, names);
  const staffIds = Array.from(new Set((rows || []).map((r) => r.staffId)));
  // A tile only takes a tone colour when its number calls for attention.
  const tiles = [
    ["srKpiExpected", stats.expected, ClipboardList, "neutral"],
    ["srKpiSubmitted", stats.submitted, CheckCircle2, "success"],
    ["srKpiPending", stats.pending, Hourglass, "neutral"],
    ["srKpiOverdue", stats.overdue, AlarmClock, stats.overdue ? "danger" : "neutral"],
    ["srKpiAwaitingReview", stats.awaitingReview, Inbox, stats.awaitingReview ? "info" : "neutral"],
    ["srKpiRevision", stats.revisionRequested, RotateCcw, stats.revisionRequested ? "warning" : "neutral"],
    ["srKpiRate", stats.rate === null ? "—" : stats.rate + "%", Percent, "info"]
  ];

  return (
    <div className="grid gap-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <Field className="sm:w-72" label={t("srReportingPeriod")} htmlFor="sr-overview-period">
          <Select id="sr-overview-period" value={periodId} onChange={(e) => setPeriodId(e.target.value)}>
            {periods.map((p) => <option key={p.id} value={p.id}>{fmtPeriod(p.start, p.end, lang)}</option>)}
          </Select>
        </Field>
        {period && <p className="m-0 text-ui tabular-nums text-muted sm:pb-2.5">{t("srDue")} {fmtDueAt(period.dueAt, tz, lang)}</p>}
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 2xl:grid-cols-7">
        {tiles.map(([label, value, Icon, tone]) => (
          rows ? <KpiCard key={label} label={t(label)} value={value} icon={Icon} tone={tone} /> : <Skeleton key={label} className="h-[104px] w-full" />
        ))}
      </div>

      <div>
        <Filters idBase="sr-overview" filters={filters} setFilters={setFilters} staffIds={staffIds} names={names}
          statuses={["not_started", "draft"].concat(REPORT_STATUSES.slice(1), ["overdue"])} t={t} />
        <SectionCard title={t("srReportsThisPeriod")}>
          {rowsError ? <EmptyState variant="error" compact title={t("srLoadError")} />
            : <ReportsTable
                loading={rows === null}
                rows={list.map((r) => Object.assign({}, r, { periodStart: period && period.start, periodEnd: period && period.end }))}
                names={names} tz={tz}
                empty={<EmptyState compact variant={rows && rows.length ? "no-results" : "none"} title={rows && rows.length ? t("srNoMatches") : t("srNobodyExpected")} />} />}
        </SectionCard>
      </div>
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
  const [range, setRange_] = useState("all");

  useEffect(() => {
    fetchReports({ submittedOnly: true }).then(setReports).catch((err) => { console.warn("fetchReports failed", err); setReports([]); });
  }, []);

  if (loadError) return <SectionCard><EmptyState variant="error" title={t("srLoadError")} /></SectionCard>;
  if (!periods || reports === null) return <Skeleton className="h-64 w-full" />;

  const inRange = reports.filter((r) => (!filters.from || r.periodEnd >= filters.from) && (!filters.to || r.periodStart <= filters.to));
  const list = filterReportRows(inRange, filters, names)
    .sort((a, b) => (b.periodStart || "").localeCompare(a.periodStart || "") || (names.staff[a.staffId] || "").localeCompare(names.staff[b.staffId] || ""));
  const staffIds = Array.from(new Set(reports.map((r) => r.staffId)));
  const setRange = (k, v) => setFilters((f) => Object.assign({}, f, { [k]: v }));

  function exportCsv() {
    const header = [t("srStaffMember"), t("srPrograms"), t("srPeriodStart"), t("srPeriodEnd"), t("srDue"), t("srSubmitted"), t("srStatus"), t("srVersion")];
    const rows = list.map((r) => [
      names.staff[r.staffId] || "", names.programsText(r.programs), r.periodStart, r.periodEnd,
      fmtDueAt(r.dueAt, tz, "en"), r.submittedAt || "", t("srStatus_" + r.status), r.version
    ]);
    downloadBlob("\ufeff" + toCsv(header, rows), "nb4hs-staff-reports-" + localDateIn(tz) + ".csv", "text/csv;charset=utf-8");
  }

  return (
    <div>
      {/* "All periods" is simply no From/To; picking it clears both. */}
      <RangeBar
        idBase="sr-all"
        label={t("srRangeLabel")}
        value={range}
        onChange={(v) => { setRange_(v); if (v === "all") setFilters((f) => Object.assign({}, f, { from: "", to: "" })); }}
        options={[{ value: "all", label: t("srRangeAll") }, { value: "custom", label: t("custom") }]}
        custom={{ from: filters.from, to: filters.to, onFrom: (v) => setRange("from", v), onTo: (v) => setRange("to", v), fromLabel: t("srFrom"), toLabel: t("srTo") }}
      />
      <Filters idBase="sr-all" filters={filters} setFilters={setFilters} staffIds={staffIds} names={names} statuses={REPORT_STATUSES.slice(1)} t={t} />
      <SectionCard
        title={t("srSectionAll")}
        description={t("srExportNote")}
        action={<Button variant="secondary" className="gap-1.5" onClick={exportCsv} disabled={!list.length}><Download className="h-4 w-4" aria-hidden="true" /> {t("srExportCsv")}</Button>}
      >
        <ReportsTable rows={list} names={names} tz={tz} showPeriod
          empty={<EmptyState compact variant={reports.length ? "no-results" : "none"} title={reports.length ? t("srNoMatches") : t("srNoSubmittedReports")} />} />
      </SectionCard>
    </div>
  );
}
