// Search.jsx -- Visitor Search: the visitor log, filterable and sortable.
// First page moved onto the NB4HS Operate design system
// (plans/ui-design-system.md, Phase 2) -- PageHeader, KpiCard, FilterBar,
// DataTable, Drawer and Dialog from components/ui -- and the template the
// other list pages follow.
//
// Data and behaviour are unchanged: data.visits filtered by
// q/service/staff/status/duration/date, sorted (most recent Time In by
// default), paginated. "New visitor" links to /checkin/visitor; Export
// reuses Reports.jsx's exportCSV/exportExcel. Row actions: View opens a
// read-only detail drawer (Print reuses it via window.print()); Edit opens a
// form covering the contact/service/notes fields CheckInVisitor.jsx collects
// at check-in (not date/timeIn/timeOut -- those belong to the check-in and
// check-out flows) and saves via checkinData.js's updateVisit(); Tag grant
// links the visit to an active grant.
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Award, ChevronDown, Clock, Columns3, Copy, DoorOpen, Download, Eye,
  LogIn, MoreHorizontal, Pencil, Plus, Printer, UserRound, Users
} from "lucide-react";
import { useApp, useT } from "../context/AppContext.jsx";
import { serviceDisplay } from "../lib/students.js";
import { computeDailyTrend, computeStats, exportCSV, exportExcel, rangeForPreset } from "../lib/reports_data.js";
import { fetchGrants } from "../lib/grants.js";
import { fetchGrantTagsForRecords, setRecordGrantTag } from "../lib/serviceGrantTags.js";
import { updateVisit } from "../lib/checkinData.js";
import {
  dateStrFromDate, fmtDuration, fmtTime, formatPhone, fullServiceList, fullStaffList,
  initialsOf, labelFor, minutesBetween, todayStr
} from "../lib/utils.js";
import DatePicker from "../components/DatePicker.jsx";
import Pagination from "../components/Pagination.jsx";
import { Avatar, AvatarFallback } from "../components/ui/avatar.jsx";
import { Badge } from "../components/ui/badge.jsx";
import { Button } from "../components/ui/button.jsx";
import { Card } from "../components/ui/card.jsx";
import { DataTable } from "../components/ui/data-table.jsx";
import { Dialog } from "../components/ui/dialog.jsx";
import { DetailRow, Drawer } from "../components/ui/drawer.jsx";
import {
  DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuTrigger
} from "../components/ui/dropdown-menu.jsx";
import { EmptyState } from "../components/ui/empty-state.jsx";
import { Field, Input, Select, Textarea } from "../components/ui/field.jsx";
import { FilterBar, FilterField } from "../components/ui/filter-bar.jsx";
import { IconButton } from "../components/ui/icon-button.jsx";
import { KpiCard } from "../components/ui/kpi-card.jsx";
import { PageHeader } from "../components/ui/page-header.jsx";
import { SearchInput } from "../components/ui/search-input.jsx";
import { StatusBadge } from "../components/ui/status-badge.jsx";
import { avatarColorFor } from "../lib/avatarTone.js";

function VisitStatus({ visit, t }) {
  return visit.timeOut
    ? <StatusBadge domain="visit" status="out">{t("checkedOut")}</StatusBadge>
    : <StatusBadge domain="visit" status="in">{t("inBuilding")}</StatusBadge>;
}

function GrantBadge({ name }) {
  return name ? <Badge variant="violet"><Award className="h-3 w-3" aria-hidden="true" />{name}</Badge> : null;
}

function fmtDateShort(dateStr, lang) {
  if (!dateStr) return "—";
  try {
    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString(lang === "en" ? "en-US" : lang, { month: "short", day: "numeric", year: "numeric" });
  } catch (e) { return dateStr; }
}
function fmtDurationShort(mins) {
  if (mins === null || mins === undefined) return "—";
  mins = Math.max(0, Math.round(mins));
  const h = Math.floor(mins / 60), m = mins % 60;
  if (h <= 0) return m + "m";
  return h + "h " + m + "m";
}

function durationBucket(mins) {
  if (mins == null) return null;
  if (mins < 30) return "u30";
  if (mins <= 60) return "30to60";
  return "o60";
}

export default function Search() {
  const { data, lang, showToast, refetchVisits } = useApp();
  const t = useT();
  const navigate = useNavigate();

  const [filters, setFilters] = useState({ q: "", service: "", staff: "", status: "", duration: "", from: "", to: "" });
  const [sort, setSort] = useState({ key: "timeIn", dir: "desc" });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selected, setSelected] = useState(() => new Set());
  const [visibleCols, setVisibleCols] = useState({ staff: true, actions: true });
  const [detailVisit, setDetailVisit] = useState(null);
  const [editVisit, setEditVisit] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [grants, setGrants] = useState([]);
  const [grantTags, setGrantTags] = useState({});
  const [grantTagVisit, setGrantTagVisit] = useState(null);
  const [pendingGrantId, setPendingGrantId] = useState("");

  useEffect(() => {
    fetchGrants().then((rows) => setGrants(rows.filter((g) => g.active)));
  }, []);

  function setFilter(key, value) {
    setFilters((prev) => Object.assign({}, prev, { [key]: value }));
    setPage(1);
  }
  function resetFilters() {
    setFilters({ q: "", service: "", staff: "", status: "", duration: "", from: "", to: "" });
    setPage(1);
  }

  const services = fullServiceList(data.customServices);
  const staffList = fullStaffList(data.customStaff);

  let list = data.visits.slice();
  if (filters.q) {
    const ql = filters.q.toLowerCase();
    list = list.filter((v) =>
      (v.firstName + " " + v.lastName).toLowerCase().indexOf(ql) !== -1 ||
      (v.phone || "").indexOf(ql) !== -1 ||
      (v.email || "").toLowerCase().indexOf(ql) !== -1 ||
      (v.address || "").toLowerCase().indexOf(ql) !== -1 ||
      (v.id || "").toLowerCase().indexOf(ql) !== -1
    );
  }
  if (filters.service) list = list.filter((v) => v.service === filters.service);
  if (filters.staff) list = list.filter((v) => v.staff === filters.staff);
  if (filters.status === "in") list = list.filter((v) => !v.timeOut);
  if (filters.status === "out") list = list.filter((v) => !!v.timeOut);
  if (filters.duration) list = list.filter((v) => v.timeOut && durationBucket(minutesBetween(v.timeIn, v.timeOut)) === filters.duration);
  if (filters.from) list = list.filter((v) => v.date >= filters.from);
  if (filters.to) list = list.filter((v) => v.date <= filters.to);

  list = list.slice().sort((a, b) => {
    let av, bv;
    if (sort.key === "name") { av = (a.firstName + " " + a.lastName).toLowerCase(); bv = (b.firstName + " " + b.lastName).toLowerCase(); }
    else { av = new Date(a.timeIn).getTime(); bv = new Date(b.timeIn).getTime(); }
    if (av < bv) return sort.dir === "asc" ? -1 : 1;
    if (av > bv) return sort.dir === "asc" ? 1 : -1;
    return 0;
  });

  function onSort(key) {
    setSort((prev) => (prev.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));
  }

  const totalPages = Math.max(1, Math.ceil(list.length / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const rows = list.slice((safePage - 1) * pageSize, (safePage - 1) * pageSize + pageSize);
  const rowIds = rows.map((v) => v.id).join(",");

  useEffect(() => {
    const ids = rowIds ? rowIds.split(",") : [];
    let cancelled = false;
    fetchGrantTagsForRecords("visits", ids).then((map) => { if (!cancelled) setGrantTags((prev) => Object.assign({}, prev, map)); });
    return () => { cancelled = true; };
  }, [rowIds]);

  function openGrantTag(v) {
    setGrantTagVisit(v);
    setPendingGrantId(grantTags[v.id] || "");
  }
  async function saveGrantTag() {
    await setRecordGrantTag("visits", grantTagVisit.id, pendingGrantId || null);
    setGrantTags((prev) => Object.assign({}, prev, { [grantTagVisit.id]: pendingGrantId || undefined }));
    setGrantTagVisit(null);
  }
  const grantNameFor = (id) => { const g = grants.find((x) => x.id === id); return g ? g.name : ""; };

  function openEditVisit(v) {
    setEditVisit(v);
    setEditForm({
      firstName: v.firstName || "", lastName: v.lastName || "", phone: v.phone || "", email: v.email || "",
      address: v.address || "", city: v.city || "", state: v.state || "RI", zip: v.zip || "",
      service: v.service || "", serviceOther: v.serviceOther || "", staff: v.staff || "", staffOther: v.staffOther || "",
      notes: v.notes || ""
    });
  }
  function closeEditVisit() { setEditVisit(null); setEditForm(null); }
  function setEditField(key, value) { setEditForm((prev) => Object.assign({}, prev, { [key]: value })); }
  async function saveEditVisit() {
    setSavingEdit(true);
    try {
      await updateVisit(editVisit.id, editForm);
      await refetchVisits();
      showToast(t("visitUpdatedToast"));
      closeEditVisit();
    } catch (e) {
      showToast(t("visitUpdateError"));
    } finally {
      setSavingEdit(false);
    }
  }

  const allOnPageSelected = rows.length > 0 && rows.every((v) => selected.has(v.id));
  function toggleAllOnPage() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allOnPageSelected) rows.forEach((v) => next.delete(v.id));
      else rows.forEach((v) => next.add(v.id));
      return next;
    });
  }
  function toggleRow(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  // KPI numbers: real, unfiltered stats for "today" (matches Dashboard's own
  // stat tiles) -- these describe the whole visitor log, not the current
  // search results, same as the mockup's always-on summary row.
  const todayRange = rangeForPreset("today");
  const stats = computeStats(data.visits, todayRange);
  const sevenAgo = new Date(); sevenAgo.setDate(sevenAgo.getDate() - 6);
  const trend = computeDailyTrend(data.visits, { from: dateStrFromDate(sevenAgo), to: todayStr() }).data;

  function handleCopyPhone(phone) {
    if (navigator.clipboard && phone) {
      navigator.clipboard.writeText(formatPhone(phone)).then(() => showToast(t("phoneCopied")));
    }
  }
  function handlePrint(v) {
    setDetailVisit(v);
    setTimeout(() => window.print(), 60);
  }

  const activeFilterCount = ["service", "staff", "status", "duration", "from", "to"].filter((k) => filters[k]).length;
  const exportRange = { from: "0000-01-01", to: "9999-12-31" };

  function visitDetailsLine(v) {
    const dur = v.timeOut ? fmtDurationShort(minutesBetween(v.timeIn, v.timeOut)) : "—";
    return fmtDateShort(v.date, lang) + " · " + fmtTime(v.timeIn) + " – " + (v.timeOut ? fmtTime(v.timeOut) : "—") + " · " + dur;
  }

  function rowActions(v) {
    return (
      <div className="flex items-center justify-end gap-0.5">
        <IconButton size="sm" label={t("viewDetails")} onClick={() => setDetailVisit(v)}><Eye aria-hidden="true" /></IconButton>
        <IconButton size="sm" label={t("editVisit")} onClick={() => openEditVisit(v)}><Pencil aria-hidden="true" /></IconButton>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <IconButton size="sm" label={t("moreActions")}><MoreHorizontal aria-hidden="true" /></IconButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => handlePrint(v)}><Printer className="h-4 w-4 text-muted" aria-hidden="true" />{t("printVisit")}</DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleCopyPhone(v.phone)} disabled={!v.phone}><Copy className="h-4 w-4 text-muted" aria-hidden="true" />{t("copyPhone")}</DropdownMenuItem>
            <DropdownMenuItem onClick={() => openGrantTag(v)}><Award className="h-4 w-4 text-muted" aria-hidden="true" />{t("tagGrantLabel")}</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  }

  const columns = [
    {
      key: "visitor", header: t("visitorName"), sortKey: "name",
      cell: (v) => {
        const name = v.firstName + " " + v.lastName;
        return (
          <div className="flex items-center gap-3">
            <Avatar className="h-9 w-9"><AvatarFallback className={avatarColorFor(name)}>{initialsOf(v)}</AvatarFallback></Avatar>
            <div className="min-w-0">
              <div className="truncate font-semibold">{name}</div>
              <div className="truncate text-meta text-muted">{formatPhone(v.phone) || "—"}</div>
            </div>
          </div>
        );
      }
    },
    {
      key: "details", header: t("visitDetailsCol"), sortKey: "timeIn",
      cell: (v) => (
        <div className="min-w-0">
          <div className="font-semibold">{serviceDisplay(v, data.customServices, lang)}</div>
          <div className="text-meta text-muted">{visitDetailsLine(v)}</div>
          {grantTags[v.id] ? <div className="mt-1"><GrantBadge name={grantNameFor(grantTags[v.id])} /></div> : null}
        </div>
      )
    },
    {
      key: "staff", header: t("staffMember"), hidden: !visibleCols.staff,
      cell: (v) => {
        const staffName = labelFor(staffList, v.staff, lang);
        return (
          <div className="flex items-center gap-2.5">
            <Avatar className="h-8 w-8"><AvatarFallback className={avatarColorFor(staffName)}>{staffName.slice(0, 2).toUpperCase()}</AvatarFallback></Avatar>
            <span className="min-w-0 font-medium">{staffName}</span>
          </div>
        );
      }
    },
    { key: "status", header: t("status"), cell: (v) => <VisitStatus visit={v} t={t} /> },
    { key: "actions", header: <span className="sr-only">{t("actionsCol")}</span>, hidden: !visibleCols.actions, className: "w-px", cell: rowActions }
  ];

  function renderVisitCard(v) {
    const name = v.firstName + " " + v.lastName;
    return (
      <div>
        <div className="flex min-w-0 items-center gap-3">
          <Avatar className="h-10 w-10"><AvatarFallback className={avatarColorFor(name)}>{initialsOf(v)}</AvatarFallback></Avatar>
          <div className="min-w-0 flex-1">
            <div className="truncate text-ui font-semibold text-card-foreground">{name}</div>
            <div className="truncate text-meta text-muted">{formatPhone(v.phone) || "—"}</div>
          </div>
        </div>
        <div className="mt-3 text-ui">
          <div className="font-semibold text-card-foreground">{serviceDisplay(v, data.customServices, lang)}</div>
          <div className="text-meta tabular-nums text-muted">{visitDetailsLine(v)}</div>
          <div className="mt-1 text-meta text-muted">{t("staffMember")}: {labelFor(staffList, v.staff, lang)}</div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <VisitStatus visit={v} t={t} />
            <GrantBadge name={grantTags[v.id] ? grantNameFor(grantTags[v.id]) : ""} />
          </div>
        </div>
        <div className="mt-2 flex justify-end">{rowActions(v)}</div>
      </div>
    );
  }

  const emptyState = data.visits.length ? (
    <EmptyState
      variant="no-results"
      title={t("noOneFound")}
      description={t("searchNoResultsHint")}
      action={<Button variant="secondary" onClick={resetFilters}>{t("clearAllLabel")}</Button>}
    />
  ) : (
    <EmptyState
      icon={Users}
      title={t("searchEmptyTitle")}
      description={t("searchEmptyHint")}
      action={<Button onClick={() => navigate("/checkin/visitor")}><Plus className="h-4 w-4" aria-hidden="true" />{t("newVisitorBtn")}</Button>}
    />
  );

  return (
    <>
      <PageHeader
        title={t("searchTitle")}
        description={t("searchSubtitle")}
        actions={
          <>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="secondary">
                  <Download className="h-4 w-4" aria-hidden="true" />{t("exportLabel")}<ChevronDown className="h-4 w-4 text-muted" aria-hidden="true" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => exportCSV(list, exportRange, data.customServices, data.customStaff, lang)}>{t("exportCSV")}</DropdownMenuItem>
                <DropdownMenuItem onClick={() => exportExcel(list, exportRange, data.customServices, data.customStaff, lang)}>{t("exportExcel")}</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button onClick={() => navigate("/checkin/visitor")}>
              <Plus className="h-4 w-4" aria-hidden="true" />{t("newVisitorBtn")}
            </Button>
          </>
        }
      />

      {/* Today's numbers across the whole visitor log (not the filtered
          results), matching the Dashboard's own tiles. Only Today's visitors
          gets a trend line: the 7-day series counts visits, so it would be
          false context on the other three. */}
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard label={t("todaysVisitors")} value={stats.todayVisits.length} icon={Users} tone="info" hint={trend.some((n) => n > 0) ? t("last7DaysHint") : null} trend={trend} />
        <KpiCard label={t("currentlyInBuilding")} value={stats.currentlyIn.length} icon={LogIn} tone="success" />
        <KpiCard label={t("checkedOutToday")} value={stats.checkedOutToday.length} icon={DoorOpen} tone="neutral" />
        <KpiCard label={t("avgVisitLength")} value={fmtDuration(stats.avgLen, lang)} icon={Clock} tone="violet" />
      </div>

      <FilterBar
        search={
          <SearchInput
            value={filters.q}
            onChange={(e) => setFilter("q", e.target.value)}
            onClear={() => setFilter("q", "")}
            clearLabel={t("clearAllLabel")}
            placeholder={t("searchPlaceholder")}
            aria-label={t("searchLabel")}
          />
        }
        activeCount={activeFilterCount}
        canClear={activeFilterCount > 0 || !!filters.q}
        onClear={resetFilters}
        clearLabel={t("clearFilters")}
        filtersLabel={t("filtersLabel")}
        gridClassName="sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6"
      >
        <FilterField label={t("service")} htmlFor="search-filter-service">
          <Select id="search-filter-service" value={filters.service} onChange={(e) => setFilter("service", e.target.value)}>
            <option value="">{t("allServices")}</option>
            {services.map((s) => <option key={s.key} value={s.key}>{s[lang] || s.en}</option>)}
          </Select>
        </FilterField>
        <FilterField label={t("staffMember")} htmlFor="search-filter-staff">
          <Select id="search-filter-staff" value={filters.staff} onChange={(e) => setFilter("staff", e.target.value)}>
            <option value="">{t("allStaff")}</option>
            {staffList.map((s) => <option key={s.key} value={s.key}>{s[lang] || s.en}</option>)}
          </Select>
        </FilterField>
        <FilterField label={t("statusLabel")} htmlFor="search-filter-status">
          <Select id="search-filter-status" value={filters.status} onChange={(e) => setFilter("status", e.target.value)}>
            <option value="">{t("allStatuses")}</option>
            <option value="in">{t("inBuilding")}</option>
            <option value="out">{t("checkedOut")}</option>
          </Select>
        </FilterField>
        <FilterField label={t("visitDurationLabel")} htmlFor="search-filter-duration">
          <Select id="search-filter-duration" value={filters.duration} onChange={(e) => setFilter("duration", e.target.value)}>
            <option value="">{t("allDurations")}</option>
            <option value="u30">{t("durationUnder30")}</option>
            <option value="30to60">{t("duration30to60")}</option>
            <option value="o60">{t("durationOver60")}</option>
          </Select>
        </FilterField>
        <FilterField label={t("dateRangeLabel")} className="sm:col-span-2">
          <div className="ds-control grid grid-cols-2 gap-2">
            <DatePicker value={filters.from} onChange={(v) => setFilter("from", v)} placeholder={t("filterDateFrom")} />
            <DatePicker value={filters.to} onChange={(v) => setFilter("to", v)} placeholder={t("filterDateTo")} />
          </div>
        </FilterField>
      </FilterBar>

      <Card className="p-4 sm:p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="m-0 text-ui tabular-nums text-muted" aria-live="polite">
            {t("showingResultsLabel").replace("{shown}", String(rows.length)).replace("{total}", String(list.length))}
          </p>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="secondary" size="sm" className="hidden lg:inline-flex">
                <Columns3 className="h-4 w-4" aria-hidden="true" />{t("columnsLabel")}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>{t("columnsLabel")}</DropdownMenuLabel>
              <DropdownMenuCheckboxItem checked={visibleCols.staff} onCheckedChange={(on) => setVisibleCols((c) => ({ ...c, staff: on }))}>
                {t("staffMember")}
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem checked={visibleCols.actions} onCheckedChange={(on) => setVisibleCols((c) => ({ ...c, actions: on }))}>
                {t("actionsCol")}
              </DropdownMenuCheckboxItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <DataTable
          caption={t("searchTitle")}
          columns={columns}
          rows={rows}
          getRowId={(v) => v.id}
          sort={sort}
          onSort={onSort}
          selection={{
            selected,
            onToggle: toggleRow,
            onToggleAll: toggleAllOnPage,
            allLabel: t("selectAllLabel"),
            rowLabel: (v) => v.firstName + " " + v.lastName
          }}
          renderCard={renderVisitCard}
          empty={emptyState}
        />

        {rows.length ? (
          <Pagination
            bare
            page={safePage} totalPages={totalPages} total={list.length} pageSize={pageSize}
            onPageSizeChange={(n) => { setPageSize(n); setPage(1); }} itemLabel={t("itemLabelVisitors")}
            onChange={(delta) => setPage(safePage + delta)}
          />
        ) : null}
      </Card>

      <Drawer
        open={!!detailVisit}
        onClose={() => setDetailVisit(null)}
        title={t("visitDetailsModalTitle")}
        icon={<UserRound />}
        closeLabel={t("closeLabel")}
        footer={
          <>
            <Button variant="secondary" onClick={() => window.print()}><Printer className="h-4 w-4" aria-hidden="true" />{t("printVisit")}</Button>
            {detailVisit ? <Button onClick={() => { const v = detailVisit; setDetailVisit(null); openEditVisit(v); }}><Pencil className="h-4 w-4" aria-hidden="true" />{t("editVisit")}</Button> : null}
          </>
        }
      >
        {detailVisit ? (
          <>
            <div className="mb-5 flex items-center gap-3">
              <Avatar className="h-12 w-12"><AvatarFallback className={avatarColorFor(detailVisit.firstName + " " + detailVisit.lastName)}>{initialsOf(detailVisit)}</AvatarFallback></Avatar>
              <div className="min-w-0 flex-1">
                <div className="truncate text-section font-semibold text-card-foreground">{detailVisit.firstName} {detailVisit.lastName}</div>
                <div className="text-meta text-muted">{formatPhone(detailVisit.phone) || "—"}</div>
              </div>
              <VisitStatus visit={detailVisit} t={t} />
            </div>
            <dl className="m-0">
              <DetailRow label={t("service")}>{serviceDisplay(detailVisit, data.customServices, lang)}</DetailRow>
              <DetailRow label={t("date")}>{fmtDateShort(detailVisit.date, lang)}</DetailRow>
              <DetailRow label={t("timeIn")}>{fmtTime(detailVisit.timeIn)}</DetailRow>
              <DetailRow label={t("timeOut")}>{detailVisit.timeOut ? fmtTime(detailVisit.timeOut) : "—"}</DetailRow>
              <DetailRow label={t("visitLength")}>{detailVisit.timeOut ? fmtDuration(minutesBetween(detailVisit.timeIn, detailVisit.timeOut), lang) : "—"}</DetailRow>
              <DetailRow label={t("staffMember")}>{labelFor(staffList, detailVisit.staff, lang)}</DetailRow>
              {grantTags[detailVisit.id] ? <DetailRow label={t("grantLabel")}>{grantNameFor(grantTags[detailVisit.id])}</DetailRow> : null}
            </dl>
          </>
        ) : null}
      </Drawer>

      <Dialog
        open={!!(editVisit && editForm)}
        onClose={closeEditVisit}
        title={t("editVisitModalTitle")}
        description={editVisit ? fmtDateShort(editVisit.date, lang) + " · " + fmtTime(editVisit.timeIn) : null}
        size="lg"
        closeLabel={t("closeLabel")}
        className="no-print"
        as="form"
        panelProps={{ onSubmit: (e) => { e.preventDefault(); saveEditVisit(); } }}
        footer={
          <>
            <Button type="button" variant="secondary" onClick={closeEditVisit}>{t("cancelLabel")}</Button>
            <Button type="submit" loading={savingEdit} disabled={!editForm || !editForm.firstName.trim() || !editForm.lastName.trim()}>{t("saveLabel")}</Button>
          </>
        }
      >
        {editForm ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-6">
            <Field label={t("firstName")} htmlFor="edit-visit-firstName" required className="sm:col-span-3">
              <Input id="edit-visit-firstName" placeholder={t("phFirstName")} value={editForm.firstName} onChange={(e) => setEditField("firstName", e.target.value)} required data-autofocus />
            </Field>
            <Field label={t("lastName")} htmlFor="edit-visit-lastName" required className="sm:col-span-3">
              <Input id="edit-visit-lastName" placeholder={t("phLastName")} value={editForm.lastName} onChange={(e) => setEditField("lastName", e.target.value)} required />
            </Field>
            <Field label={t("phone")} htmlFor="edit-visit-phone" className="sm:col-span-3">
              <Input id="edit-visit-phone" type="tel" placeholder={t("phPhone")} value={editForm.phone} onChange={(e) => setEditField("phone", formatPhone(e.target.value))} />
            </Field>
            <Field label={t("email")} htmlFor="edit-visit-email" className="sm:col-span-3">
              <Input id="edit-visit-email" type="email" placeholder={t("phEmail")} value={editForm.email} onChange={(e) => setEditField("email", e.target.value)} />
            </Field>
            <Field label={t("address")} htmlFor="edit-visit-address" className="sm:col-span-6">
              <Input id="edit-visit-address" placeholder={t("phAddress")} value={editForm.address} onChange={(e) => setEditField("address", e.target.value)} />
            </Field>
            <Field label={t("city")} htmlFor="edit-visit-city" className="sm:col-span-3">
              <Input id="edit-visit-city" placeholder={t("phCity")} value={editForm.city} onChange={(e) => setEditField("city", e.target.value)} />
            </Field>
            <Field label={t("state")} htmlFor="edit-visit-state" className="sm:col-span-1">
              <Input id="edit-visit-state" placeholder={t("phState")} value={editForm.state} onChange={(e) => setEditField("state", e.target.value)} />
            </Field>
            <Field label={t("zip")} htmlFor="edit-visit-zip" className="sm:col-span-2">
              <Input id="edit-visit-zip" inputMode="numeric" placeholder={t("phZip")} value={editForm.zip} onChange={(e) => setEditField("zip", e.target.value)} />
            </Field>
            <Field label={t("reasonForVisit")} htmlFor="edit-visit-service" className="sm:col-span-3">
              <Select id="edit-visit-service" value={editForm.service} onChange={(e) => setEditField("service", e.target.value)}>
                <option value="">{t("pleaseSelect")}</option>
                {services.map((s) => <option key={s.key} value={s.key}>{s[lang] || s.en}</option>)}
              </Select>
            </Field>
            <Field label={t("staffMember")} htmlFor="edit-visit-staff" className="sm:col-span-3">
              <Select id="edit-visit-staff" value={editForm.staff} onChange={(e) => setEditField("staff", e.target.value)}>
                <option value="">{t("pleaseSelect")}</option>
                {staffList.map((s) => <option key={s.key} value={s.key}>{s[lang] || s.en}</option>)}
              </Select>
            </Field>
            {editForm.service === "other" ? (
              <Field label={t("otherPleaseSpecify")} htmlFor="edit-visit-serviceOther" className="sm:col-span-3">
                <Input id="edit-visit-serviceOther" value={editForm.serviceOther} placeholder={t("otherPleaseSpecify")} onChange={(e) => setEditField("serviceOther", e.target.value)} />
              </Field>
            ) : null}
            {editForm.staff === "other" ? (
              <Field label={t("otherPleaseSpecify")} htmlFor="edit-visit-staffOther" className={editForm.service === "other" ? "sm:col-span-3" : "sm:col-span-3 sm:col-start-4"}>
                <Input id="edit-visit-staffOther" value={editForm.staffOther} placeholder={t("otherPleaseSpecify")} onChange={(e) => setEditField("staffOther", e.target.value)} />
              </Field>
            ) : null}
            <Field label={t("notes")} htmlFor="edit-visit-notes" className="sm:col-span-6">
              <Textarea id="edit-visit-notes" placeholder={t("phNotes")} value={editForm.notes} onChange={(e) => setEditField("notes", e.target.value)} />
            </Field>
          </div>
        ) : null}
      </Dialog>

      <Dialog
        open={!!grantTagVisit}
        onClose={() => setGrantTagVisit(null)}
        title={t("tagGrantLabel")}
        description={grantTagVisit ? grantTagVisit.firstName + " " + grantTagVisit.lastName + " · " + fmtDateShort(grantTagVisit.date, lang) : null}
        size="sm"
        closeLabel={t("closeLabel")}
        className="no-print"
        footer={
          <>
            <Button variant="secondary" onClick={() => setGrantTagVisit(null)}>{t("cancelLabel")}</Button>
            <Button onClick={saveGrantTag}>{t("saveLabel")}</Button>
          </>
        }
      >
        <Field label={t("grantLabel")} htmlFor="search-grant-tag">
          <Select id="search-grant-tag" value={pendingGrantId} onChange={(e) => setPendingGrantId(e.target.value)} data-autofocus>
            <option value="">{t("noGrantOption")}</option>
            {grants.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </Select>
        </Field>
      </Dialog>
    </>
  );
}
