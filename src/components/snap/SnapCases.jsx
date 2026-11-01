// SnapCases.jsx -- an outreach program's "Cases" section. Lists the cases the
// caller may see (RLS: workers their own, supervisors/program admins all),
// opens new cases for an existing program contact, and opens SnapCaseDetail.
// `intent` ("new") comes from the dashboard's quick actions.
//
// Layout is the design system's list page: PageHeader, then one card with
// the search, quick filters, a DataTable (stacked rows below lg) and
// Pagination. An open case past its follow-up date carries an Overdue badge.
import { useEffect, useState } from "react";
import { FolderOpen, FolderPlus, RotateCcw } from "lucide-react";
import { useApp, useT } from "../../context/AppContext.jsx";
import { useOutreachProgram } from "../../context/OutreachProgramContext.jsx";
import { createCase, fetchCaseStages, fetchCases, filterCases, stageLabel } from "../../lib/assistanceCases.js";
import { optionsFor } from "../../lib/outreachPrograms.js";
import { fetchOutreachContacts } from "../../lib/outreachContacts.js";
import { paginateList } from "../../lib/pagination.js";
import { cn } from "../../lib/cn.js";
import { fmtDateLong, todayStr } from "../../lib/utils.js";
import NbIdBadge from "../NbIdBadge.jsx";
import Pagination from "../Pagination.jsx";
import { Button } from "../ui/button.jsx";
import { Card } from "../ui/card.jsx";
import { DataTable } from "../ui/data-table.jsx";
import { Dialog } from "../ui/dialog.jsx";
import { EmptyState } from "../ui/empty-state.jsx";
import { Field, Input, Select } from "../ui/field.jsx";
import { FilterChips } from "../ui/filter-chips.jsx";
import { PageHeader } from "../ui/page-header.jsx";
import { SearchInput } from "../ui/search-input.jsx";
import { StatusBadge } from "../ui/status-badge.jsx";
import SnapCaseDetail from "./SnapCaseDetail.jsx";
import { SnapCheckboxes } from "./SnapField.jsx";
import { LoadError, RecordName, RowFacts } from "./SnapListParts.jsx";

function NewCase({ onCreated, onClose }) {
  const { data, lang, session, showToast } = useApp();
  const t = useT();
  const { program, programRole, options } = useOutreachProgram();
  const userId = session ? session.id : null;
  const lead = programRole === "supervisor" || programRole === "program_admin";
  const [contacts, setContacts] = useState([]);
  const [contactId, setContactId] = useState("");
  const [requested, setRequested] = useState([]);
  const [followUpDate, setFollowUpDate] = useState("");
  const [assignedTo, setAssignedTo] = useState(userId);
  const [busy, setBusy] = useState(false);

  useEffect(() => { fetchOutreachContacts(program).then((rows) => setContacts(rows.filter((c) => c.status === "active"))).catch(() => {}); }, [program]);

  async function submit(e) {
    e.preventDefault();
    const contact = contacts.find((c) => c.id === contactId);
    if (!contact) return;
    setBusy(true);
    try {
      const created = await createCase(program, contact, { assistanceRequested: requested, followUpDate, assignedTo: lead ? assignedTo : userId }, userId);
      showToast(t("snapCaseCreated"));
      onCreated(created);
    } catch (err) {
      console.warn("createCase failed", err);
      showToast(t("snapCaseSaveError"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      size="lg"
      title={t("snapNewCaseTitle")}
      description={t("snapChooseContactHelp")}
      closeLabel={t("closeLabel")}
      as="form"
      panelProps={{ onSubmit: submit }}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose}>{t("cancelLabel")}</Button>
          <Button type="submit" loading={busy} disabled={!contactId}>{t("snapOpenCase")}</Button>
        </>
      }
    >
      <div className="grid gap-5">
        <Field label={t("snapChooseContact")} htmlFor="newcase-contact" required>
          <Select id="newcase-contact" value={contactId} onChange={(e) => setContactId(e.target.value)} required>
            <option value="">{t("snapChooseContactPrompt")}</option>
            {contacts.map((c) => <option key={c.id} value={c.id}>{(c.firstName + " " + c.lastName).trim()} · {c.nbId}</option>)}
          </Select>
        </Field>
        <SnapCheckboxes
          legend={t("snapAssistanceRequested")}
          items={optionsFor(options, "assistance_type").map((o) => ({ key: o.key, label: o.labels[lang] || o.labels.en }))}
          isChecked={(key) => requested.indexOf(key) !== -1}
          onToggle={(key) => setRequested((r) => (r.indexOf(key) !== -1 ? r.filter((x) => x !== key) : r.concat([key])))}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("snapFollowUpDate")} htmlFor="newcase-followup">
            <Input id="newcase-followup" type="date" min={todayStr()} value={followUpDate} onChange={(e) => setFollowUpDate(e.target.value)} />
          </Field>
          {lead && (
            <Field label={t("snapAssignedTo")} htmlFor="newcase-assigned">
              <Select id="newcase-assigned" value={assignedTo || ""} onChange={(e) => setAssignedTo(e.target.value)}>
                {(data.profiles || []).filter((p) => p.active !== false).map((p) => <option key={p.id} value={p.id}>{p.name || p.email}</option>)}
              </Select>
            </Field>
          )}
        </div>
      </div>
    </Dialog>
  );
}

export default function SnapCases({ intent }) {
  const { data, lang, session } = useApp();
  const t = useT();
  const { program } = useOutreachProgram();
  const userId = session ? session.id : null;
  const [cases, setCases] = useState(null);
  const [stages, setStages] = useState([]);
  const [loadError, setLoadError] = useState(false);
  const [q, setQ] = useState("");
  const [openOnly, setOpenOnly] = useState(true);
  const [mineOnly, setMineOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [creating, setCreating] = useState(intent === "new");
  const [openId, setOpenId] = useState(null);

  function load() {
    return Promise.all([fetchCases(program), fetchCaseStages(program)])
      .then(([rows, st]) => { setCases(rows); setStages(st); setLoadError(false); })
      .catch((err) => { console.warn("fetchCases failed", err); setLoadError(true); });
  }
  useEffect(() => { load(); }, []);

  const nameOf = (id) => { const p = (data.profiles || []).find((x) => x.id === id); return p ? (p.name || p.email) : null; };
  const list = filterCases(cases || [], { q, openOnly, mineOnly, userId });
  const paged = paginateList(list, page, pageSize);
  const open = (cases || []).find((c) => c.id === openId) || null;
  const today = todayStr();

  const overdue = (c) => !c.closedAt && c.followUpDate && c.followUpDate < today;
  const stage = (c) => (
    <StatusBadge domain="outreachCase" status={c.closedAt ? "closed" : "open"}>{stageLabel(stages, c.stageKey, lang)}</StatusBadge>
  );
  const assigned = (c) => (c.assignedTo ? (nameOf(c.assignedTo) || "—") : t("snapUnassigned"));
  const followUp = (c) => (
    c.followUpDate ? (
      <span className="inline-flex flex-wrap items-center gap-2">
        <span className={cn("tabular-nums", overdue(c) && "font-semibold text-tone-danger-ink")}>{fmtDateLong(c.followUpDate, lang)}</span>
        {overdue(c) && <StatusBadge domain="task" status="overdue">{t("snapBucket_overdue")}</StatusBadge>}
      </span>
    ) : "—"
  );
  const review = (c) => (
    c.reviewStatus !== "not_requested"
      ? <StatusBadge domain="caseReview" status={c.reviewStatus}>{t("snapReview_" + c.reviewStatus)}</StatusBadge>
      : "—"
  );

  function identity(c) {
    return (
      <div className="min-w-0">
        <RecordName onOpen={() => setOpenId(c.id)}>{(c.firstName + " " + c.lastName).trim()}</RecordName>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-meta text-muted">
          <span className="whitespace-nowrap tabular-nums">{c.caseNumber}</span>
          <NbIdBadge nbId={c.nbId} />
        </div>
      </div>
    );
  }

  const columns = [
    { key: "case", header: t("snapCaseNumber"), cell: identity },
    { key: "stage", header: t("snapCaseStage"), cell: stage },
    { key: "assigned", header: t("snapAssignedTo"), cell: assigned },
    { key: "follow", header: t("snapFollowUpDate"), cell: followUp },
    { key: "review", header: t("snapReview"), cell: review }
  ];

  const filterValue = (openOnly ? ["open"] : []).concat(mineOnly ? ["mine"] : []);
  function setFilters(v) { setOpenOnly(v.indexOf("open") !== -1); setMineOnly(v.indexOf("mine") !== -1); setPage(1); }
  function clearFilters() { setQ(""); setOpenOnly(false); setMineOnly(false); setPage(1); }

  const openButton = (
    <Button onClick={() => setCreating(true)}><FolderPlus className="h-4 w-4" aria-hidden="true" /> {t("snapOpenCase")}</Button>
  );

  let body;
  if (loadError) {
    body = <LoadError title={t("snapCasesLoadError")} onRetry={load} />;
  } else if (cases && !cases.length) {
    body = <EmptyState icon={FolderOpen} title={t("snapNoCases")} description={t("snapNoCasesHint")} action={openButton} />;
  } else {
    body = (
      <>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <SearchInput
            className="min-w-0 flex-1"
            value={q}
            onChange={(e) => { setQ(e.target.value); setPage(1); }}
            onClear={() => { setQ(""); setPage(1); }}
            clearLabel={t("clearLabel")}
            placeholder={t("snapCaseSearchPlaceholder")}
            aria-label={t("searchLabel")}
          />
          <FilterChips
            multiple
            label={t("filtersLabel")}
            value={filterValue}
            onChange={setFilters}
            options={[{ value: "open", label: t("snapOpenOnly") }, { value: "mine", label: t("snapMineOnly") }]}
          />
        </div>
        <DataTable
          className="mt-4"
          caption={t("snapSectionCases")}
          loading={cases === null}
          columns={columns}
          rows={paged.items}
          getRowId={(c) => c.id}
          renderCard={(c) => (
            <>
              <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
                {identity(c)}
                <span className="shrink-0">{stage(c)}</span>
              </div>
              <RowFacts items={[
                { label: t("snapAssignedTo"), value: assigned(c) },
                { label: t("snapFollowUpDate"), value: followUp(c) },
                { label: t("snapReview"), value: review(c) }
              ]} />
            </>
          )}
          empty={
            <EmptyState
              variant="no-results"
              title={t("snapNoCasesMatch")}
              description={t("snapNoMatchHint")}
              action={<Button variant="secondary" onClick={clearFilters}><RotateCcw className="h-4 w-4" aria-hidden="true" />{t("clearLabel")}</Button>}
            />
          }
        />
        {paged.total ? (
          <Pagination
            bare
            page={paged.page} totalPages={paged.totalPages} total={paged.total} pageSize={paged.pageSize}
            onPageSizeChange={(n) => { setPageSize(n); setPage(1); }} itemLabel={t("snapCasesItemLabel")}
            onChange={(delta) => setPage(paged.page + delta)}
          />
        ) : null}
      </>
    );
  }

  return (
    <>
      <PageHeader title={t("snapSectionCases")} description={t("snapCasesDesc")} actions={openButton} />
      <Card className="p-4 sm:p-5">{body}</Card>

      {creating && <NewCase onClose={() => setCreating(false)} onCreated={(created) => { setCreating(false); load().then(() => setOpenId(created.id)); }} />}
      {open && (
        <SnapCaseDetail caseRow={open} stages={stages} onClose={() => setOpenId(null)}
          onChanged={(updated) => setCases((prev) => prev.map((c) => (c.id === updated.id ? updated : c)))} />
      )}
    </>
  );
}
