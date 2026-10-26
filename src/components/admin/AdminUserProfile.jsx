// AdminUserProfile.jsx -- one staff account (/admin/users/:id): the
// lifecycle actions in the header (deactivate, reactivate or activate,
// resend the invite, send a password reset, sign out everywhere), then tabs:
//   Profile         name, sign-in email, account type (the legacy role that
//                   still decides which pages they see) and sign-in history
//   Positions       job titles -- describe the work, grant nothing
//   Program Access  the programs whose permissions count for them
//   Roles           permission sets under the new access model
//
// Nobody acts on their own account here: the database refuses it too.
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { KeyRound, LogOut, Mail, Plus, Star, Trash2, UserCheck, UserX } from "lucide-react";
import ProgramAccessTab from "./ProgramAccessTab.jsx";
import { useApp, useT } from "../../context/AppContext.jsx";
import {
  accountStatus, addUserPosition, adminErrorKey, assignRole, assignableRoles, fetchAccessCatalog, fetchAccount,
  fetchPositions, removeUserPosition, resendInvite, revokeRole, revokeSessions, sendPasswordReset,
  setAccountActive, setPrimaryPosition, updateAccountProfile
} from "../../lib/adminAccounts.js";
import { ROLES } from "../../lib/constants.js";
import { roleLabel } from "../../lib/utils.js";
import { Alert } from "../ui/alert.jsx";
import { Badge } from "../ui/badge.jsx";
import { Button } from "../ui/button.jsx";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card.jsx";
import { Dialog } from "../ui/dialog.jsx";
import { DetailRow } from "../ui/drawer.jsx";
import { EmptyState } from "../ui/empty-state.jsx";
import { Field, Input, Select } from "../ui/field.jsx";
import { PageHeader } from "../ui/page-header.jsx";
import { SegmentedControl } from "../ui/segmented-control.jsx";
import { Skeleton } from "../ui/skeleton.jsx";
import { StatusBadge } from "../ui/status-badge.jsx";
import { TabPanel, Tabs } from "../ui/tabs.jsx";
import { AccountStatusBadge, ReasonDialog, fmtWhen } from "./adminShared.jsx";
import { InviteLinkPanel } from "./InviteDialog.jsx";
import { ROLE_KIND_LABEL } from "./AdminRoles.jsx";


// ---------------- Profile tab ----------------

function ProfileTab({ account, isSelf, onChanged }) {
  const { lang, session, can, data, showToast, requestConfirm } = useApp();
  const t = useT();
  const [name, setName] = useState(account.name);
  const [saving, setSaving] = useState(false);
  useEffect(() => { setName(account.name); }, [account.name]);

  // profiles.role changes stay with administrators (the database's rule).
  const canChangeType = !isSelf && session && session.role === "administrator";
  const canEditName = can("admin.users.edit") || isSelf;
  const byName = (id) => {
    const p = (data.profiles || []).find((x) => x.id === id);
    return p ? p.name || p.email : "";
  };

  async function saveName() {
    if (!name.trim() || name.trim() === account.name) return;
    setSaving(true);
    try { await updateAccountProfile(account.id, { name: name.trim() }); showToast(t("adminSaved")); onChanged(); }
    catch (e) { showToast(t(adminErrorKey(e))); }
    setSaving(false);
  }

  async function changeType(next) {
    if (next === account.role) return;
    if (next === "administrator" && !(await requestConfirm(t("confirmMakeAdministrator").replace("{name}", account.name || account.email)))) return;
    try { await updateAccountProfile(account.id, { role: next }); showToast(t("adminSaved")); onChanged(); }
    catch (e) { showToast(t(adminErrorKey(e))); }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader><CardTitle>{t("adminDetailsTitle")}</CardTitle></CardHeader>
        <CardContent className="grid gap-4">
          <Field label={t("fullNameLabel")} htmlFor="profile-name">
            <div className="flex gap-2">
              <Input id="profile-name" value={name} onChange={(e) => setName(e.target.value)} disabled={!canEditName} maxLength={120} />
              {canEditName ? <Button variant="secondary" onClick={saveName} loading={saving} disabled={!name.trim() || name.trim() === account.name}>{t("saveLabel")}</Button> : null}
            </div>
          </Field>
          <Field label={t("emailAddressCol")} htmlFor="profile-email" hint={t("adminEmailHint")}>
            <Input id="profile-email" value={account.email} disabled />
          </Field>
          <Field label={t("adminAccountTypeLabel")} htmlFor="profile-type" hint={t("adminAccountTypeProfileHint")}>
            <Select id="profile-type" value={account.role} onChange={(e) => changeType(e.target.value)} disabled={!canChangeType}>
              {ROLES.map((r) => <option key={r} value={r}>{roleLabel(r, lang)}</option>)}
            </Select>
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>{t("adminSignInTitle")}</CardTitle></CardHeader>
        <CardContent>
          <dl className="m-0">
            <DetailRow label={t("statusLabel")}><AccountStatusBadge account={account} /></DetailRow>
            <DetailRow label={t("adminCreatedLabel")}>{fmtWhen(account.createdAt, lang)}</DetailRow>
            {account.invitedAt ? <DetailRow label={t("adminInvitedLabel")}>{fmtWhen(account.invitedAt, lang, true)}</DetailRow> : null}
            <DetailRow label={t("adminLastSignInCol")}>{account.lastSignInAt ? fmtWhen(account.lastSignInAt, lang, true) : t("adminNeverSignedIn")}</DetailRow>
            <DetailRow label={t("adminOpenSessions")}>{account.sessionCount}</DetailRow>
            {account.deactivatedAt ? (
              <DetailRow label={t("adminDeactivatedLabel")}>
                {fmtWhen(account.deactivatedAt, lang, true)}{account.deactivatedBy && byName(account.deactivatedBy) ? " · " + byName(account.deactivatedBy) : ""}
              </DetailRow>
            ) : null}
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------- Positions tab ----------------

function PositionsTab({ account, positions, onChanged }) {
  const { can, showToast } = useApp();
  const t = useT();
  const [adding, setAdding] = useState("");
  const [busy, setBusy] = useState(false);
  const editable = can("admin.positions.manage");
  const held = new Set(account.positions.map((p) => p.id));
  const available = (positions || []).filter((p) => !p.archivedAt && !held.has(p.id));

  async function run(fn) {
    setBusy(true);
    try { await fn(); onChanged(); } catch (e) { showToast(t(adminErrorKey(e))); }
    setBusy(false);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("adminSectionPositions")}</CardTitle>
        <CardDescription>{t("adminPositionsTabDesc")}</CardDescription>
      </CardHeader>
      <CardContent>
        {account.positions.length ? (
          <ul className="m-0 list-none divide-y divide-line-subtle rounded-control border border-border p-0">
            {account.positions.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="text-ui font-semibold text-card-foreground">{p.name}</span>
                  {p.isPrimary ? <Badge variant="info"><Star className="h-3 w-3" aria-hidden="true" />{t("adminPrimaryLabel")}</Badge> : null}
                </div>
                {editable ? (
                  <div className="flex gap-2">
                    {!p.isPrimary ? <Button size="sm" variant="ghost" disabled={busy} onClick={() => run(() => setPrimaryPosition(account.id, p.id))}>{t("adminMakePrimary")}</Button> : null}
                    <Button size="sm" variant="ghost" disabled={busy} onClick={() => run(() => removeUserPosition(account.id, p.id))}>
                      <Trash2 className="h-4 w-4" aria-hidden="true" />{t("adminRemove")}
                    </Button>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState compact title={t("adminNoPositions")} description={editable ? t("adminNoPositionsHint") : undefined} />
        )}
        {editable ? (
          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-end">
            <Field label={t("adminAddPosition")} htmlFor="add-position" className="flex-1">
              <Select id="add-position" value={adding} onChange={(e) => setAdding(e.target.value)}>
                <option value="">{t("adminChoosePosition")}</option>
                {available.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </Select>
            </Field>
            <Button variant="secondary" disabled={!adding || busy}
              onClick={() => run(() => addUserPosition(account.id, adding, account.positions.length === 0)).then(() => setAdding(""))}>
              <Plus className="h-4 w-4" aria-hidden="true" />{t("adminAdd")}
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

// ---------------- Roles tab ----------------

function AddRoleDialog({ open, onClose, account, catalog, onAdded }) {
  const { showToast } = useApp();
  const t = useT();
  const [roleId, setRoleId] = useState("");
  const [program, setProgram] = useState("");
  const [expires, setExpires] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) { setRoleId(""); setProgram(""); setExpires(""); setReason(""); setBusy(false); } }, [open]);

  const roles = assignableRoles(catalog.roles);
  const programs = catalog.modules.filter((m) => m.kind === "program" && m.active && m.implemented);

  async function submit(e) {
    e.preventDefault();
    if (!roleId) return;
    setBusy(true);
    try {
      await assignRole(account.id, roleId, program, expires ? new Date(expires + "T23:59:59").toISOString() : null, reason.trim());
      showToast(t("adminRoleAdded"));
      onAdded();
      onClose();
    } catch (err) { showToast(t(adminErrorKey(err))); }
    setBusy(false);
  }

  return (
    <Dialog open={open} onClose={busy ? () => {} : onClose} title={t("adminAddRole")} description={t("adminAddRoleDesc").replace("{name}", account.name || account.email)}
      size="md" closeLabel={t("closeLabel")} as="form" panelProps={{ onSubmit: submit, noValidate: true }}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>{t("cancelLabel")}</Button>
          <Button type="submit" loading={busy} disabled={!roleId}>{t("adminAddRole")}</Button>
        </>
      }>
      <div className="grid gap-4">
        <Field label={t("adminRoleLabel")} htmlFor="add-role" required>
          <Select id="add-role" value={roleId} onChange={(e) => setRoleId(e.target.value)} data-autofocus>
            <option value="">{t("adminChooseRole")}</option>
            {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </Select>
        </Field>
        <Field label={t("adminProgramLabel")} htmlFor="add-role-program" hint={t("adminProgramHint")}>
          <Select id="add-role-program" value={program} onChange={(e) => setProgram(e.target.value)}>
            <option value="">{t("adminAllPrograms")}</option>
            {programs.map((m) => <option key={m.key} value={m.key}>{m.name}</option>)}
          </Select>
        </Field>
        <Field label={t("adminExpiresLabel")} htmlFor="add-role-expires" hint={t("adminExpiresHint")}>
          <Input id="add-role-expires" type="date" value={expires} onChange={(e) => setExpires(e.target.value)} />
        </Field>
        <Field label={t("adminReasonOptionalLabel")} htmlFor="add-role-reason" hint={t("adminReasonHint")}>
          <Input id="add-role-reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={1000} />
        </Field>
      </div>
    </Dialog>
  );
}

function RolesTab({ account, isSelf, catalog, onChanged }) {
  const { can, lang, showToast } = useApp();
  const t = useT();
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState(null);
  const editable = can("admin.permissions.assign") && !isSelf;
  const programName = (key) => {
    const m = catalog && catalog.modules.find((x) => x.key === key);
    return m ? m.name : key;
  };

  return (
    <>
      <Alert tone="info" title={t("adminRolesNotLiveTitle")} className="mb-4">
        {t("adminRolesNotLiveBody").replace("{type}", roleLabel(account.role, lang))}
      </Alert>
      <Card>
        <CardHeader className="flex-row flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>{t("adminSectionRoles")}</CardTitle>
            <CardDescription>{t("adminRolesTabDesc")}</CardDescription>
          </div>
          {editable && catalog ? <Button variant="secondary" onClick={() => setAdding(true)}><Plus className="h-4 w-4" aria-hidden="true" />{t("adminAddRole")}</Button> : null}
        </CardHeader>
        <CardContent>
          {account.roles.length ? (
            <ul className="m-0 list-none divide-y divide-line-subtle rounded-control border border-border p-0">
              {account.roles.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-ui font-semibold text-card-foreground">{r.name}</span>
                      <StatusBadge domain="roleKind" status={r.kind}>{t(ROLE_KIND_LABEL[r.kind])}</StatusBadge>
                    </div>
                    <div className="mt-0.5 text-meta text-muted">
                      {r.programKey ? programName(r.programKey) : t("adminAllPrograms")}
                      {r.source === "legacy_sync" ? " · " + t("adminRoleAutomatic") : ""}
                      {r.expiresAt ? " · " + t("adminExpiresOn").replace("{date}", fmtWhen(r.expiresAt, lang)) : ""}
                    </div>
                  </div>
                  {editable && r.source === "admin" ? (
                    <Button size="sm" variant="ghost" onClick={() => setRemoving(r)}><Trash2 className="h-4 w-4" aria-hidden="true" />{t("adminRemove")}</Button>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState compact title={t("adminNoRoles")} />
          )}
        </CardContent>
      </Card>

      {catalog ? <AddRoleDialog open={adding} onClose={() => setAdding(false)} account={account} catalog={catalog} onAdded={onChanged} /> : null}
      <ReasonDialog
        open={!!removing}
        onClose={() => setRemoving(null)}
        required={false}
        title={t("adminRemoveRoleTitle").replace("{role}", removing ? removing.name : "")}
        description={t("adminRemoveRoleDesc")}
        confirmLabel={t("adminRemove")}
        danger
        onConfirm={async (reason) => {
          try { await revokeRole(removing.id, reason); showToast(t("adminRoleRemoved")); onChanged(); return true; }
          catch (e) { showToast(t(adminErrorKey(e))); return false; }
        }}
      />
    </>
  );
}

// ---------------- page ----------------

function useAccountActions(account, reload) {
  const { showToast } = useApp();
  const t = useT();
  // Wraps a call: toast its error, keep the dialog open on failure.
  return useCallback(async (fn, successKey) => {
    try { await fn(); if (successKey) showToast(t(successKey)); reload(); return true; }
    catch (e) { showToast(t(adminErrorKey(e))); return false; }
  }, [reload, showToast, t]);
}

export default function AdminUserProfile({ userId }) {
  const { session, can } = useApp();
  const t = useT();
  const navigate = useNavigate();
  const [account, setAccount] = useState(undefined);
  const [catalog, setCatalog] = useState(null);
  const [positions, setPositions] = useState(null);
  const [tab, setTab] = useState("profile");
  const [dialog, setDialog] = useState(null);
  const [resendDelivery, setResendDelivery] = useState("email");
  const [inviteLink, setInviteLink] = useState(null);

  const reload = useCallback(() => {
    fetchAccount(userId).then(setAccount).catch(() => setAccount(null));
  }, [userId]);
  useEffect(() => { setAccount(undefined); reload(); }, [reload]);
  useEffect(() => {
    fetchAccessCatalog().then(setCatalog).catch(() => setCatalog(null));
    fetchPositions().then(setPositions).catch(() => setPositions([]));
  }, []);
  const act = useAccountActions(account, reload);

  const isSelf = !!(session && session.id === userId);
  const status = account ? accountStatus(account) : null;
  const back = { label: t("adminBackToAccounts"), onClick: () => navigate("/admin/users") };

  const actions = useMemo(() => {
    if (!account || isSelf) return [];
    const out = [];
    if (status === "invited" && can("admin.users.invite")) out.push({ key: "resend", label: t("adminResendInvite"), icon: Mail, variant: "secondary" });
    if (status === "active" && can("admin.users.edit")) out.push({ key: "reset", label: t("adminSendReset"), icon: KeyRound, variant: "secondary" });
    // Any status: accounts switched off before Phase 2 can still hold old sessions.
    if (account.sessionCount > 0 && can("admin.users.revoke_sessions")) out.push({ key: "signout", label: t("adminSignOutEverywhere"), icon: LogOut, variant: "secondary" });
    if (status === "inactive" && can("admin.users.deactivate")) out.push({ key: "approve", label: t("adminApprove"), icon: UserCheck, variant: "primary" });
    if (status === "deactivated" && can("admin.users.deactivate")) out.push({ key: "reactivate", label: t("adminReactivate"), icon: UserCheck, variant: "primary" });
    if ((status === "active" || status === "invited") && can("admin.users.deactivate")) out.push({ key: "deactivate", label: t("adminDeactivate"), icon: UserX, variant: "danger" });
    return out;
  }, [account, isSelf, status, can, t]);

  if (account === undefined) {
    return <div className="space-y-4" aria-busy="true"><Skeleton className="h-16 w-1/2" /><Skeleton className="h-64 w-full" /></div>;
  }
  if (account === null) {
    return (
      <>
        <PageHeader title={t("adminAccountNotFound")} back={back} />
        <Card><EmptyState variant="error" title={t("adminAccountNotFound")} description={t("adminAccountNotFoundHint")} /></Card>
      </>
    );
  }

  const who = account.name || account.email;
  const DIALOGS = {
    deactivate: {
      title: t("adminDeactivateTitle").replace("{name}", who), description: t("adminDeactivateDesc"), confirm: t("adminDeactivate"), danger: true,
      run: (reason) => act(() => setAccountActive(account.id, false, reason), "adminDeactivated")
    },
    reactivate: {
      title: t("adminReactivateTitle").replace("{name}", who), description: t("adminReactivateDesc"), confirm: t("adminReactivate"),
      run: (reason) => act(() => setAccountActive(account.id, true, reason), "adminReactivated")
    },
    approve: {
      title: t("adminApproveTitle").replace("{name}", who), description: t("adminApproveDesc"), confirm: t("adminApprove"),
      run: (reason) => act(() => setAccountActive(account.id, true, reason), "adminApproved")
    },
    signout: {
      title: t("adminSignOutTitle").replace("{name}", who), description: t("adminSignOutDesc"), confirm: t("adminSignOutEverywhere"), danger: true,
      run: (reason) => act(() => revokeSessions(account.id, reason), "adminSignedOut")
    },
    reset: {
      title: t("adminResetTitle").replace("{name}", who), description: t("adminResetDesc").replace("{email}", account.email), confirm: t("adminSendReset"), optional: true,
      run: (reason) => act(() => sendPasswordReset(account.id, reason), "adminResetSent")
    },
    resend: {
      title: t("adminResendTitle").replace("{name}", who), description: t("adminResendDesc"), confirm: t("adminResendInvite"), optional: true,
      run: (reason) => act(async () => {
        const res = await resendInvite(account.id, resendDelivery, reason);
        if (res && res.link) setInviteLink(res.link);
      }, resendDelivery === "email" ? "adminInviteResent" : null)
    }
  };
  const open = dialog && DIALOGS[dialog];

  return (
    <>
      <PageHeader
        back={back}
        title={who}
        meta={
          <>
            <AccountStatusBadge account={account} />
            {account.name ? <span className="text-meta text-muted">{account.email}</span> : null}
            {isSelf ? <Badge variant="info">{t("thisIsYou")}</Badge> : null}
          </>
        }
        actions={actions.length ? actions.map((a) => (
          <Button key={a.key} variant={a.variant} onClick={() => { setResendDelivery("email"); setDialog(a.key); }}>
            <a.icon className="h-4 w-4" aria-hidden="true" />{a.label}
          </Button>
        )) : null}
      />

      {isSelf ? <Alert tone="info" className="mb-4" title={t("adminOwnAccountTitle")}>{t("adminOwnAccountBody")}</Alert> : null}

      <Tabs
        label={t("adminAccountTabs")}
        idBase="account"
        value={tab}
        onChange={setTab}
        items={[
          { value: "profile", label: t("adminTabProfile") },
          { value: "positions", label: t("adminSectionPositions"), count: account.positions.length },
          { value: "programs", label: t("adminTabPrograms") },
          { value: "roles", label: t("adminSectionRoles"), count: account.roles.filter((r) => r.source === "admin").length }
        ]}
      />
      <TabPanel idBase="account" value={tab} className="pt-6">
        {tab === "profile" ? <ProfileTab account={account} isSelf={isSelf} onChanged={reload} /> : null}
        {tab === "positions" ? <PositionsTab account={account} positions={positions} onChanged={reload} /> : null}
        {tab === "programs" ? <ProgramAccessTab account={account} isSelf={isSelf} catalog={catalog} /> : null}
        {tab === "roles" ? <RolesTab account={account} isSelf={isSelf} catalog={catalog} onChanged={reload} /> : null}
      </TabPanel>

      <ReasonDialog
        open={!!open}
        onClose={() => setDialog(null)}
        title={open ? open.title : ""}
        description={open ? open.description : ""}
        confirmLabel={open ? open.confirm : ""}
        danger={open && open.danger}
        required={!(open && open.optional)}
        onConfirm={(reason) => open.run(reason)}
      >
        {dialog === "resend" ? (
          <Field label={t("adminDeliveryLabel")} hint={resendDelivery === "email" ? t("adminDeliveryEmailHint") : t("adminDeliveryLinkHint")}>
            <SegmentedControl className="self-start" label={t("adminDeliveryLabel")} value={resendDelivery} onChange={setResendDelivery}
              options={[{ value: "email", label: t("adminDeliveryEmail") }, { value: "link", label: t("adminDeliveryLink") }]} />
          </Field>
        ) : null}
      </ReasonDialog>

      <Dialog open={!!inviteLink} onClose={() => setInviteLink(null)} title={t("adminInviteCreated")} description={t("adminInviteCreatedDesc").replace("{name}", who)}
        size="md" closeLabel={t("closeLabel")} footer={<Button onClick={() => setInviteLink(null)}>{t("doneLabel")}</Button>}>
        {inviteLink ? <InviteLinkPanel link={inviteLink} /> : null}
      </Dialog>
    </>
  );
}
