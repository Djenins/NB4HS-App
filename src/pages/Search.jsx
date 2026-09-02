// Search.jsx -- Visitor Search, redesigned as a premium CRM-style screen
// (Tailwind/shadcn/Recharts/Lucide, same idiom as the Dashboard.jsx redesign
// pass) while keeping the underlying data/filtering logic unchanged: still
// data.visits filtered by q/service/staff/date, paginated, sorted by most
// recent Time In. Two purely client-side additions ride on top of that same
// filtered list -- a Visit Duration bucket filter and a sortable Visitor/
// Visit Details column header -- neither invents new data, just slices/
// sorts the existing rows differently. "New Visitor" links to the existing
// /checkin/visitor route; Export reuses Reports.jsx's exportCSV/exportExcel.
// Row actions: View opens a read-only detail modal (and Print reuses it via
// window.print()); Edit opens a form modal covering the same contact/
// service/notes fields CheckInVisitor.jsx collects at check-in time (not
// date/timeIn/timeOut -- those are check-in/check-out mechanics, edited
// through their own flows, not a general-purpose field here) and saves via
// checkinData.js's updateVisit().
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Award, ChevronDown, ChevronUp, Clock, Columns3, Copy, DoorOpen, Download,
  Eye, LogIn, MoreHorizontal, Pencil, Printer, RefreshCw, Search as SearchIcon,
  Users, X
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
import { Card, CardContent } from "../components/ui/card.jsx";
import { Badge } from "../components/ui/badge.jsx";
import { Button } from "../components/ui/button.jsx";
import { Avatar, AvatarFallback } from "../components/ui/avatar.jsx";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from "../components/ui/dropdown-menu.jsx";

function Sparkline({ data, color }) {
  if (!data.length) return null;
  const max = Math.max(1, ...data);
  const w = 84, h = 30;
  const step = data.length > 1 ? w / (data.length - 1) : 0;
  const points = data.map((v, i) => [i * step, h - (v / max) * (h - 4) - 2]);
  const path = points.map((p, i) => (i === 0 ? "M" : "L") + p[0].toFixed(1) + "," + p[1].toFixed(1)).join(" ");
  const area = path + ` L${w},${h} L0,${h} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} className="shrink-0">
      {/* style rather than fill/stroke attributes so a var() colour resolves */}
      <path d={area} style={{ fill: color }} opacity="0.14" />
      <path d={path} fill="none" style={{ stroke: color }} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function KpiCard({ icon: Icon, tint, num, label, trend, color, index }) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, delay: index * 0.05 }}>
      <Card>
        <CardContent className="flex items-center gap-3 p-5">
          <div className={"flex h-11 w-11 shrink-0 items-center justify-center rounded-xl " + tint}>
            <Icon className="h-5 w-5" strokeWidth={2} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-semibold leading-tight text-muted">{label}</div>
            <div className="mt-0.5 whitespace-nowrap text-xl font-extrabold tracking-tight text-card-foreground">{num}</div>
          </div>
          <Sparkline data={trend} color={color} />
        </CardContent>
      </Card>
    </motion.div>
  );
}

function StatusBadge({ checkedOut, t }) {
  return checkedOut
    ? <Badge className="gap-1.5 bg-tint-danger text-accent"><span className="h-1.5 w-1.5 rounded-full bg-accent" />{t("checkedOut")}</Badge>
    : <Badge className="gap-1.5 bg-tint-success text-success"><span className="h-1.5 w-1.5 rounded-full bg-success" />{t("inBuilding")}</Badge>;
}

function FilterFieldBox({ label, children, className }) {
  return (
    <div className={"relative min-w-[150px] flex-1 rounded-lg border border-border bg-background px-4 py-2 transition-colors hover:border-[#b7c0d1] " + (className || "")}>
      <div className="text-xs font-medium text-muted">{label}</div>
      {children}
    </div>
  );
}

function FilterFieldSelect({ label, value, onChange, children }) {
  return (
    <FilterFieldBox label={label} className="pr-8">
      <select
        value={value}
        onChange={onChange}
        className="min-h-0 w-full appearance-none bg-none border-0 bg-transparent p-0 text-sm font-semibold text-card-foreground focus:outline-none"
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
    </FilterFieldBox>
  );
}

function SortHeader({ label, sortKey, sort, onSort, className }) {
  const active = sort.key === sortKey;
  return (
    <th className={className}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className="inline-flex min-h-0 items-center gap-1 border-0 bg-transparent p-0 text-inherit hover:text-card-foreground"
      >
        {label}
        {active ? (sort.dir === "asc" ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />) : null}
      </button>
    </th>
  );
}

const AVATAR_COLORS = [
  "bg-violet-100 text-violet-700", "bg-emerald-100 text-emerald-700", "bg-amber-100 text-amber-700",
  "bg-sky-100 text-sky-700", "bg-rose-100 text-rose-700", "bg-teal-100 text-teal-700"
];
function avatarColorFor(str) {
  let h = 0;
  for (let i = 0; i < (str || "").length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
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

  return (
    <>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="mb-1">{t("searchTitle")}</h1>
          <p className="m-0 text-sm text-muted">{t("searchSubtitle")}</p>
        </div>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="secondary" size="lg" className="gap-2">
                <Download className="h-4 w-4" /> {t("exportLabel")} <ChevronDown className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => exportCSV(list, { from: "0000-01-01", to: "9999-12-31" }, data.customServices, data.customStaff, lang)}>
                {t("exportCSV")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => exportExcel(list, { from: "0000-01-01", to: "9999-12-31" }, data.customServices, data.customStaff, lang)}>
                {t("exportExcel")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button size="lg" className="gap-2" onClick={() => navigate("/checkin/visitor")}>
            + {t("newVisitorBtn")}
          </Button>
        </div>
      </div>

      <Card className="mb-5">
        <CardContent className="p-5">
          <form
            className="flex flex-col gap-2 sm:flex-row"
            onSubmit={(e) => { e.preventDefault(); setPage(1); }}
          >
            <div className="relative flex-1">
              <SearchIcon className="pointer-events-none absolute left-4 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-muted" />
              <input
                type="text"
                value={filters.q}
                onChange={(e) => setFilter("q", e.target.value)}
                placeholder={t("searchPlaceholder")}
                className="h-12 min-h-0 w-full rounded-xl border border-border bg-background pl-11 pr-11 text-base focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/15"
              />
              {filters.q ? (
                <button
                  type="button"
                  onClick={() => setFilter("q", "")}
                  className="absolute right-3.5 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full text-muted hover:bg-tint-neutral hover:text-card-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              ) : null}
            </div>
            <Button type="submit" size="lg" className="gap-2 sm:w-auto">
              <SearchIcon className="h-4 w-4" /> {t("searchLabel")}
            </Button>
          </form>

          <div className="mt-4 flex flex-wrap items-stretch gap-2.5">
            <FilterFieldSelect label={t("service")} value={filters.service} onChange={(e) => setFilter("service", e.target.value)}>
              <option value="">{t("allServices")}</option>
              {services.map((s) => <option key={s.key} value={s.key}>{s[lang] || s.en}</option>)}
            </FilterFieldSelect>
            <FilterFieldSelect label={t("staffMember")} value={filters.staff} onChange={(e) => setFilter("staff", e.target.value)}>
              <option value="">{t("allStaff")}</option>
              {staffList.map((s) => <option key={s.key} value={s.key}>{s[lang] || s.en}</option>)}
            </FilterFieldSelect>
            <FilterFieldSelect label={t("statusLabel")} value={filters.status} onChange={(e) => setFilter("status", e.target.value)}>
              <option value="">{t("allStatuses")}</option>
              <option value="in">{t("inBuilding")}</option>
              <option value="out">{t("checkedOut")}</option>
            </FilterFieldSelect>
            <FilterFieldBox label={t("dateRangeLabel")} className="min-w-[260px]">
              <div className="flex items-center gap-1.5 [&_.date-picker]:min-w-0 [&_.date-picker]:flex-1 [&_.date-picker-trigger]:min-h-0 [&_.date-picker-trigger]:w-full [&_.date-picker-trigger]:border-0 [&_.date-picker-trigger]:bg-transparent [&_.date-picker-trigger]:p-0 [&_.date-picker-trigger]:text-sm [&_.date-picker-trigger]:font-semibold [&_.date-picker-trigger_span]:truncate [&_.date-picker-trigger_span]:whitespace-nowrap [&_.date-picker-trigger_svg]:h-3.5 [&_.date-picker-trigger_svg]:w-3.5 [&_.date-picker-trigger_svg]:shrink-0">
                <DatePicker value={filters.from} onChange={(v) => setFilter("from", v)} placeholder={t("filterDateFrom")} />
                <span className="text-muted">–</span>
                <DatePicker value={filters.to} onChange={(v) => setFilter("to", v)} placeholder={t("filterDateTo")} />
              </div>
            </FilterFieldBox>
            <FilterFieldSelect label={t("visitDurationLabel")} value={filters.duration} onChange={(e) => setFilter("duration", e.target.value)}>
              <option value="">{t("allDurations")}</option>
              <option value="u30">{t("durationUnder30")}</option>
              <option value="30to60">{t("duration30to60")}</option>
              <option value="o60">{t("durationOver60")}</option>
            </FilterFieldSelect>
            <button
              type="button"
              onClick={resetFilters}
              className="flex min-w-[130px] items-center justify-center gap-1.5 rounded-lg border border-border bg-background px-4 py-2 text-sm font-semibold text-muted transition-colors hover:border-[#b7c0d1] hover:text-card-foreground"
            >
              {t("clearFilters")} <RefreshCw className="h-3.5 w-3.5" />
            </button>
          </div>
        </CardContent>
      </Card>

      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard icon={Users} tint="bg-primary-tint text-primary" num={stats.todayVisits.length} label={t("todaysVisitors")} trend={trend} color="var(--primary)" index={0} />
        <KpiCard icon={LogIn} tint="bg-tint-success text-success" num={stats.currentlyIn.length} label={t("currentlyInBuilding")} trend={trend} color="var(--success)" index={1} />
        <KpiCard icon={DoorOpen} tint="bg-primary-tint text-primary" num={stats.checkedOutToday.length} label={t("checkedOutToday")} trend={trend} color="var(--primary)" index={2} />
        <KpiCard icon={Clock} tint="bg-tint-warn text-gold-ink" num={fmtDuration(stats.avgLen, lang)} label={t("avgVisitLength")} trend={trend} color="var(--gold-ink)" index={3} />
      </div>

      <Card>
        <CardContent className="p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="text-sm text-muted">
              {t("showingResultsLabel").replace("{shown}", String(rows.length)).replace("{total}", String(list.length))}
            </div>
            <div className="flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="secondary" size="sm" className="gap-1.5">
                    <Columns3 className="h-4 w-4" /> {t("columnsLabel")}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setVisibleCols((c) => ({ ...c, staff: !c.staff }))}>
                    {visibleCols.staff ? "✓ " : ""}{t("staffMember")}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setVisibleCols((c) => ({ ...c, actions: !c.actions }))}>
                    {visibleCols.actions ? "✓ " : ""}{t("actionsCol")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button variant="secondary" size="sm" className="gap-1.5" onClick={() => exportCSV(list, { from: "0000-01-01", to: "9999-12-31" }, data.customServices, data.customStaff, lang)}>
                <Download className="h-4 w-4" /> {t("exportLabel")}
              </Button>
            </div>
          </div>

          {!rows.length ? (
            <div className="empty-state">
              <SearchIcon className="mx-auto mb-2 h-7 w-7 text-muted opacity-70" strokeWidth={1.6} />
              <p>{t("noOneFound")}</p>
            </div>
          ) : (
            <>
              {/* Desktop / tablet table */}
              <div className="hidden overflow-auto rounded-xl border border-border md:block" style={{ maxHeight: "65vh" }}>
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr>
                      <th className="sticky top-0 z-10 bg-card px-3 py-3 shadow-[0_1px_0_var(--border)]">
                        <input type="checkbox" checked={allOnPageSelected} onChange={toggleAllOnPage} aria-label={t("selectAllLabel")} />
                      </th>
                      <SortHeader
                        label={t("visitorName")} sortKey="name" sort={sort} onSort={onSort}
                        className="sticky top-0 z-10 bg-card px-3 py-3 text-left text-sm font-semibold text-muted shadow-[0_1px_0_var(--border)]"
                      />
                      <th className="sticky top-0 z-10 bg-card px-3 py-3 text-left text-sm font-semibold text-muted shadow-[0_1px_0_var(--border)]">{t("visitDetailsCol")}</th>
                      {visibleCols.staff ? (
                        <th className="sticky top-0 z-10 bg-card px-3 py-3 text-left text-sm font-semibold text-muted shadow-[0_1px_0_var(--border)]">{t("staffMember")}</th>
                      ) : null}
                      <th className="sticky top-0 z-10 bg-card px-3 py-3 text-left text-sm font-semibold text-muted shadow-[0_1px_0_var(--border)]">{t("status")}</th>
                      {visibleCols.actions ? (
                        <th className="sticky top-0 z-10 bg-card px-3 py-3 text-left text-sm font-semibold text-muted shadow-[0_1px_0_var(--border)]">{t("actionsCol")}</th>
                      ) : null}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((v) => {
                      const dur = v.timeOut ? fmtDurationShort(minutesBetween(v.timeIn, v.timeOut)) : "—";
                      const name = v.firstName + " " + v.lastName;
                      const staffName = labelFor(staffList, v.staff, lang);
                      return (
                        <tr key={v.id} className="border-t border-border transition-colors hover:bg-background">
                          <td className="px-3 py-3.5 align-top">
                            <input type="checkbox" checked={selected.has(v.id)} onChange={() => toggleRow(v.id)} aria-label={name} />
                          </td>
                          <td className="px-3 py-3.5 align-top">
                            <div className="flex items-center gap-3">
                              <Avatar className="h-9 w-9"><AvatarFallback className={avatarColorFor(name)}>{initialsOf(v)}</AvatarFallback></Avatar>
                              <div className="min-w-0">
                                <div className="truncate font-semibold text-card-foreground">{name}</div>
                                <div className="truncate text-xs text-muted">{formatPhone(v.phone)}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-3.5 align-top">
                            <div className="font-semibold text-card-foreground">{serviceDisplay(v, data.customServices, lang)}</div>
                            <div className="text-xs text-muted">
                              {fmtDateShort(v.date, lang)} · {fmtTime(v.timeIn)} – {v.timeOut ? fmtTime(v.timeOut) : "—"} · {dur}
                            </div>
                            {grantTags[v.id] ? <div className="badge badge-in" style={{ marginTop: 4 }}>{grantNameFor(grantTags[v.id])}</div> : null}
                          </td>
                          {visibleCols.staff ? (
                            <td className="px-3 py-3.5 align-top">
                              <div className="flex items-center gap-2.5">
                                <Avatar className="h-8 w-8"><AvatarFallback className={avatarColorFor(staffName)}>{staffName.slice(0, 2).toUpperCase()}</AvatarFallback></Avatar>
                                <div className="min-w-0 text-sm font-medium text-card-foreground">{staffName}</div>
                              </div>
                            </td>
                          ) : null}
                          <td className="px-3 py-3.5 align-top"><StatusBadge checkedOut={!!v.timeOut} t={t} /></td>
                          {visibleCols.actions ? (
                            <td className="px-3 py-3.5 align-top">
                              <div className="flex items-center gap-1">
                                <button title={t("viewDetails")} onClick={() => setDetailVisit(v)} className="flex h-8 w-8 min-h-0 items-center justify-center rounded-lg border-0 bg-transparent p-0 text-muted hover:bg-background hover:text-card-foreground"><Eye className="h-4 w-4" /></button>
                                <button title={t("editVisit")} onClick={() => openEditVisit(v)} className="flex h-8 w-8 min-h-0 items-center justify-center rounded-lg border-0 bg-transparent p-0 text-muted hover:bg-background hover:text-card-foreground"><Pencil className="h-4 w-4" /></button>
                                <button title={t("printVisit")} onClick={() => handlePrint(v)} className="flex h-8 w-8 min-h-0 items-center justify-center rounded-lg border-0 bg-transparent p-0 text-muted hover:bg-background hover:text-card-foreground"><Printer className="h-4 w-4" /></button>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <button title={t("moreActions")} className="flex h-8 w-8 min-h-0 items-center justify-center rounded-lg border-0 bg-transparent p-0 text-muted hover:bg-background hover:text-card-foreground"><MoreHorizontal className="h-4 w-4" /></button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={() => handleCopyPhone(v.phone)}><Copy className="mr-2 h-3.5 w-3.5" />{t("copyPhone")}</DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handlePrint(v)}><Printer className="mr-2 h-3.5 w-3.5" />{t("printVisit")}</DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => openGrantTag(v)}><Award className="mr-2 h-3.5 w-3.5" />Tag Grant</DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            </td>
                          ) : null}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile: one card per visitor */}
              <div className="space-y-3 md:hidden">
                {rows.map((v) => {
                  const dur = v.timeOut ? fmtDurationShort(minutesBetween(v.timeIn, v.timeOut)) : "—";
                  const name = v.firstName + " " + v.lastName;
                  return (
                    <div key={v.id} className="rounded-2xl border border-border p-4">
                      <div className="mb-3 flex items-start justify-between gap-2">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10"><AvatarFallback className={avatarColorFor(name)}>{initialsOf(v)}</AvatarFallback></Avatar>
                          <div>
                            <div className="font-semibold text-card-foreground">{name}</div>
                            <div className="text-xs text-muted">{formatPhone(v.phone)}</div>
                          </div>
                        </div>
                        <StatusBadge checkedOut={!!v.timeOut} t={t} />
                      </div>
                      <div className="mb-3 text-sm">
                        <div className="font-semibold text-card-foreground">{serviceDisplay(v, data.customServices, lang)}</div>
                        <div className="text-xs text-muted">{fmtDateShort(v.date, lang)} · {fmtTime(v.timeIn)} – {v.timeOut ? fmtTime(v.timeOut) : "—"} · {dur}</div>
                        <div className="mt-1 text-xs text-muted">{t("staffMember")}: {labelFor(staffList, v.staff, lang)}</div>
                        {grantTags[v.id] ? <div className="badge badge-in" style={{ marginTop: 4 }}>{grantNameFor(grantTags[v.id])}</div> : null}
                      </div>
                      <div className="flex items-center gap-1 border-t border-border pt-2">
                        <button title={t("viewDetails")} onClick={() => setDetailVisit(v)} className="flex h-8 w-8 min-h-0 items-center justify-center rounded-lg border-0 bg-transparent p-0 text-muted hover:bg-background hover:text-card-foreground"><Eye className="h-4 w-4" /></button>
                        <button title={t("editVisit")} onClick={() => openEditVisit(v)} className="flex h-8 w-8 min-h-0 items-center justify-center rounded-lg border-0 bg-transparent p-0 text-muted hover:bg-background hover:text-card-foreground"><Pencil className="h-4 w-4" /></button>
                        <button title={t("printVisit")} onClick={() => handlePrint(v)} className="flex h-8 w-8 min-h-0 items-center justify-center rounded-lg border-0 bg-transparent p-0 text-muted hover:bg-background hover:text-card-foreground"><Printer className="h-4 w-4" /></button>
                        <button title="Tag Grant" onClick={() => openGrantTag(v)} className="flex h-8 w-8 min-h-0 items-center justify-center rounded-lg border-0 bg-transparent p-0 text-muted hover:bg-background hover:text-card-foreground"><Award className="h-4 w-4" /></button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          <Pagination
            page={safePage} totalPages={totalPages} total={list.length} pageSize={pageSize}
            onPageSizeChange={(n) => { setPageSize(n); setPage(1); }} itemLabel={t("itemLabelVisitors")}
            onChange={(delta) => setPage(safePage + delta)}
          />
        </CardContent>
      </Card>

      {detailVisit ? (
        <div className="modal-overlay no-print" onClick={(e) => { if (e.target === e.currentTarget) setDetailVisit(null); }}>
          <div className="modal-box" style={{ maxWidth: 480 }}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="m-0">{t("visitDetailsModalTitle")}</h3>
              <button onClick={() => setDetailVisit(null)} className="flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-background"><X className="h-4 w-4" /></button>
            </div>
            <div className="mb-4 flex items-center gap-3">
              <Avatar className="h-11 w-11"><AvatarFallback>{initialsOf(detailVisit)}</AvatarFallback></Avatar>
              <div>
                <div className="font-bold text-card-foreground">{detailVisit.firstName} {detailVisit.lastName}</div>
                <div className="text-sm text-muted">{formatPhone(detailVisit.phone)}</div>
              </div>
              <div className="ml-auto"><StatusBadge checkedOut={!!detailVisit.timeOut} t={t} /></div>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between border-b border-border pb-2"><span className="text-muted">{t("service")}</span><span className="font-semibold">{serviceDisplay(detailVisit, data.customServices, lang)}</span></div>
              <div className="flex justify-between border-b border-border pb-2"><span className="text-muted">{t("date")}</span><span className="font-semibold">{detailVisit.date}</span></div>
              <div className="flex justify-between border-b border-border pb-2"><span className="text-muted">{t("timeIn")}</span><span className="font-semibold">{fmtTime(detailVisit.timeIn)}</span></div>
              <div className="flex justify-between border-b border-border pb-2"><span className="text-muted">{t("timeOut")}</span><span className="font-semibold">{detailVisit.timeOut ? fmtTime(detailVisit.timeOut) : "—"}</span></div>
              <div className="flex justify-between border-b border-border pb-2"><span className="text-muted">{t("visitLength")}</span><span className="font-semibold">{detailVisit.timeOut ? fmtDuration(minutesBetween(detailVisit.timeIn, detailVisit.timeOut), lang) : "—"}</span></div>
              <div className="flex justify-between"><span className="text-muted">{t("staffMember")}</span><span className="font-semibold">{labelFor(staffList, detailVisit.staff, lang)}</span></div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => window.print()} className="gap-2"><Printer className="h-4 w-4" />{t("printVisit")}</Button>
              <Button onClick={() => setDetailVisit(null)}>{t("closeLabel")}</Button>
            </div>
          </div>
        </div>
      ) : null}

      {editVisit && editForm ? (
        <div className="modal-overlay no-print" onClick={(e) => { if (e.target === e.currentTarget) closeEditVisit(); }}>
          <div className="modal-box" style={{ maxWidth: 560 }}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="m-0">{t("editVisitModalTitle")}</h3>
              <button onClick={closeEditVisit} className="flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-background"><X className="h-4 w-4" /></button>
            </div>
            <form onSubmit={(e) => { e.preventDefault(); saveEditVisit(); }}>
              <div className="grid grid-2">
                <div className="field">
                  <label className="required" htmlFor="edit-visit-firstName">{t("firstName")}</label>
                  <input id="edit-visit-firstName" value={editForm.firstName} onChange={(e) => setEditField("firstName", e.target.value)} required />
                </div>
                <div className="field">
                  <label className="required" htmlFor="edit-visit-lastName">{t("lastName")}</label>
                  <input id="edit-visit-lastName" value={editForm.lastName} onChange={(e) => setEditField("lastName", e.target.value)} required />
                </div>
              </div>
              <div className="grid grid-2">
                <div className="field">
                  <label htmlFor="edit-visit-phone">{t("phone")}</label>
                  <input id="edit-visit-phone" type="tel" value={editForm.phone} onChange={(e) => setEditField("phone", formatPhone(e.target.value))} />
                </div>
                <div className="field">
                  <label htmlFor="edit-visit-email">{t("email")}</label>
                  <input id="edit-visit-email" type="email" value={editForm.email} onChange={(e) => setEditField("email", e.target.value)} />
                </div>
              </div>
              <div className="field">
                <label htmlFor="edit-visit-address">{t("address")}</label>
                <input id="edit-visit-address" value={editForm.address} onChange={(e) => setEditField("address", e.target.value)} />
              </div>
              <div className="grid grid-3">
                <div className="field">
                  <label htmlFor="edit-visit-city">{t("city")}</label>
                  <input id="edit-visit-city" value={editForm.city} onChange={(e) => setEditField("city", e.target.value)} />
                </div>
                <div className="field">
                  <label htmlFor="edit-visit-state">{t("state")}</label>
                  <input id="edit-visit-state" value={editForm.state} onChange={(e) => setEditField("state", e.target.value)} />
                </div>
                <div className="field">
                  <label htmlFor="edit-visit-zip">{t("zip")}</label>
                  <input id="edit-visit-zip" value={editForm.zip} onChange={(e) => setEditField("zip", e.target.value)} />
                </div>
              </div>
              <div className="field">
                <label htmlFor="edit-visit-service">{t("reasonForVisit")}</label>
                <select id="edit-visit-service" value={editForm.service} onChange={(e) => setEditField("service", e.target.value)}>
                  <option value="">{t("pleaseSelect")}</option>
                  {services.map((s) => <option key={s.key} value={s.key}>{s[lang] || s.en}</option>)}
                </select>
              </div>
              {editForm.service === "other" && (
                <div className="field">
                  <input value={editForm.serviceOther} placeholder={t("otherPleaseSpecify")} aria-label={t("otherPleaseSpecify")} onChange={(e) => setEditField("serviceOther", e.target.value)} />
                </div>
              )}
              <div className="field">
                <label htmlFor="edit-visit-staff">{t("staffMember")}</label>
                <select id="edit-visit-staff" value={editForm.staff} onChange={(e) => setEditField("staff", e.target.value)}>
                  <option value="">{t("pleaseSelect")}</option>
                  {staffList.map((s) => <option key={s.key} value={s.key}>{s[lang] || s.en}</option>)}
                </select>
              </div>
              {editForm.staff === "other" && (
                <div className="field">
                  <input value={editForm.staffOther} placeholder={t("otherPleaseSpecify")} aria-label={t("otherPleaseSpecify")} onChange={(e) => setEditField("staffOther", e.target.value)} />
                </div>
              )}
              <div className="field">
                <label htmlFor="edit-visit-notes">{t("notes")}</label>
                <textarea id="edit-visit-notes" value={editForm.notes} onChange={(e) => setEditField("notes", e.target.value)} />
              </div>
              <div className="mt-5 flex justify-end gap-2">
                <Button type="button" variant="secondary" onClick={closeEditVisit}>{t("cancelLabel")}</Button>
                <Button type="submit" disabled={!editForm.firstName.trim() || !editForm.lastName.trim() || savingEdit}>{t("saveLabel")}</Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {grantTagVisit ? (
        <div className="modal-overlay no-print" onClick={(e) => { if (e.target === e.currentTarget) setGrantTagVisit(null); }}>
          <div className="modal-box" style={{ maxWidth: 420 }}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="m-0">Tag Grant</h3>
              <button onClick={() => setGrantTagVisit(null)} className="flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-background"><X className="h-4 w-4" /></button>
            </div>
            <p className="muted" style={{ marginTop: 0 }}>{grantTagVisit.firstName} {grantTagVisit.lastName} · {fmtDateShort(grantTagVisit.date, lang)}</p>
            <div className="field">
              <label>Grant</label>
              <select aria-label="Grant" value={pendingGrantId} onChange={(e) => setPendingGrantId(e.target.value)}>
                <option value="">No grant</option>
                {grants.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setGrantTagVisit(null)}>{t("closeLabel")}</Button>
              <Button onClick={saveGrantTag}>Save</Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
