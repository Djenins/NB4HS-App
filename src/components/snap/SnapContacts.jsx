// SnapContacts.jsx -- an outreach program's "Contacts" section: every
// contact (any member can read all of them, by decision), filterable by
// search and "assigned to me", with the find-first add flow and the
// contact detail view. Fetched on demand rather than held in AppContext:
// only this section needs it.
//
// Layout is the design system's list page: PageHeader, then one card with
// the search, the quick filter, a DataTable (stacked rows below lg) and
// Pagination. A skeleton holds the table's shape while it loads.
import { useEffect, useState } from "react";
import { RotateCcw, UserPlus, Users } from "lucide-react";
import { useApp, useT } from "../../context/AppContext.jsx";
import { useOutreachProgram } from "../../context/OutreachProgramContext.jsx";
import { fetchOutreachContacts, filterContacts } from "../../lib/outreachContacts.js";
import { paginateList } from "../../lib/pagination.js";
import { formatPhone } from "../../lib/utils.js";
import NbIdBadge from "../NbIdBadge.jsx";
import Pagination from "../Pagination.jsx";
import { Badge } from "../ui/badge.jsx";
import { Button } from "../ui/button.jsx";
import { Card } from "../ui/card.jsx";
import { DataTable } from "../ui/data-table.jsx";
import { EmptyState } from "../ui/empty-state.jsx";
import { FilterChips } from "../ui/filter-chips.jsx";
import { PageHeader } from "../ui/page-header.jsx";
import { SearchInput } from "../ui/search-input.jsx";
import { StatusBadge } from "../ui/status-badge.jsx";
import SnapAddContact from "./SnapAddContact.jsx";
import SnapContactDetail from "./SnapContactDetail.jsx";
import { LoadError, RecordName, RowFacts } from "./SnapListParts.jsx";

const fullName = (c) => (c.firstName + " " + c.lastName).trim();

export default function SnapContacts({ intent }) {
  const { data, session } = useApp();
  const t = useT();
  const { program } = useOutreachProgram();
  const userId = session ? session.id : null;
  const [contacts, setContacts] = useState(null);
  const [loadError, setLoadError] = useState(false);
  const [q, setQ] = useState("");
  const [mineOnly, setMineOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [adding, setAdding] = useState(intent === "new");
  const [openId, setOpenId] = useState(null);

  function load() {
    return fetchOutreachContacts(program)
      .then((rows) => { setContacts(rows); setLoadError(false); return rows; })
      .catch((err) => { console.warn("fetchOutreachContacts failed", err); setLoadError(true); return []; });
  }
  useEffect(() => { load(); }, []);

  const nameOf = (id) => { const p = (data.profiles || []).find((x) => x.id === id); return p ? (p.name || p.email) : null; };
  const list = filterContacts(contacts || [], { q, mineOnly, userId });
  const paged = paginateList(list, page, pageSize);
  const open = (contacts || []).find((c) => c.id === openId) || null;

  const language = (c) => (c.preferredLanguage ? t("snapLang_" + c.preferredLanguage) : "—");
  const method = (c) => (c.preferredContactMethod ? t("snapMethod_" + c.preferredContactMethod) : "—");
  const assigned = (c) => (c.assignedTo ? (nameOf(c.assignedTo) || "—") : t("snapUnassigned"));
  const followUp = (c) => <StatusBadge domain="contactFollowUp" status={c.followUpStatus}>{t("snapFollow_" + c.followUpStatus)}</StatusBadge>;

  function identity(c) {
    const reach = [formatPhone(c.phone), c.email].filter(Boolean).join(" · ");
    return (
      <div className="min-w-0">
        <RecordName onOpen={() => setOpenId(c.id)}>{fullName(c)}</RecordName>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-meta text-muted">
          <NbIdBadge nbId={c.nbId} />
          {reach && <span className="tabular-nums">{reach}</span>}
          {c.status === "inactive" && <Badge variant="neutral">{t("snapStatus_inactive")}</Badge>}
        </div>
      </div>
    );
  }

  const columns = [
    { key: "contact", header: t("snapContactCol"), cell: identity },
    { key: "language", header: t("snapPreferredLanguage"), cell: language },
    { key: "method", header: t("snapPreferredMethod"), cell: method },
    { key: "assigned", header: t("snapAssignedTo"), cell: assigned },
    { key: "follow", header: t("snapFollowUp"), cell: followUp }
  ];

  function clearFilters() { setQ(""); setMineOnly(false); setPage(1); }

  const addButton = (
    <Button onClick={() => setAdding(true)}>
      <UserPlus className="h-4 w-4" aria-hidden="true" /> {t("snapAddContact")}
    </Button>
  );

  let body;
  if (loadError) {
    body = <LoadError title={t("snapContactsLoadError")} onRetry={load} />;
  } else if (contacts && !contacts.length) {
    body = <EmptyState icon={Users} title={t("snapNoContacts")} description={t("snapNoContactsHint")} action={addButton} />;
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
            placeholder={t("snapFindPersonPlaceholder")}
            aria-label={t("searchLabel")}
          />
          <FilterChips
            multiple
            label={t("filtersLabel")}
            value={mineOnly ? ["mine"] : []}
            onChange={(v) => { setMineOnly(v.indexOf("mine") !== -1); setPage(1); }}
            options={[{ value: "mine", label: t("snapMineOnly") }]}
          />
        </div>
        <DataTable
          className="mt-4"
          caption={t("snapSectionContacts")}
          loading={contacts === null}
          columns={columns}
          rows={paged.items}
          getRowId={(c) => c.id}
          renderCard={(c) => (
            <>
              <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
                {identity(c)}
                <span className="shrink-0">{followUp(c)}</span>
              </div>
              <RowFacts items={[
                { label: t("snapPreferredLanguage"), value: language(c) },
                { label: t("snapPreferredMethod"), value: method(c) },
                { label: t("snapAssignedTo"), value: assigned(c) }
              ]} />
            </>
          )}
          empty={
            <EmptyState
              variant="no-results"
              title={t("snapNoContactsMatch")}
              description={t("snapNoMatchHint")}
              action={<Button variant="secondary" onClick={clearFilters}><RotateCcw className="h-4 w-4" aria-hidden="true" />{t("clearLabel")}</Button>}
            />
          }
        />
        {paged.total ? (
          <Pagination
            bare
            page={paged.page} totalPages={paged.totalPages} total={paged.total} pageSize={paged.pageSize}
            onPageSizeChange={(n) => { setPageSize(n); setPage(1); }} itemLabel={t("snapContactsItemLabel")}
            onChange={(delta) => setPage(paged.page + delta)}
          />
        ) : null}
      </>
    );
  }

  return (
    <>
      <PageHeader title={t("snapSectionContacts")} description={t("snapContactsDesc")} actions={addButton} />
      <Card className="p-4 sm:p-5">{body}</Card>

      {adding && (
        <SnapAddContact
          contacts={contacts}
          onClose={() => setAdding(false)}
          onOpenContact={(c) => { setAdding(false); setOpenId(c.id); }}
          onCreated={(created) => { setAdding(false); load().then(() => setOpenId(created.id)); }}
        />
      )}
      {open && (
        <SnapContactDetail
          contact={open}
          onClose={() => setOpenId(null)}
          onChanged={(updated) => setContacts((prev) => prev.map((c) => (c.id === updated.id ? updated : c)))}
        />
      )}
    </>
  );
}
