// AdminAudit.jsx -- the Access Audit Log (/admin/audit; plans/unified-access-
// architecture.md §6): who changed accounts, roles, permissions, program
// access, modules and settings, about whom, when and why, with the
// before -> after values. Read-only, newest first, filtered on the server.
// Only access and account tables are listed: participant records keep
// field names only and stay out of this page.
import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Download } from "lucide-react";
import { useApp, useT } from "../../context/AppContext.jsx";
import { adminErrorKey } from "../../lib/adminAccounts.js";
import { ACCESS_AUDIT_TABLES, AUDIT_PAGE, AUDIT_TABLE_LABEL, auditCsv, auditRecordLabel, fetchAuditEvents, valueDiff } from "../../lib/permissionAdmin.js";
import { downloadBlob, todayStr } from "../../lib/utils.js";
import { cn } from "../../lib/cn.js";
import { Alert } from "../ui/alert.jsx";
import { Badge } from "../ui/badge.jsx";
import { Button } from "../ui/button.jsx";
import { Card } from "../ui/card.jsx";
import { EmptyState } from "../ui/empty-state.jsx";
import { Input, Select } from "../ui/field.jsx";
import { FilterBar, FilterField } from "../ui/filter-bar.jsx";
import { PageHeader } from "../ui/page-header.jsx";
import { Skeleton } from "../ui/skeleton.jsx";
import { fmtWhen } from "./adminShared.jsx";

const ACTION_TONE = { insert: "success", update: "info", delete: "danger", invite: "violet", revoke_sessions: "warning", password_reset: "neutral" };
const ACTIONS = ["insert", "update", "delete", "invite", "revoke_sessions", "password_reset"];
const EMPTY = { actor: "", subject: "", table: "", action: "", from: "", to: "" };

function show(v) {
  if (v == null || v === "") return "—";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

function Diff({ event }) {
  const t = useT();
  const rows = valueDiff(event.oldValues, event.newValues);
  if (!rows.length) {
    return <p className="m-0 text-meta text-muted">{event.changedFields.length ? t("adminAuditFieldsOnly").replace("{fields}", event.changedFields.join(", ")) : t("adminAuditNoValues")}</p>;
  }
  return (
    <dl className="m-0 grid grid-cols-[minmax(8rem,auto)_minmax(0,1fr)] gap-x-4 gap-y-1 text-meta">
      {rows.map((r) => (
        <Fragment key={r.field}>
          <dt className="font-semibold text-muted">{r.field}</dt>
          <dd className="m-0 break-words text-card-foreground">
            <span className="text-tone-danger-ink line-through decoration-1">{show(r.from)}</span>
            <span aria-hidden="true" className="px-1.5 text-muted">→</span>
            <span className="sr-only">{t("adminAuditBecame")}</span>
            <span className="text-tone-success-ink">{show(r.to)}</span>
          </dd>
        </Fragment>
      ))}
    </dl>
  );
}

export default function AdminAudit() {
  const { data, lang, showToast } = useApp();
  const t = useT();
  const [filters, setFilters] = useState(EMPTY);
  const [events, setEvents] = useState(null);
  const [more, setMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState({});

  const people = useMemo(() => (data.profiles || []).slice().sort((a, b) => (a.name || a.email).localeCompare(b.name || b.email)), [data.profiles]);
  const nameOf = useCallback((id) => {
    if (!id) return "";
    const p = (data.profiles || []).find((x) => x.id === id);
    return p ? p.name || p.email : t("adminAuditUnknownPerson");
  }, [data.profiles, t]);

  // Dates are whole days in the browser's time zone; "to" includes its day.
  const query = useMemo(() => ({
    actor: filters.actor, subject: filters.subject, table: filters.table, action: filters.action,
    from: filters.from ? new Date(filters.from + "T00:00:00").toISOString() : "",
    to: filters.to ? new Date(new Date(filters.to + "T00:00:00").getTime() + 864e5).toISOString() : ""
  }), [filters]);

  const load = useCallback(() => {
    setFailed(false);
    setEvents(null);
    fetchAuditEvents(query).then((rows) => { setEvents(rows); setMore(rows.length === AUDIT_PAGE); }).catch(() => setFailed(true));
  }, [query]);
  useEffect(() => { load(); }, [load]);

  function loadMore() {
    setLoadingMore(true);
    fetchAuditEvents(Object.assign({}, query, { before: events[events.length - 1].id }))
      .then((rows) => { setEvents((cur) => cur.concat(rows)); setMore(rows.length === AUDIT_PAGE); })
      .catch((e) => showToast(t(adminErrorKey(e))))
      .finally(() => setLoadingMore(false));
  }

  const set = (k) => (e) => setFilters((f) => Object.assign({}, f, { [k]: e.target.value }));
  const activeCount = Object.keys(EMPTY).filter((k) => filters[k]).length;

  return (
    <>
      <PageHeader title={t("adminAuditTitle")} description={t("adminAuditDesc")}
        actions={events && events.length ? (
          <Button variant="secondary" onClick={() => downloadBlob(auditCsv(events, nameOf), "nb4hs-access-audit-" + todayStr() + ".csv", "text/csv;charset=utf-8;")}>
            <Download className="h-4 w-4" aria-hidden="true" />{t("adminAuditExport")}
          </Button>
        ) : null} />

      <FilterBar activeCount={activeCount} canClear={activeCount > 0} onClear={() => setFilters(EMPTY)} clearLabel={t("clearFilters")}
        filtersLabel={t("filtersLabel")} gridClassName="sm:grid-cols-2 xl:grid-cols-6">
        <FilterField label={t("adminAuditWho")} htmlFor="audit-actor">
          <Select id="audit-actor" value={filters.actor} onChange={set("actor")}>
            <option value="">{t("adminAuditAnyone")}</option>
            {people.map((p) => <option key={p.id} value={p.id}>{p.name || p.email}</option>)}
          </Select>
        </FilterField>
        <FilterField label={t("adminAuditAbout")} htmlFor="audit-subject">
          <Select id="audit-subject" value={filters.subject} onChange={set("subject")}>
            <option value="">{t("adminAuditAnyone")}</option>
            {people.map((p) => <option key={p.id} value={p.id}>{p.name || p.email}</option>)}
          </Select>
        </FilterField>
        <FilterField label={t("adminAuditWhat")} htmlFor="audit-table">
          <Select id="audit-table" value={filters.table} onChange={set("table")}>
            <option value="">{t("adminAuditEverything")}</option>
            {ACCESS_AUDIT_TABLES.map((k) => <option key={k} value={k}>{t(AUDIT_TABLE_LABEL[k])}</option>)}
          </Select>
        </FilterField>
        <FilterField label={t("adminAuditAction")} htmlFor="audit-action">
          <Select id="audit-action" value={filters.action} onChange={set("action")}>
            <option value="">{t("adminAuditAnyAction")}</option>
            {ACTIONS.map((a) => <option key={a} value={a}>{a}</option>)}
          </Select>
        </FilterField>
        <FilterField label={t("adminAuditFrom")} htmlFor="audit-from">
          <Input id="audit-from" type="date" value={filters.from} max={filters.to || undefined} onChange={set("from")} />
        </FilterField>
        <FilterField label={t("adminAuditTo")} htmlFor="audit-to">
          <Input id="audit-to" type="date" value={filters.to} min={filters.from || undefined} onChange={set("to")} />
        </FilterField>
      </FilterBar>

      {failed ? (
        <Alert tone="danger" title={t("adminLoadFailed")} action={<Button size="sm" variant="secondary" onClick={load}>{t("retryLabel")}</Button>} />
      ) : !events ? (
        <div className="space-y-2" aria-busy="true">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
      ) : !events.length ? (
        <Card><EmptyState title={t("adminAuditEmpty")} description={activeCount ? t("adminAuditEmptyFiltered") : undefined} /></Card>
      ) : (
        <Card className="overflow-hidden">
          <ul className="m-0 list-none divide-y divide-line-subtle p-0">
            {events.map((e) => {
              const isOpen = !!open[e.id];
              return (
                <li key={e.id}>
                  <button type="button" aria-expanded={isOpen} onClick={() => setOpen((o) => Object.assign({}, o, { [e.id]: !isOpen }))}
                    className={cn("flex w-full min-h-0 items-start gap-3 border-0 bg-transparent px-4 py-3 text-left font-normal leading-normal",
                      "hover:bg-surface-sunken focus-visible:bg-surface-sunken focus-visible:outline-none")}>
                    {isOpen ? <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-muted" aria-hidden="true" /> : <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted" aria-hidden="true" />}
                    <span className="grid min-w-0 flex-1 gap-1">
                      <span className="flex flex-wrap items-center gap-2 text-ui text-card-foreground">
                        <Badge variant={ACTION_TONE[e.action] || "neutral"}>{e.action}</Badge>
                        <span className="font-semibold">{AUDIT_TABLE_LABEL[e.tableName] ? t(AUDIT_TABLE_LABEL[e.tableName]) : e.tableName}</span>
                        {auditRecordLabel(e) ? <code className="rounded-chip bg-surface-sunken px-1.5 py-0.5 text-meta text-card-foreground">{auditRecordLabel(e)}</code> : null}
                        {e.subjectUserId ? <span className="text-muted">{t("adminAuditAboutName").replace("{name}", nameOf(e.subjectUserId))}</span> : null}
                      </span>
                      <span className="text-meta text-muted">
                        {fmtWhen(e.occurredAt, lang, true)} · {e.actorId ? nameOf(e.actorId) : t("adminAuditSystem")}
                        {e.reason ? " · " + e.reason : ""}
                      </span>
                    </span>
                  </button>
                  {isOpen ? <div className="px-4 pb-4 pl-11"><Diff event={e} /></div> : null}
                </li>
              );
            })}
          </ul>
          {more ? (
            <div className="border-t border-line-subtle p-3 text-center">
              <Button variant="secondary" loading={loadingMore} onClick={loadMore}>{t("adminAuditLoadMore")}</Button>
            </div>
          ) : null}
        </Card>
      )}
    </>
  );
}
