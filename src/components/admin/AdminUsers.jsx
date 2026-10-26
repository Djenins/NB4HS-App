// AdminUsers.jsx -- Administration > Staff accounts: every account with its
// positions, account type, roles, status and last sign-in; filters; and
// "Invite staff". A row opens the person's account (AdminUserProfile).
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { UserPlus } from "lucide-react";
import { useApp, useT } from "../../context/AppContext.jsx";
import { ACCOUNT_STATUSES, accountStatus, adminErrorKey, fetchAccounts, filterAccounts, sortAccounts } from "../../lib/adminAccounts.js";
import { ROLES } from "../../lib/constants.js";
import { roleLabel } from "../../lib/utils.js";
import { Badge } from "../ui/badge.jsx";
import { Button } from "../ui/button.jsx";
import { Card } from "../ui/card.jsx";
import { DataTable } from "../ui/data-table.jsx";
import { EmptyState } from "../ui/empty-state.jsx";
import { Select } from "../ui/field.jsx";
import { FilterBar, FilterField } from "../ui/filter-bar.jsx";
import { PageHeader } from "../ui/page-header.jsx";
import { SearchInput } from "../ui/search-input.jsx";
import { AccountStatusBadge, PersonCell, accountStatusLabel, fmtWhen } from "./adminShared.jsx";
import InviteDialog from "./InviteDialog.jsx";

export default function AdminUsers() {
  const { lang, can, showToast } = useApp();
  const t = useT();
  const navigate = useNavigate();
  const [accounts, setAccounts] = useState(null);
  const [loadError, setLoadError] = useState(false);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [role, setRole] = useState("");
  const [sort, setSort] = useState({ key: "name", dir: "asc" });
  const [inviting, setInviting] = useState(false);

  const load = useCallback(() => {
    setLoadError(false);
    return fetchAccounts().then(setAccounts).catch((e) => { setLoadError(true); showToast(t(adminErrorKey(e))); });
  }, [showToast, t]);
  useEffect(() => { load(); }, [load]);

  const rows = useMemo(
    () => sortAccounts(filterAccounts(accounts || [], { query, status, role }), sort),
    [accounts, query, status, role, sort]
  );
  const counts = useMemo(() => {
    const c = {};
    (accounts || []).forEach((u) => { const s = accountStatus(u); c[s] = (c[s] || 0) + 1; });
    return c;
  }, [accounts]);
  const activeFilters = (status ? 1 : 0) + (role ? 1 : 0);

  function onSort(key) {
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));
  }
  function clear() { setQuery(""); setStatus(""); setRole(""); }

  const columns = [
    { key: "person", header: t("staffMember"), sortKey: "name", cell: (u) => <PersonCell name={u.name} email={u.email} to={"/admin/users/" + u.id} /> },
    {
      key: "position", header: t("adminPositionCol"),
      cell: (u) => u.positions.length ? <span>{u.positions[0].name}{u.positions.length > 1 ? <span className="text-muted"> +{u.positions.length - 1}</span> : null}</span> : <span className="text-muted">—</span>
    },
    {
      key: "access", header: t("adminAccessCol"),
      cell: (u) => (
        <div className="flex flex-wrap gap-1">
          <Badge variant="neutral">{roleLabel(u.role, lang)}</Badge>
          {u.roles.filter((r) => r.source === "admin").map((r) => <Badge key={r.id} variant="info">{r.name}</Badge>)}
        </div>
      )
    },
    { key: "status", header: t("statusLabel"), sortKey: "status", cell: (u) => <AccountStatusBadge account={u} /> },
    {
      key: "lastSignIn", header: t("adminLastSignInCol"), sortKey: "lastSignIn",
      cell: (u) => u.lastSignInAt ? fmtWhen(u.lastSignInAt, lang) : <span className="text-muted">{t("adminNeverSignedIn")}</span>
    }
  ];

  return (
    <>
      <PageHeader
        title={t("adminUsersTitle")}
        description={t("adminUsersSubtitle")}
        actions={can("admin.users.invite") ? (
          <Button onClick={() => setInviting(true)}><UserPlus className="h-4 w-4" aria-hidden="true" />{t("adminInviteStaff")}</Button>
        ) : null}
      />

      <FilterBar
        search={<SearchInput value={query} onChange={(e) => setQuery(e.target.value)} onClear={() => setQuery("")} clearLabel={t("clearFilters")} placeholder={t("adminSearchAccounts")} aria-label={t("adminSearchAccounts")} />}
        activeCount={activeFilters}
        canClear={!!(activeFilters || query)}
        onClear={clear}
        clearLabel={t("clearFilters")}
        filtersLabel={t("filtersLabel")}
        gridClassName="sm:grid-cols-2 lg:grid-cols-4"
      >
        <FilterField label={t("statusLabel")} htmlFor="admin-status">
          <Select id="admin-status" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">{t("allStatuses")}</option>
            {ACCOUNT_STATUSES.map((s) => <option key={s} value={s}>{t(accountStatusLabel(s))} ({counts[s] || 0})</option>)}
          </Select>
        </FilterField>
        <FilterField label={t("adminAccountTypeLabel")} htmlFor="admin-role">
          <Select id="admin-role" value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="">{t("adminAllAccountTypes")}</option>
            {ROLES.map((r) => <option key={r} value={r}>{roleLabel(r, lang)}</option>)}
          </Select>
        </FilterField>
      </FilterBar>

      <Card className="p-4 sm:p-5">
        {loadError ? (
          <EmptyState variant="error" title={t("adminLoadFailed")} description={t("adminLoadFailedHint")} action={<Button variant="secondary" onClick={load}>{t("retryLabel")}</Button>} />
        ) : (
          <DataTable
            columns={columns}
            rows={rows}
            getRowId={(u) => u.id}
            loading={accounts === null}
            sort={sort}
            onSort={onSort}
            caption={t("adminUsersTitle")}
            renderCard={(u) => (
              <button type="button" onClick={() => navigate("/admin/users/" + u.id)} className="block w-full min-h-0 border-0 bg-transparent p-0 text-left font-normal transform-none">
                <div className="flex items-start justify-between gap-3">
                  <PersonCell name={u.name} email={u.email} />
                  <AccountStatusBadge account={u} />
                </div>
                <div className="mt-2 flex flex-wrap gap-1 pl-12">
                  <Badge variant="neutral">{roleLabel(u.role, lang)}</Badge>
                  {u.positions.slice(0, 1).map((p) => <Badge key={p.id} variant="info">{p.name}</Badge>)}
                </div>
              </button>
            )}
            empty={accounts && accounts.length
              ? <EmptyState variant="no-results" title={t("adminNoMatches")} description={t("adminNoMatchesHint")} action={<Button variant="secondary" onClick={clear}>{t("clearFilters")}</Button>} />
              : <EmptyState title={t("noUsersYet")} />}
          />
        )}
      </Card>

      <InviteDialog
        open={inviting}
        onClose={() => setInviting(false)}
        existingEmails={(accounts || []).map((u) => u.email.toLowerCase())}
        onInvited={load}
      />
    </>
  );
}
