// StaffReportsTables.jsx -- the reviewer's two list sections in Staff
// Reports. Overview is one period, sized for a small team: one summary
// card (period, deadline, how many are in), the reports waiting for review,
// then everyone expected to report, including those who never started (from
// the staff_reports_overview RPC, which refuses non-reviewers). Filters live
// only on All reports, where the rows add up across periods. All reports is
// every submitted report across periods, searchable, with a CSV export of
// the summary rows -- report text and comments are not exported.
import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Download } from "lucide-react";
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
// One period's rows share a deadline, which the Overview already states,
// so it hides the Due column there.
function ReportsTable({ caption, rows, names, tz, showPeriod, showDue = true, loading, empty }) {
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
      caption={caption}
      loading={loading}
      empty={empty}
      columns={[
        { key: "staff", header: t("srStaffMember"), cell: (r) => names.staff[r.staffId] || "—", className: "font-semibold" },
        { key: "programs", header: t("srPrograms"), cell: programsOf },
        { key: "period", header: t("srReportingPeriod"), hidden: !showPeriod, cell: (r) => fmtPeriod(r.periodStart, r.periodEnd, lang) },
        { key: "due", header: t("srDue"), hidden: !showDue, cell: (r) => fmtDueAt(r.dueAt, tz, lang), className: "text-muted" },
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

// The period's numbers as one line under a progress bar. Only counts that
// call for action take a colour, and only when they're above zero.
function PeriodSummary({ stats, t }) {
  const pct = stats.expected ? Math.round((stats.submitted / stats.expected) * 100) : 0;
  const parts = [
    ["srSummaryAwaiting", stats.awaitingReview, "text-tone-info-ink"],
    ["srSummarySentBack", stats.revisionRequested, "text-tone-warning-ink"],
    ["srSummaryOverdue", stats.overdue, "text-tone-danger-ink"]
  ];
  return (
    <div className="grid gap-2.5">
      <div aria-hidden="true" className="h-2 overflow-hidden rounded-full bg-surface-sunken">
        <div className="h-full rounded-full bg-primary transition-[width] duration-300 motion-reduce:transition-none" style={{ width: pct + "%" }} />
      </div>
      <p className="m-0 flex flex-wrap items-center gap-x-3 gap-y-1 text-ui tabular-nums">
        <span className="font-semibold text-card-foreground">
          {t("srSummarySubmitted").replace("{n}", stats.submitted).replace("{total}", stats.expected)}
        </span>
        {parts.map(([key, n, tone]) => (
          <span key={key} className={n ? "font-medium " + tone : "text-muted"}>
            <span aria-hidden="true" className="mr-3 text-muted">·</span>{t(key).replace("{n}", n)}
          </span>
        ))}
      </p>
    </div>
  );
}

export function StaffReportsOverview() {
  const { lang, can } = useApp();
  const t = useT();
  const { periods, tz, loadError } = useReferenceData();
  const names = useNames();
  const [periodId, setPeriodId] = useState("");
  const [rows, setRows] = useState(null);
  const [rowsError, setRowsError] = useState(false);

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
  const withPeriod = (rows || []).map((r) => Object.assign({}, r, { periodStart: period && period.start, periodEnd: period && period.end }));
  const everyone = withPeriod.slice().sort((a, b) => (names.staff[a.staffId] || "").localeCompare(names.staff[b.staffId] || ""));
  // Oldest submission first: it has waited longest.
  const waiting = withPeriod.filter((r) => r.status === "submitted" || r.status === "under_review")
    .sort((a, b) => (a.submittedAt || "").localeCompare(b.submittedAt || ""));
  const canReview = can("staff_reports.review");

  return (
    <div className="grid gap-6">
      <SectionCard>
        <div className="grid gap-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <Field className="sm:w-72" label={t("srReportingPeriod")} htmlFor="sr-overview-period">
              <Select id="sr-overview-period" value={periodId} onChange={(e) => setPeriodId(e.target.value)}>
                {periods.map((p) => <option key={p.id} value={p.id}>{fmtPeriod(p.start, p.end, lang)}</option>)}
              </Select>
            </Field>
            {period && <p className="m-0 text-ui tabular-nums text-muted sm:pb-2.5">{t("srDue")} {fmtDueAt(period.dueAt, tz, lang)}</p>}
          </div>
          {rowsError ? null : rows ? <PeriodSummary stats={summarizeExpectations(rows)} t={t} /> : <Skeleton className="h-10 w-full" />}
        </div>
      </SectionCard>

      {rowsError ? (
        <SectionCard><EmptyState variant="error" compact title={t("srLoadError")} /></SectionCard>
      ) : (
        <>
          {canReview && (
            <SectionCard title={t("srNeedsReview")}>
              {rows !== null && waiting.length === 0 ? (
                // An empty queue is good news, not an empty page: one quiet line.
                <p className="m-0 flex items-center gap-2 text-ui text-muted">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-tone-success-ink" aria-hidden="true" /> {t("srNeedsReviewNone")}
                </p>
              ) : (
                <ReportsTable caption={t("srNeedsReview")} loading={rows === null} rows={waiting} names={names} tz={tz} showDue={false} />
              )}
            </SectionCard>
          )}
          <SectionCard title={t("srEveryoneThisPeriod")}>
            <ReportsTable caption={t("srEveryoneThisPeriod")} loading={rows === null} rows={everyone} names={names} tz={tz} showDue={false}
              empty={<EmptyState compact title={t("srNobodyExpected")} />} />
          </SectionCard>
        </>
      )}
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
        <ReportsTable caption={t("srSectionAll")} rows={list} names={names} tz={tz} showPeriod
          empty={<EmptyState compact variant={reports.length ? "no-results" : "none"} title={reports.length ? t("srNoMatches") : t("srNoSubmittedReports")} />} />
      </SectionCard>
    </div>
  );
}
