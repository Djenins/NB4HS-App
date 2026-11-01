// ClientMessages.jsx -- the Communications module's Messages section: texts
// and emails queued for clients, with where each one stands.
//
// Statuses are the queue's own (outbound_messages): "queued" until the
// send-outbound function picks it up, "sent" once the provider accepted it
// (accepted, never shown as "delivered"), "failed" after five tries,
// "cancelled" if staff stopped it first. When a channel has messages that
// have waited longer than one send cycle, the page says plainly that the
// provider isn't connected yet instead of leaving them looking stuck.
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Mail, MessageSquareText, Send, XCircle } from "lucide-react";
import { useApp, useT } from "../../context/AppContext.jsx";
import {
  MESSAGE_CHANNELS, MESSAGE_STATUSES, cancelClientMessage, clientName, fetchClientMessages, fetchMessagingHealth
} from "../../lib/communications.js";
import { paginateList } from "../../lib/pagination.js";
import { dateStrFromDate, fmtDateLong, fmtTime } from "../../lib/utils.js";
import Pagination from "../Pagination.jsx";
import { Alert } from "../ui/alert.jsx";
import { Badge } from "../ui/badge.jsx";
import { Button } from "../ui/button.jsx";
import { DataTable } from "../ui/data-table.jsx";
import { EmptyState } from "../ui/empty-state.jsx";
import { Select } from "../ui/field.jsx";
import { FilterBar, FilterField } from "../ui/filter-bar.jsx";
import { PageHeader } from "../ui/page-header.jsx";
import { SearchInput } from "../ui/search-input.jsx";
import { StatusBadge } from "../ui/status-badge.jsx";
import SendMessageDialog, { CHANNEL_KEY } from "./SendMessageDialog.jsx";

const STALE_MINUTES = 15;

function fmtWhen(iso, lang) {
  return iso ? fmtDateLong(dateStrFromDate(new Date(iso)), lang) + " · " + fmtTime(iso) : "—";
}

export default function ClientMessages() {
  const { data, lang, can, session, requestConfirm, showToast } = useApp();
  const t = useT();
  const [messages, setMessages] = useState(null);
  const [health, setHealth] = useState([]);
  const [loadError, setLoadError] = useState(false);
  const [q, setQ] = useState("");
  const [channel, setChannel] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [composing, setComposing] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const canSend = can("communications.messages.send");
  const canManage = can("communications.templates.manage");
  const myId = session ? session.id : null;

  function load() {
    setLoadError(false);
    fetchMessagingHealth().then(setHealth);
    return fetchClientMessages(null).then(setMessages).catch((err) => {
      console.warn("fetchClientMessages failed", err);
      setLoadError(true);
    });
  }
  useEffect(() => { load(); }, []);

  const clientsById = useMemo(() => {
    const out = {};
    (data.clients || []).forEach((c) => { out[c.id] = c; });
    return out;
  }, [data.clients]);

  const term = q.trim().toLowerCase();
  const matched = (messages || []).filter((m) => {
    if (channel && m.channel !== channel) return false;
    if (status && m.status !== status) return false;
    if (!term) return true;
    const c = clientsById[m.clientId];
    return (clientName(c) + " " + (c ? c.nbId : "") + " " + m.toAddress + " " + m.subject + " " + m.body + " " + m.queuedByName)
      .toLowerCase().indexOf(term) !== -1;
  });
  const paged = paginateList(matched, page, pageSize);
  const stale = health.filter((h) => h.queued > 0 && h.oldestQueuedAt && Date.now() - new Date(h.oldestQueuedAt).getTime() > STALE_MINUTES * 60000);

  async function cancel(m) {
    if (!(await requestConfirm(t("commsCancelConfirm"), { danger: true }))) return;
    setBusyId(m.id);
    try {
      await cancelClientMessage(m.id);
      showToast(t("commsCancelledToast"));
      await load();
    } catch (err) {
      console.warn("cancelClientMessage failed", err);
      showToast(t("userActionError"));
    } finally {
      setBusyId(null);
    }
  }

  function clientCell(m) {
    const c = clientsById[m.clientId];
    if (!c) return <span className="text-muted">{t("commsUnknownClient")}</span>;
    return <Link to={"/clients/" + c.nbId} className="font-semibold text-card-foreground underline-offset-2 hover:underline">{clientName(c) || c.nbId}</Link>;
  }
  function statusCell(m) {
    return (
      <span className="flex flex-col items-start gap-1">
        <StatusBadge domain="message" status={m.status}>{t("commsStatus_" + m.status)}</StatusBadge>
        {m.status === "failed" && m.lastError ? <span className="max-w-[28ch] truncate text-meta text-muted" title={m.lastError}>{m.lastError}</span> : null}
      </span>
    );
  }
  function actionCell(m) {
    const mayCancel = m.status === "queued" && ((canSend && m.queuedBy === myId) || canManage);
    if (!mayCancel) return null;
    return (
      <Button size="sm" variant="ghost" loading={busyId === m.id} onClick={() => cancel(m)}>
        <XCircle className="h-4 w-4" aria-hidden="true" /> {t("commsCancelMessage")}
      </Button>
    );
  }
  const ChannelIcon = ({ c }) => (c === "sms" ? <MessageSquareText className="h-4 w-4" aria-hidden="true" /> : <Mail className="h-4 w-4" aria-hidden="true" />);

  const columns = [
    { key: "when", header: t("commsQueuedAtLabel"), className: "whitespace-nowrap", cell: (m) => fmtWhen(m.createdAt, lang) },
    { key: "client", header: t("commsClientLabel"), cell: clientCell },
    {
      key: "to", header: t("commsChannelLabel"),
      cell: (m) => (
        <span className="flex flex-col">
          <span className="inline-flex items-center gap-1.5"><ChannelIcon c={m.channel} /> {t(CHANNEL_KEY[m.channel])}</span>
          <span className="text-meta tabular-nums text-muted">{m.toAddress}</span>
        </span>
      )
    },
    {
      key: "message", header: t("commsMessageLabel"),
      cell: (m) => (
        <span className="flex max-w-[48ch] flex-col">
          {m.subject ? <span className="truncate font-semibold">{m.subject}</span> : null}
          <span className="line-clamp-2 whitespace-pre-wrap text-muted">{m.body}</span>
        </span>
      )
    },
    { key: "by", header: t("commsSentByLabel"), cell: (m) => m.queuedByName || "—" },
    { key: "status", header: t("statusLabel"), cell: statusCell },
    { key: "actions", header: <span className="sr-only">{t("actionsLabel")}</span>, cell: actionCell }
  ];

  function renderCard(m) {
    return (
      <div className="flex flex-col gap-1.5 rounded-control border border-border bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          {clientCell(m)}
          {statusCell(m)}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-meta text-muted">
          <Badge variant="neutral"><ChannelIcon c={m.channel} /> {t(CHANNEL_KEY[m.channel])}</Badge>
          <span className="tabular-nums">{m.toAddress}</span>
          <span className="tabular-nums">{fmtWhen(m.createdAt, lang)}</span>
        </div>
        {m.subject ? <p className="m-0 font-semibold text-card-foreground">{m.subject}</p> : null}
        <p className="m-0 line-clamp-3 whitespace-pre-wrap text-body text-card-foreground">{m.body}</p>
        {actionCell(m)}
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title={t("commsMessagesTitle")}
        description={t("commsMessagesDesc")}
        actions={canSend ? (
          <Button onClick={() => setComposing(true)}><Send className="h-4 w-4" aria-hidden="true" /> {t("commsSendMessageBtn")}</Button>
        ) : null}
      />

      {stale.length ? (
        <Alert tone="warning" title={t("commsNotSendingTitle")} className="mb-6">
          {stale.map((h) => (
            <p key={h.channel} className="m-0">
              {t(h.channel === "sms" ? "commsNotSendingSms" : "commsNotSendingEmail").replace("{n}", h.queued)}
            </p>
          ))}
        </Alert>
      ) : null}

      {loadError ? (
        <EmptyState variant="error" title={t("commsLoadErrorTitle")} description={t("commsLoadErrorDesc")}
          action={<Button variant="secondary" onClick={load}>{t("retryLabel")}</Button>} />
      ) : (
        <>
          <FilterBar
            search={
              <SearchInput value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} onClear={() => { setQ(""); setPage(1); }}
                clearLabel={t("clearLabel")} placeholder={t("commsMessagesSearchPlaceholder")} aria-label={t("commsMessagesSearchPlaceholder")} />
            }
            activeCount={[channel, status].filter(Boolean).length}
            canClear={!!(channel || status || q)}
            onClear={() => { setQ(""); setChannel(""); setStatus(""); setPage(1); }}
            clearLabel={t("clearAllLabel")}
            filtersLabel={t("filtersLabel")}
          >
            <FilterField label={t("commsChannelLabel")} htmlFor="msg-f-channel">
              <Select id="msg-f-channel" value={channel} onChange={(e) => { setChannel(e.target.value); setPage(1); }}>
                <option value="">{t("anyLabel")}</option>
                {MESSAGE_CHANNELS.map((c) => <option key={c} value={c}>{t(CHANNEL_KEY[c])}</option>)}
              </Select>
            </FilterField>
            <FilterField label={t("statusLabel")} htmlFor="msg-f-status">
              <Select id="msg-f-status" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
                <option value="">{t("anyLabel")}</option>
                {MESSAGE_STATUSES.map((s) => <option key={s} value={s}>{t("commsStatus_" + s)}</option>)}
              </Select>
            </FilterField>
          </FilterBar>

          <div className="mt-6">
            <DataTable
              columns={columns}
              rows={paged.items}
              getRowId={(m) => m.id}
              renderCard={renderCard}
              loading={messages === null}
              caption={t("commsMessagesTitle")}
              maxHeight="none"
              empty={
                (messages || []).length === 0
                  ? <EmptyState icon={Send} title={t("commsMessagesEmptyTitle")} description={t("commsMessagesEmptyDesc")}
                      action={canSend ? <Button onClick={() => setComposing(true)}><Send className="h-4 w-4" aria-hidden="true" /> {t("commsSendMessageBtn")}</Button> : null} />
                  : <EmptyState variant="no-results" title={t("commsLogNoMatchTitle")} description={t("commsLogNoMatchDesc")} />
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

      {composing ? (
        <SendMessageDialog
          onCancel={() => setComposing(false)}
          onSent={() => { setComposing(false); showToast(t("commsQueuedToast")); load(); }}
        />
      ) : null}
    </>
  );
}
