// AdminRoleDetail.jsx -- one role (/admin/roles/:id): what it allows,
// grouped by module, and who holds it. Custom roles can be renamed,
// described and archived; any role can be duplicated into a new custom one.
// Custom and unprotected built-in roles can have their permissions edited
// (RolePermissionEditor.jsx, Phase 5); legacy roles follow the account type
// and protected ones are fixed, so those stay read-only.
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Archive, ArchiveRestore, Copy, ListChecks, Pencil } from "lucide-react";
import { useApp, useT } from "../../context/AppContext.jsx";
import { adminErrorKey, fetchAccessCatalog, groupRolePermissions, updateRole } from "../../lib/adminAccounts.js";
import { roleDraft, roleEditable } from "../../lib/permissionAdmin.js";
import RolePermissionEditor from "./RolePermissionEditor.jsx";
import { Alert } from "../ui/alert.jsx";
import { Badge } from "../ui/badge.jsx";
import { Button } from "../ui/button.jsx";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card.jsx";
import { Dialog } from "../ui/dialog.jsx";
import { EmptyState } from "../ui/empty-state.jsx";
import { Field, Input, Textarea } from "../ui/field.jsx";
import { PageHeader } from "../ui/page-header.jsx";
import { Skeleton } from "../ui/skeleton.jsx";
import { StatusBadge } from "../ui/status-badge.jsx";
import { NewRoleDialog, ROLE_KIND_LABEL } from "./AdminRoles.jsx";
import { PersonCell, SCOPE_LABEL, SensitivityBadge, countLabel } from "./adminShared.jsx";

function EditRoleDialog({ open, onClose, role, onSaved }) {
  const { showToast } = useApp();
  const t = useT();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) { setName(role.name); setDescription(role.description); setBusy(false); } }, [open, role]);

  async function submit(e) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    try { await updateRole(role.id, { name: name.trim(), description: description.trim() }); showToast(t("adminSaved")); onSaved(); onClose(); }
    catch (err) { showToast(t(adminErrorKey(err))); }
    setBusy(false);
  }

  return (
    <Dialog open={open} onClose={busy ? () => {} : onClose} title={t("adminEditRole")} size="md" closeLabel={t("closeLabel")}
      as="form" panelProps={{ onSubmit: submit, noValidate: true }}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>{t("cancelLabel")}</Button>
          <Button type="submit" loading={busy} disabled={!name.trim()}>{t("saveLabel")}</Button>
        </>
      }>
      <div className="grid gap-4">
        <Field label={t("adminRoleNameLabel")} htmlFor="edit-role-name" required>
          <Input id="edit-role-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} data-autofocus />
        </Field>
        <Field label={t("adminDescriptionLabel")} htmlFor="edit-role-desc">
          <Textarea id="edit-role-desc" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={1000} />
        </Field>
      </div>
    </Dialog>
  );
}

export default function AdminRoleDetail({ roleId }) {
  const { can, data, showToast, requestConfirm } = useApp();
  const t = useT();
  const navigate = useNavigate();
  const [catalog, setCatalog] = useState(null);
  const [failed, setFailed] = useState(false);
  const [editing, setEditing] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const [editingPerms, setEditingPerms] = useState(false);

  const load = useCallback(() => fetchAccessCatalog().then(setCatalog).catch(() => setFailed(true)), []);
  useEffect(() => { load(); }, [load]);

  const role = catalog && catalog.roles.find((r) => r.id === roleId);
  const groups = useMemo(() => (role ? groupRolePermissions(
    catalog.rolePermissions.filter((rp) => rp.roleId === role.id), catalog.permissions, catalog.modules
  ) : []), [catalog, role]);
  const people = useMemo(() => {
    if (!role) return [];
    const ids = new Set(catalog.members.filter((m) => m.role_id === role.id).map((m) => m.user_id));
    return (data.profiles || []).filter((p) => ids.has(p.id)).sort((a, b) => (a.name || a.email).localeCompare(b.name || b.email));
  }, [catalog, role, data.profiles]);

  const back = { label: t("adminBackToRoles"), onClick: () => navigate("/admin/roles") };
  if (!catalog && !failed) return <div className="space-y-4" aria-busy="true"><Skeleton className="h-16 w-1/2" /><Skeleton className="h-64 w-full" /></div>;
  if (!role) {
    return (
      <>
        <PageHeader title={t("adminRoleNotFound")} back={back} />
        <Card><EmptyState variant="error" title={t("adminRoleNotFound")} /></Card>
      </>
    );
  }

  const manage = can("admin.roles.manage");
  const editable = manage && role.kind === "custom";
  const permsEditable = manage && roleEditable(role);

  async function toggleArchive() {
    if (!role.archivedAt && !(await requestConfirm(t("adminArchiveConfirm").replace("{name}", role.name).replace("{n}", role.peopleCount)))) return;
    try { await updateRole(role.id, { archived: !role.archivedAt }); showToast(t(role.archivedAt ? "adminRoleRestored" : "adminRoleArchived")); load(); }
    catch (e) { showToast(t(adminErrorKey(e))); }
  }

  return (
    <>
      <PageHeader
        back={back}
        title={role.name}
        description={role.description || undefined}
        meta={
          <>
            <StatusBadge domain="roleKind" status={role.kind}>{t(ROLE_KIND_LABEL[role.kind])}</StatusBadge>
            {role.archivedAt ? <Badge variant="neutral">{t("adminArchived")}</Badge> : null}
          </>
        }
        actions={manage ? (
          <>
            {permsEditable && !editingPerms ? <Button variant="secondary" onClick={() => setEditingPerms(true)}><ListChecks className="h-4 w-4" aria-hidden="true" />{t("adminEditPermissions")}</Button> : null}
            {editable ? <Button variant="secondary" onClick={() => setEditing(true)}><Pencil className="h-4 w-4" aria-hidden="true" />{t("editLabel")}</Button> : null}
            <Button variant="secondary" onClick={() => setDuplicating(true)}><Copy className="h-4 w-4" aria-hidden="true" />{t("adminDuplicate")}</Button>
            {editable ? (
              <Button variant="secondary" onClick={toggleArchive}>
                {role.archivedAt ? <ArchiveRestore className="h-4 w-4" aria-hidden="true" /> : <Archive className="h-4 w-4" aria-hidden="true" />}
                {role.archivedAt ? t("adminRestore") : t("adminArchive")}
              </Button>
            ) : null}
          </>
        ) : null}
      />

      {role.kind === "legacy" || role.protected ? (
        <Alert tone="info" className="mb-6" title={role.kind === "legacy" ? t("adminLegacyRoleTitle") : t("adminRoleReadOnlyTitle")}>
          {role.kind === "legacy" ? t("adminLegacyRoleBody") : t("adminBuiltinRoleBody")}
        </Alert>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        {editingPerms ? (
          <div className="min-w-0">
            <RolePermissionEditor role={role} catalog={catalog} initial={roleDraft(catalog.rolePermissions, role.id)}
              onCancel={() => setEditingPerms(false)} onSaved={() => { setEditingPerms(false); load(); }} />
          </div>
        ) : (
        <Card>
          <CardHeader>
            <CardTitle>{t("adminWhatRoleAllows")}</CardTitle>
            <CardDescription>{countLabel(t, role.permissionCount, "adminOnePermission", "adminPermissionCount")}</CardDescription>
          </CardHeader>
          <CardContent>
            {groups.length ? (
              <div className="grid gap-5">
                {groups.map((g) => (
                  <section key={g.module.key}>
                    <h3 className="m-0 mb-2 text-meta font-semibold uppercase tracking-wide text-muted">{g.module.name}</h3>
                    <ul className="m-0 list-none divide-y divide-line-subtle rounded-control border border-border p-0">
                      {g.permissions.map((p) => (
                        <li key={p.key} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-ui">
                          <span className="flex flex-wrap items-center gap-2 text-card-foreground">{p.label}<SensitivityBadge sensitivity={p.sensitivity} /></span>
                          {p.scope ? <Badge variant="neutral">{t(SCOPE_LABEL[p.scope])}</Badge> : null}
                        </li>
                      ))}
                    </ul>
                  </section>
                ))}
              </div>
            ) : (
              <EmptyState compact title={t("adminRoleEmpty")} />
            )}
          </CardContent>
        </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>{t("adminPeopleWithRole")}</CardTitle>
            <CardDescription>{countLabel(t, people.length, "adminOnePerson", "adminPeopleCount")}</CardDescription>
          </CardHeader>
          <CardContent>
            {people.length ? (
              <ul className="m-0 grid list-none gap-3 p-0">
                {people.map((p) => <li key={p.id}><PersonCell name={p.name} email={p.email} to={can("admin.users.view") ? "/admin/users/" + p.id : undefined} /></li>)}
              </ul>
            ) : (
              <EmptyState compact title={t("adminNobodyHasRole")} />
            )}
          </CardContent>
        </Card>
      </div>

      {editable ? <EditRoleDialog open={editing} onClose={() => setEditing(false)} role={role} onSaved={load} /> : null}
      <NewRoleDialog open={duplicating} onClose={() => setDuplicating(false)} roles={catalog.roles} copyFrom={role.id}
        onCreated={(id) => { setDuplicating(false); load().then(() => navigate("/admin/roles/" + id)); }} />
    </>
  );
}
