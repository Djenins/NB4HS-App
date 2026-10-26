// AdminRoles.jsx -- Administration > Roles: every role with its kind, how
// many permissions it bundles and how many people hold it. "New role"
// starts a custom role, empty or as a copy of another. A row opens the role
// (AdminRoleDetail).
//
// Kinds: built-in (System Administrator, Executive Oversight -- fixed),
// automatic (the legacy mirrors of today's account types and program staff
// settings, kept in sync by the database) and custom.
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Plus } from "lucide-react";
import { useApp, useT } from "../../context/AppContext.jsx";
import { adminErrorKey, createRole, fetchAccessCatalog } from "../../lib/adminAccounts.js";
import { Button } from "../ui/button.jsx";
import { Card } from "../ui/card.jsx";
import { DataTable } from "../ui/data-table.jsx";
import { Dialog } from "../ui/dialog.jsx";
import { EmptyState } from "../ui/empty-state.jsx";
import { Field, Input, Select, Textarea } from "../ui/field.jsx";
import { PageHeader } from "../ui/page-header.jsx";
import { SegmentedControl } from "../ui/segmented-control.jsx";
import { StatusBadge } from "../ui/status-badge.jsx";
import { countLabel } from "./adminShared.jsx";

export const ROLE_KIND_LABEL = { builtin: "adminRoleKindBuiltin", custom: "adminRoleKindCustom", legacy: "adminRoleKindLegacy" };
const KIND_ORDER = { builtin: 0, custom: 1, legacy: 2 };

export function NewRoleDialog({ open, onClose, roles, copyFrom, onCreated }) {
  const { showToast } = useApp();
  const t = useT();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [source, setSource] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!open) return;
    const from = copyFrom ? roles.find((r) => r.id === copyFrom) : null;
    setName(from ? t("adminCopyOf").replace("{name}", from.name) : "");
    setDescription(from ? from.description : "");
    setSource(copyFrom || "");
    setError("");
    setBusy(false);
  }, [open, copyFrom, roles, t]);

  async function submit(e) {
    e.preventDefault();
    if (!name.trim()) { setError(t("adminNameRequired")); return; }
    setBusy(true);
    try {
      const id = await createRole(name.trim(), description.trim(), source || null);
      showToast(t("adminRoleCreated"));
      onCreated(id);
    } catch (err) { showToast(t(adminErrorKey(err))); setBusy(false); }
  }

  return (
    <Dialog open={open} onClose={busy ? () => {} : onClose} title={copyFrom ? t("adminDuplicateRole") : t("adminNewRole")} description={t("adminNewRoleDesc")}
      size="md" closeLabel={t("closeLabel")} as="form" panelProps={{ onSubmit: submit, noValidate: true }}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>{t("cancelLabel")}</Button>
          <Button type="submit" loading={busy}>{t("adminCreateRole")}</Button>
        </>
      }>
      <div className="grid gap-4">
        <Field label={t("adminRoleNameLabel")} htmlFor="role-name" error={error} required>
          <Input id="role-name" value={name} onChange={(e) => { setName(e.target.value); setError(""); }} maxLength={80} aria-invalid={!!error} data-autofocus />
        </Field>
        <Field label={t("adminDescriptionLabel")} htmlFor="role-desc">
          <Textarea id="role-desc" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={1000} />
        </Field>
        <Field label={t("adminStartFrom")} htmlFor="role-source" hint={t("adminStartFromHint")}>
          <Select id="role-source" value={source} onChange={(e) => setSource(e.target.value)}>
            <option value="">{t("adminStartEmpty")}</option>
            {roles.filter((r) => !r.archivedAt).map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </Select>
        </Field>
      </div>
    </Dialog>
  );
}

export default function AdminRoles() {
  const { can, showToast } = useApp();
  const t = useT();
  const navigate = useNavigate();
  const [catalog, setCatalog] = useState(null);
  const [loadError, setLoadError] = useState(false);
  const [view, setView] = useState("active");
  const [creating, setCreating] = useState(false);

  const load = useCallback(() => {
    setLoadError(false);
    return fetchAccessCatalog().then(setCatalog).catch((e) => { setLoadError(true); showToast(t(adminErrorKey(e))); });
  }, [showToast, t]);
  useEffect(() => { load(); }, [load]);

  const rows = useMemo(() => (catalog ? catalog.roles : [])
    .filter((r) => (view === "archived" ? !!r.archivedAt : !r.archivedAt))
    .sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || a.name.localeCompare(b.name)), [catalog, view]);

  const columns = [
    {
      key: "name", header: t("adminRoleLabel"),
      cell: (r) => (
        <div className="min-w-0">
          <Link to={"/admin/roles/" + r.id} className="font-semibold text-card-foreground no-underline hover:text-primary hover:underline">{r.name}</Link>
          {r.description ? <div className="truncate text-meta text-muted">{r.description}</div> : null}
        </div>
      )
    },
    { key: "kind", header: t("adminKindCol"), cell: (r) => <StatusBadge domain="roleKind" status={r.kind}>{t(ROLE_KIND_LABEL[r.kind])}</StatusBadge> },
    { key: "perms", header: t("adminPermissionsCol"), className: "tabular-nums", cell: (r) => r.permissionCount },
    { key: "people", header: t("adminPeopleCol"), className: "tabular-nums", cell: (r) => r.peopleCount }
  ];

  return (
    <>
      <PageHeader
        title={t("adminRolesTitle")}
        description={t("adminRolesSubtitle")}
        actions={can("admin.roles.manage") ? <Button onClick={() => setCreating(true)}><Plus className="h-4 w-4" aria-hidden="true" />{t("adminNewRole")}</Button> : null}
      />
      <Card className="p-4 sm:p-5">
        <SegmentedControl className="mb-4" label={t("adminRolesView")} value={view} onChange={setView}
          options={[{ value: "active", label: t("adminInUse") }, { value: "archived", label: t("adminArchived") }]} />
        {loadError ? (
          <EmptyState variant="error" title={t("adminLoadFailed")} description={t("adminLoadFailedHint")} action={<Button variant="secondary" onClick={load}>{t("retryLabel")}</Button>} />
        ) : (
          <DataTable
            columns={columns}
            rows={rows}
            getRowId={(r) => r.id}
            loading={catalog === null}
            caption={t("adminRolesTitle")}
            renderCard={(r) => (
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link to={"/admin/roles/" + r.id} className="font-semibold text-card-foreground no-underline hover:text-primary hover:underline">{r.name}</Link>
                  <div className="mt-1 text-meta text-muted">{countLabel(t, r.permissionCount, "adminOnePermission", "adminPermissionCount")} · {countLabel(t, r.peopleCount, "adminOnePerson", "adminPeopleCount")}</div>
                </div>
                <StatusBadge domain="roleKind" status={r.kind}>{t(ROLE_KIND_LABEL[r.kind])}</StatusBadge>
              </div>
            )}
            empty={<EmptyState compact title={view === "archived" ? t("adminNoArchivedRoles") : t("adminNoRolesYet")} />}
          />
        )}
      </Card>
      {catalog ? (
        <NewRoleDialog open={creating} onClose={() => setCreating(false)} roles={catalog.roles}
          onCreated={(id) => { setCreating(false); navigate("/admin/roles/" + id); }} />
      ) : null}
    </>
  );
}
