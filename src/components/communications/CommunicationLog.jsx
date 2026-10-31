// CommunicationLog.jsx -- the Communications module's Log section: every
// call, text, email and visit logged for any client, newest first, with the
// follow-ups still waiting on someone counted at the top.
//
// The list template from the design system: KPI row, FilterBar, DataTable
// (stacked cards on phones), Pagination. Rows link to the client profile,
// where the same entries appear on the Communications tab. A follow-up is
// closed (or reopened) from its row; nothing else on a log entry changes
// after it's written.
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CheckCheck, Inbox, MessageCircle, MessageSquarePlus, PhoneIncoming, Plus, RotateCcw, Send } from "lucide-react";
import { useApp, useT } from "../../context/AppContext.jsx";
import {
  LOG_DIRECTIONS, LOG_METHODS, clientName, fetchCommunicationLog, filterLog, isOpenFollowUp, logCommunication,
  logSummaryCounts, setFollowUpDone
} from "../../lib/communications.js";
import { paginateList } from "../../lib/pagination.js";
import { fmtDateLong, todayStr } from "../../lib/utils.js";
import Pagination from "../Pagination.jsx";
import { Badge } from "../ui/badge.jsx";
import { Button } from "../ui/button.jsx";
import { DataTable } from "../ui/data-table.jsx";
import { EmptyState } from "../ui/empty-state.jsx";
import { Select } from "../ui/field.jsx";
import { FilterBar, FilterField } from "../ui/filter-bar.jsx";
import { KpiCard } from "../ui/kpi-card.jsx";
import { PageHeader } from "../ui/page-header.jsx";
import { SearchInput } from "../ui/search-input.jsx";
import { StatusBadge } from "../ui/status-badge.jsx";
import LogCommunicationDialog, { COMM_DIRECTION_KEY, COMM_METHOD_KEY } from "./LogCommunicationDialog.jsx";
import SendMessageDialog from "./SendMessageDialog.jsx";

const NO_FILTERS = { q: "", method: "", direction: "", staff: "", followUp: "", days: "" };

function FollowUpCell({ entry, canClose, busy, onToggle }) {
  const t = useT();
  if (!entry.followUpRequired) return <span className="text-muted">—</span>;
  if (!isOpenFollowUp(entry)) {
    return (
      <div className="flex flex-wrap items-center gap-1.5">
        <StatusBadge domain="communication" status="followupDone">{t("commsFollowUpDone")}</StatusBadge>
        {canClose ? <Button size="sm" variant="ghost" loading={busy} onClick={() => onToggle(entry, false)}>{t("commsReopen")}</Button> : null}
      </div>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <StatusBadge domain="communication" status="followup">{t("commsFollowUpOpen")}</StatusBadge>
      {canClose ? (
        <Button size="sm" variant="secondary" loading={busy} onClick={() => onToggle(entry, true)}>
          <CheckCheck className="h-4 w-4" aria-hidden="true" /> {t("commsMarkDone")}
        </Button>
      ) : null}
    </div>
  );
}

export default function CommunicationLog() {
  const { data, lang, can, showToast } = useApp();
  const t = useT();
  const [entries, setEntries] = useState(null);
  const [loadError, setLoadError] = useState(false);
  const [filters, setFilters] = useState(NO_FILTERS);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [logging, setLogging] = useState(false);
  const [composing, setComposing] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const canLog = can("participants.notes.create");
  const canSend = can("communications.messages.send");
  const today = todayStr();

  function load() {
    setLoadError(false);
    return fetchCommunicationLog().then(setEntries).catch((err) => {
      console.warn("fetchCommunicationLog failed", err);
      setLoadError(true);
    });
  }
  useEffect(() => { load(); }, []);

  const clientsById = useMemo(() => {
    const out = {};
    (data.clients || []).forEach((c) => { out[c.id] = c; });
    return out;
  }, [data.clients]);

  const all = entries || [];
  const counts = logSummaryCounts(all, today);
  const staffNames = Array.from(new Set(all.map((e) => e.staffName).filter(Boolean))).sort();
  const matched = filterLog(all, filters, clientsById, today);
  const paged = paginateList(matched, page, pageSize);
  const activeCount = ["method", "direction", "staff", "followUp", "days"].filter((k) => filters[k]).length;

  function setFilter(name, value) {
    setFilters((prev) => Object.assign({}, prev, { [name]: value }));
    setPage(1);
  }

  async function toggleFollowUp(entry, done) {
    setBusyId(entry.id);
    try {
      await setFollowUpDone(entry.id, done);
      await load();
      showToast(t(done ? "commsFollowUpClosedToast" : "commsFollowUpReopenedToast"));
    } catch (err) {
      console.warn("setFollowUpDone failed", err);
      showToast(t("userActionError"));
    } finally {
      setBusyId(null);
    }
  }

  async function saveLog(client, fields) {
    await logCommunication(client.id, fields);
    setLogging(false);
    showToast(t("commsLoggedToast"));
    load();
  }

  function clientCell(e) {
    const c = clientsById[e.clientId];
    if (!c) return <span className="text-muted">{t("commsUnknownClient")}</span>;
    return (
      <Link to={"/clients/" + c.nbId} className="font-semibold text-card-foreground underline-offset-2 hover:underline">
        {clientName(c) || c.nbId}
      </Link>
    );
  }

  const columns = [
    { key: "date", header: t("commsDateLabel"), className: "whitespace-nowrap", cell: (e) => fmtDateLong(e.date, lang) },
    { key: "client", header: t("commsClientLabel"), cell: clientCell },
    {
      key: "how", header: t("communicationMethodLabel"), className: "whitespace-nowrap",
      cell: (e) => (
        <span className="flex flex-col">
          <span>{t(COMM_METHOD_KEY[e.method] || "methodPhone")}</span>
          <span className="text-meta text-muted">{t(COMM_DIRECTION_KEY[e.direction] || "directionOutbound")}</span>
        </span>
      )
    },
    { key: "summary", header: t("communicationSummaryLabel"), cell: (e) => <span className="line-clamp-2 max-w-[48ch] whitespace-pre-wrap">{e.summary}</span> },
    { key: "staff", header: t("commsStaffLabel"), cell: (e) => e.staffName || "—" },
    {
      key: "followUp", header: t("commsFollowUpLabel"),
      cell: (e) => <FollowUpCell entry={e} canClose={canLog} busy={busyId === e.id} onToggle={toggleFollowUp} />
    }
  ];

  function renderCard(e) {
    return (
      <div className="flex flex-col gap-1.5 rounded-control border border-border bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          {clientCell(e)}
          <span className="text-meta tabular-nums text-muted">{fmtDateLong(e.date, lang)}</span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="neutral">{t(COMM_METHOD_KEY[e.method] || "methodPhone")}</Badge>
          <Badge variant="neutral">{t(COMM_DIRECTION_KEY[e.direction] || "directionOutbound")}</Badge>
          {e.staffName ? <span className="text-meta text-muted">{e.staffName}</span> : null}
        </div>
        <p className="m-0 line-clamp-3 whitespace-pre-wrap text-body text-card-foreground">{e.summary}</p>
        {e.followUpRequired ? <FollowUpCell entry={e} canClose={canLog} busy={busyId === e.id} onToggle={toggleFollowUp} /> : null}
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title={t("commsLogTitle")}
        description={t("commsLogDesc")}
        actions={
          <>
            {canSend ? (
              <Button variant="secondary" onClick={() => setComposing(true)}>
                <Send className="h-4 w-4" aria-hidden="true" /> {t("commsSendMessageBtn")}
              </Button>
            ) : null}
            {canLog ? (
              <Button onClick={() => setLogging(true)}>
                <Plus className="h-4 w-4" aria-hidden="true" /> {t("logCommunicationBtn")}
              </Button>
            ) : null}
          </>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {/* Red stays for overdue work; open follow-ups are a to-do, so amber. */}
        <KpiCard label={t("commsKpiOpenFollowUps")} value={entries ? counts.openFollowUps : "–"} icon={MessageSquarePlus}
          tone={counts.openFollowUps ? "warning" : "neutral"} hint={t("commsKpiOpenFollowUpsHint")}
          pressed={filters.followUp === "open"} onClick={() => setFilter("followUp", filters.followUp === "open" ? "" : "open")} />
        <KpiCard label={t("commsKpiLastWeek")} value={entries ? counts.lastWeek : "–"} icon={MessageCircle} tone="info" hint={t("commsKpiLastWeekHint")} />
        <KpiCard label={t("commsKpiInbound")} value={entries ? counts.inbound : "–"} icon={PhoneIncoming} tone="violet" hint={t("commsKpiInboundHint")} />
        <KpiCard label={t("commsKpiTotal")} value={entries ? counts.total : "–"} icon={Inbox} tone="neutral" hint={t("commsKpiTotalHint")} />
      </div>

      {loadError ? (
        <EmptyState variant="error" title={t("commsLoadErrorTitle")} description={t("commsLoadErrorDesc")}
          action={<Button variant="secondary" onClick={load}>{t("retryLabel")}</Button>} />
      ) : (
        <>
          <FilterBar
            search={
              <SearchInput value={filters.q} onChange={(e) => setFilter("q", e.target.value)} onClear={() => setFilter("q", "")}
                clearLabel={t("clearLabel")} placeholder={t("commsLogSearchPlaceholder")} aria-label={t("commsLogSearchPlaceholder")} />
            }
            activeCount={activeCount}
            canClear={activeCount > 0 || !!filters.q}
            onClear={() => { setFilters(NO_FILTERS); setPage(1); }}
            clearLabel={t("clearAllLabel")}
            filtersLabel={t("filtersLabel")}
          >
            <FilterField label={t("communicationMethodLabel")} htmlFor="log-method">
              <Select id="log-method" value={filters.method} onChange={(e) => setFilter("method", e.target.value)}>
                <option value="">{t("anyLabel")}</option>
                {LOG_METHODS.map((m) => <option key={m} value={m}>{t(COMM_METHOD_KEY[m])}</option>)}
              </Select>
            </FilterField>
            <FilterField label={t("communicationDirectionLabel")} htmlFor="log-direction">
              <Select id="log-direction" value={filters.direction} onChange={(e) => setFilter("direction", e.target.value)}>
                <option value="">{t("anyLabel")}</option>
                {LOG_DIRECTIONS.map((d) => <option key={d} value={d}>{t(COMM_DIRECTION_KEY[d])}</option>)}
              </Select>
            </FilterField>
            <FilterField label={t("commsStaffLabel")} htmlFor="log-staff">
              <Select id="log-staff" value={filters.staff} onChange={(e) => setFilter("staff", e.target.value)}>
                <option value="">{t("anyLabel")}</option>
                {staffNames.map((n) => <option key={n} value={n}>{n}</option>)}
              </Select>
            </FilterField>
            <FilterField label={t("commsFollowUpLabel")} htmlFor="log-followup">
              <Select id="log-followup" value={filters.followUp} onChange={(e) => setFilter("followUp", e.target.value)}>
                <option value="">{t("anyLabel")}</option>
                <option value="open">{t("commsFollowUpOpen")}</option>
                <option value="done">{t("commsFollowUpDone")}</option>
              </Select>
            </FilterField>
            <FilterField label={t("commsDateLabel")} htmlFor="log-days">
              <Select id="log-days" value={filters.days} onChange={(e) => setFilter("days", e.target.value)}>
                <option value="">{t("anyTimeLabel")}</option>
                <option value="7">{t("last7DaysLabel")}</option>
                <option value="30">{t("last30DaysLabel")}</option>
                <option value="90">{t("last90DaysLabel")}</option>
              </Select>
            </FilterField>
          </FilterBar>

          <div className="mt-6">
            <DataTable
              columns={columns}
              rows={paged.items}
              getRowId={(e) => e.id}
              renderCard={renderCard}
              loading={entries === null}
              caption={t("commsLogTitle")}
              maxHeight="none"
              empty={
                all.length === 0 ? (
                  <EmptyState icon={MessageCircle} title={t("commsLogEmptyTitle")} description={t("commsLogEmptyDesc")}
                    action={canLog ? <Button onClick={() => setLogging(true)}><Plus className="h-4 w-4" aria-hidden="true" /> {t("logCommunicationBtn")}</Button> : null} />
                ) : (
                  <EmptyState variant="no-results" title={t("commsLogNoMatchTitle")} description={t("commsLogNoMatchDesc")}
                    action={<Button variant="secondary" onClick={() => { setFilters(NO_FILTERS); setPage(1); }}><RotateCcw className="h-4 w-4" aria-hidden="true" /> {t("clearAllLabel")}</Button>} />
                )
              }
            />
            {matched.length > 0 ? (
              <Pagination
                bare page={paged.page} totalPages={paged.totalPages} total={paged.total} pageSize={paged.pageSize}
                onPageSizeChange={(n) => { setPageSize(n); setPage(1); }} itemLabel={t("resultsLabel")}
                onChange={(delta) => setPage(paged.page + delta)}
              />
            ) : null}
          </div>
        </>
      )}

      {logging ? <LogCommunicationDialog onSave={saveLog} onCancel={() => setLogging(false)} /> : null}
      {composing ? (
        <SendMessageDialog
          onCancel={() => setComposing(false)}
          onSent={() => { setComposing(false); showToast(t("commsQueuedToast")); load(); }}
        />
      ) : null}
    </>
  );
}
