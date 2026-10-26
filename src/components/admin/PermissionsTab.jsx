// PermissionsTab.jsx -- the Detailed Permissions tab of a staff account
// (plans/unified-access-architecture.md §6): every permission, grouped by
// program and module, with where it comes from --
//   ● from a role (which ones)   ◐ an individual grant   ✕ an individual deny   ○ not held
// -- and its scope. An admin who can assign access stages individual grants
// and denies here; Save previews the result (preview_effective_permissions)
// and asks for a reason, plus a typed confirmation when a sensitive or
// administration permission is involved. Nothing changes until then.
import { useCallback, useEffect, useMemo, useState } from "react";
import { Ban, CircleDot, MoreHorizontal, Plus, Undo2, X } from "lucide-react";
import { useApp, useT } from "../../context/AppContext.jsx";
import { adminErrorKey, fetchProgramAccess } from "../../lib/adminAccounts.js";
import {
  SCOPES, applyUserChanges, fetchUserAccess, isHighRisk, permissionState, permissionTree, previewUserChanges, summarizePreview
} from "../../lib/permissionAdmin.js";
import { cn } from "../../lib/cn.js";
import { Alert } from "../ui/alert.jsx";
import { Badge } from "../ui/badge.jsx";
import { Button } from "../ui/button.jsx";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card.jsx";
import { Dialog } from "../ui/dialog.jsx";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../ui/dropdown-menu.jsx";
import { Field, Input, Select } from "../ui/field.jsx";
import { IconButton } from "../ui/icon-button.jsx";
import { Skeleton } from "../ui/skeleton.jsx";
import { ChangeList, ReviewChangesDialog, SCOPE_LABEL, SensitivityBadge, fmtWhen } from "./adminShared.jsx";

// The origin marker: shape and text together, never colour alone.
function Origin({ state, staged }) {
  const t = useT();
  let icon = "○";
  let text = t("adminOriginNone");
  let cls = "text-muted";
  if (state.deny) { icon = "✕"; text = t("adminOriginDeny"); cls = "text-tone-danger-ink"; }
  else if (state.grant) { icon = "◐"; text = t("adminOriginGrant"); cls = "text-tone-info-ink"; }
  else if (state.held) { icon = "●"; text = state.roles.length ? state.roles.join(", ") : t("adminOriginRole"); cls = "text-tone-success-ink"; }
  return (
    <span className={cn("inline-flex min-w-0 items-center gap-1.5 text-meta", cls)}>
      <span aria-hidden="true" className="w-3 text-center font-semibold">{icon}</span>
      <span className="truncate">{text}</span>
      {staged ? <Badge variant="warning">{t("adminStaged")}</Badge> : null}
    </span>
  );
}

// Stage one grant or deny: scope (scoped permissions) and an optional end date.
function OverrideDialog({ request, onClose, onStage }) {
  const t = useT();
  const [scope, setScope] = useState("");
  const [until, setUntil] = useState("");
  useEffect(() => {
    if (request) { setScope(request.effect === "grant" && request.permission.scoped ? "assigned" : ""); setUntil(""); }
  }, [request]);
  if (!request) return <Dialog open={false} onClose={onClose} title="" />;
  const { permission, effect } = request;
  const grant = effect === "grant";

  function submit(e) {
    e.preventDefault();
    onStage({
      type: "add", permissionKey: permission.key, effect, scope: permission.scoped ? scope || null : null,
      programKey: request.programKey || null, expiresAt: until ? new Date(until + "T23:59:59").toISOString() : null
    });
    onClose();
  }

  return (
    <Dialog open onClose={onClose} title={t(grant ? "adminGrantTitle" : "adminDenyTitle").replace("{permission}", permission.label)}
      description={t(grant ? "adminGrantDesc" : "adminDenyDesc")} size="sm" closeLabel={t("closeLabel")}
      as="form" panelProps={{ onSubmit: submit, noValidate: true }}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose}>{t("cancelLabel")}</Button>
          <Button type="submit" variant={grant ? "primary" : "danger"} disabled={grant && permission.scoped && !scope}>{t("adminStageChange")}</Button>
        </>
      }>
      <div className="grid gap-4">
        {permission.scoped ? (
          <Field label={t(grant ? "adminScopeLabel" : "adminDenyScopeLabel")} htmlFor="override-scope" hint={t(grant ? "adminScopeHint" : "adminDenyScopeHint")}>
            <Select id="override-scope" value={scope} onChange={(e) => setScope(e.target.value)} data-autofocus>
              {grant ? null : <option value="">{t("adminDenyEntirely")}</option>}
              {SCOPES.map((s) => <option key={s} value={s}>{t(SCOPE_LABEL[s])}</option>)}
            </Select>
          </Field>
        ) : null}
        <Field label={t("adminUntilLabel")} htmlFor="override-until" hint={t("adminUntilHint")}>
          <Input id="override-until" type="date" value={until} min={new Date().toISOString().slice(0, 10)} onChange={(e) => setUntil(e.target.value)} />
        </Field>
      </div>
    </Dialog>
  );
}

function PermissionRow({ permission, state, staged, editable, onGrant, onDeny, onRemove, onUnstage }) {
  const t = useT();
  const { lang } = useApp();
  const override = state.deny || state.grant;
  return (
    <li className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 px-3 py-2.5">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2 text-ui text-card-foreground">
          <span>{permission.label}</span>
          {state.scope ? <Badge variant="neutral">{t(SCOPE_LABEL[state.scope])}</Badge> : null}
          <SensitivityBadge sensitivity={permission.sensitivity} />
        </div>
        <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-0.5">
          <Origin state={state} staged={staged} />
          {override ? (
            <span className="text-meta text-muted">
              {override.expiresAt ? t("adminOverrideUntil").replace("{date}", fmtWhen(override.expiresAt, lang)) + " · " : ""}
              {override.reason}
            </span>
          ) : null}
        </div>
      </div>
      {editable ? (
        staged ? (
          <Button size="sm" variant="ghost" onClick={onUnstage}><Undo2 className="h-4 w-4" aria-hidden="true" />{t("adminUndo")}</Button>
        ) : (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <IconButton label={t("adminPermissionActions").replace("{permission}", permission.label)} variant="ghost" size="sm">
                <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
              </IconButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {!state.grant ? <DropdownMenuItem onSelect={onGrant}><Plus className="h-4 w-4" aria-hidden="true" />{t("adminGrantIndividually")}</DropdownMenuItem> : null}
              {!state.deny ? <DropdownMenuItem onSelect={onDeny}><Ban className="h-4 w-4" aria-hidden="true" />{t("adminDenyIndividually")}</DropdownMenuItem> : null}
              {override ? <DropdownMenuItem onSelect={onRemove}><X className="h-4 w-4" aria-hidden="true" />{t(state.deny ? "adminRemoveDeny" : "adminRemoveGrant")}</DropdownMenuItem> : null}
            </DropdownMenuContent>
          </DropdownMenu>
        )
      ) : null}
    </li>
  );
}

function ModuleSection({ node, depth, render }) {
  const Heading = depth === 0 ? "h3" : "h4";
  return (
    <section className={depth ? "mt-4" : undefined}>
      {depth ? <Heading className="m-0 mb-2 text-meta font-semibold uppercase tracking-wide text-muted">{node.module.name}</Heading> : null}
      {node.permissions.length ? (
        <ul className="m-0 list-none divide-y divide-line-subtle rounded-control border border-border p-0">{node.permissions.map(render)}</ul>
      ) : null}
      {node.children.map((c) => <ModuleSection key={c.module.key} node={c} depth={depth + 1} render={render} />)}
    </section>
  );
}

export default function PermissionsTab({ account, isSelf, catalog }) {
  const { can, showToast } = useApp();
  const t = useT();
  const [access, setAccess] = useState(null);
  const [programs, setPrograms] = useState(null);
  const [failed, setFailed] = useState(false);
  const [staged, setStaged] = useState([]);
  const [request, setRequest] = useState(null); // { permission, effect, programKey }
  const [reviewing, setReviewing] = useState(false);
  const [preview, setPreview] = useState(null); // { loading, error, summary }

  const load = useCallback(() => {
    setFailed(false);
    return Promise.all([fetchUserAccess(account.id), fetchProgramAccess(account.id)])
      .then(([a, p]) => { setAccess(a); setPrograms(p); })
      .catch(() => setFailed(true));
  }, [account.id]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { setStaged([]); }, [account.id]);

  const tree = useMemo(() => (catalog ? permissionTree(catalog) : []), [catalog]);
  const permsByKey = useMemo(() => {
    const out = {};
    (catalog ? catalog.permissions : []).forEach((p) => { out[p.key] = p; });
    return out;
  }, [catalog]);
  const editable = can("admin.permissions.assign") && !isSelf;
  const who = account.name || account.email;

  if (failed) return <Alert tone="danger" title={t("adminLoadFailed")} action={<Button size="sm" variant="secondary" onClick={load}>{t("retryLabel")}</Button>} />;
  if (!catalog || !access || !programs) {
    return <div className="space-y-3" aria-busy="true">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-32 w-full" />)}</div>;
  }

  const stagedFor = (key) => staged.find((c) => c.permissionKey === key);
  const stage = (change) => setStaged((cur) => cur.filter((c) => c.permissionKey !== change.permissionKey).concat([change]));
  const unstage = (key) => setStaged((cur) => cur.filter((c) => c.permissionKey !== key));

  function openReview() {
    setReviewing(true);
    setPreview({ loading: true });
    previewUserChanges(account.id, staged)
      .then((rows) => setPreview({ summary: summarizePreview(rows) }))
      .catch((e) => setPreview({ error: t(adminErrorKey(e)) }));
  }

  const highRisk = isHighRisk(staged.map((c) => c.permissionKey), permsByKey);
  const labelOf = (key) => (permsByKey[key] ? permsByKey[key].label : key);
  const scopeText = (s) => (s ? t(SCOPE_LABEL[s]) : "");
  const summary = preview && preview.summary;

  return (
    <>
      <Alert tone="info" className="mb-4" title={t("adminPermissionsLegendTitle")}>
        <span className="flex flex-wrap gap-x-4 gap-y-1">
          <span>● {t("adminOriginRole")}</span><span>◐ {t("adminOriginGrant")}</span><span>✕ {t("adminOriginDeny")}</span><span>○ {t("adminOriginNone")}</span>
        </span>
      </Alert>

      <div className="grid gap-4">
        {tree.map((node) => {
          const isProgram = node.module.kind === "program";
          const open = !isProgram || !!programs[node.module.key];
          return (
            <Card key={node.module.key}>
              <CardHeader>
                <CardTitle className="flex flex-wrap items-center gap-2">
                  {node.module.name}
                  {!node.module.active ? <Badge variant="neutral">{t("adminModuleOff")}</Badge> : null}
                  {isProgram ? (open ? <Badge variant="success" dot>{t("adminCanOpen")}</Badge> : <Badge variant="neutral">{t("adminNoAccess")}</Badge>) : null}
                </CardTitle>
                {isProgram && !open ? <CardDescription>{t("adminNoProgramAccessHint")}</CardDescription> : null}
              </CardHeader>
              <CardContent>
                <ModuleSection node={node} depth={0} render={(p) => {
                  const st = permissionState(p.key, access.effective, access.overrides);
                  const change = stagedFor(p.key);
                  return (
                    <PermissionRow key={p.key} permission={p} state={st} staged={!!change} editable={editable}
                      onGrant={() => setRequest({ permission: p, effect: "grant", programKey: node.programKey })}
                      onDeny={() => setRequest({ permission: p, effect: "deny", programKey: node.programKey })}
                      onRemove={() => stage({ type: "revoke", id: (st.deny || st.grant).id, permissionKey: p.key })}
                      onUnstage={() => unstage(p.key)} />
                  );
                }} />
              </CardContent>
            </Card>
          );
        })}
      </div>

      {staged.length ? (
        <div role="region" aria-label={t("adminStagedChanges")}
          className="sticky bottom-4 z-10 mt-4 flex flex-wrap items-center justify-between gap-3 rounded-card border border-border bg-card px-4 py-3 shadow-overlay">
          <span className="inline-flex items-center gap-2 text-ui font-semibold text-card-foreground">
            <CircleDot className="h-4 w-4 text-tone-warning-ink" aria-hidden="true" />
            {staged.length === 1 ? t("adminOneStaged") : t("adminNStaged").replace("{n}", staged.length)}
          </span>
          <span className="flex gap-2">
            <Button variant="secondary" onClick={() => setStaged([])}>{t("adminDiscard")}</Button>
            <Button onClick={openReview}>{t("adminReviewAndSave")}</Button>
          </span>
        </div>
      ) : null}

      <OverrideDialog request={request} onClose={() => setRequest(null)} onStage={stage} />

      <ReviewChangesDialog
        open={reviewing}
        onClose={() => setReviewing(false)}
        title={t("adminReviewTitle").replace("{name}", who)}
        description={t("adminReviewDesc")}
        confirmLabel={t("adminSaveChanges")}
        highRisk={highRisk}
        confirmPhrase={who}
        loading={!!(preview && preview.loading)}
        error={preview && preview.error}
        onConfirm={async (reason) => {
          try {
            await applyUserChanges(account.id, staged, reason);
            showToast(t("adminSaved"));
            setStaged([]);
            load();
            return true;
          } catch (e) { showToast(t(adminErrorKey(e))); load(); return false; }
        }}
      >
        {summary ? (
          summary.added.length + summary.removed.length + summary.changed.length ? (
            <div className="grid gap-4">
              <ChangeList title={t("adminGains")} tone="success"
                items={summary.added.map((r) => ({ key: r.permissionKey + r.programKey, label: labelOf(r.permissionKey), meta: scopeText(r.after) }))} />
              <ChangeList title={t("adminLoses")} tone="danger"
                items={summary.removed.map((r) => ({ key: r.permissionKey + r.programKey, label: labelOf(r.permissionKey), meta: scopeText(r.before) }))} />
              <ChangeList title={t("adminScopeChanges")} tone="warning"
                items={summary.changed.map((r) => ({ key: r.permissionKey + r.programKey, label: labelOf(r.permissionKey), meta: scopeText(r.before) + " → " + scopeText(r.after) }))} />
            </div>
          ) : <p className="m-0 text-ui text-muted">{t("adminNoEffectiveChange")}</p>
        ) : null}
      </ReviewChangesDialog>
    </>
  );
}
