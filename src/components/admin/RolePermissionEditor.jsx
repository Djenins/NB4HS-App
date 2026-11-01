// RolePermissionEditor.jsx -- edit what a role allows (plans/unified-access-
// architecture.md §6, "role editor: the hierarchical tree with scope
// pickers ... and an impact preview before saving"). Ticks and scopes are
// staged; Save previews who gains or loses what (preview_role_permissions)
// and asks for a reason -- plus a typed confirmation when a sensitive or
// administration permission is added -- before admin_set_role_permissions
// saves the whole list in one audited step.
import { useMemo, useState } from "react";
import { useApp, useT } from "../../context/AppContext.jsx";
import { adminErrorKey } from "../../lib/adminAccounts.js";
import {
  SCOPES, diffDraft, isHighRisk, permissionTree, previewRolePermissions, saveRolePermissions, summarizeRolePreview
} from "../../lib/permissionAdmin.js";
import { Badge } from "../ui/badge.jsx";
import { Button } from "../ui/button.jsx";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card.jsx";
import { Select } from "../ui/field.jsx";
import { ChangeList, ReviewChangesDialog, SCOPE_LABEL, SensitivityBadge, countLabel } from "./adminShared.jsx";

function Node({ node, depth, draft, onToggle, onScope }) {
  const t = useT();
  const Heading = depth === 0 ? "h3" : "h4";
  return (
    <section className={depth ? "mt-3" : "mt-5 first:mt-0"}>
      <Heading className="m-0 mb-2 text-meta font-semibold uppercase tracking-wide text-muted">{node.module.name}</Heading>
      {node.permissions.length ? (
        <ul className="m-0 list-none divide-y divide-line-subtle rounded-control border border-border p-0">
          {node.permissions.map((p) => {
            const on = p.key in draft;
            const id = "rp-" + p.key.replace(/\./g, "-");
            return (
              <li key={p.key} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                <label htmlFor={id} className="flex min-w-0 cursor-pointer items-center gap-2.5 text-ui text-card-foreground">
                  <input id={id} type="checkbox" className="h-4 w-4 cursor-pointer accent-primary" checked={on} onChange={() => onToggle(p)} />
                  <span>{p.label}</span>
                  <SensitivityBadge sensitivity={p.sensitivity} />
                </label>
                {on && p.scoped ? (
                  <Select aria-label={t("adminScopeFor").replace("{permission}", p.label)} className="w-auto min-w-[11rem]"
                    value={draft[p.key] || "assigned"} onChange={(e) => onScope(p.key, e.target.value)}>
                    {SCOPES.map((s) => <option key={s} value={s}>{t(SCOPE_LABEL[s])}</option>)}
                  </Select>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}
      {node.children.map((c) => <Node key={c.module.key} node={c} depth={depth + 1} draft={draft} onToggle={onToggle} onScope={onScope} />)}
    </section>
  );
}

export default function RolePermissionEditor({ role, catalog, initial, onCancel, onSaved }) {
  const { data, showToast } = useApp();
  const t = useT();
  const [draft, setDraft] = useState(initial);
  const [reviewing, setReviewing] = useState(false);
  const [preview, setPreview] = useState(null);

  const tree = useMemo(() => permissionTree(catalog), [catalog]);
  const permsByKey = useMemo(() => {
    const out = {};
    catalog.permissions.forEach((p) => { out[p.key] = p; });
    return out;
  }, [catalog]);
  const diff = diffDraft(initial, draft);
  const changeCount = diff.added.length + diff.removed.length + diff.changed.length;
  const highRisk = isHighRisk(diff.added.map((a) => a.key).concat(diff.changed.map((c) => c.key)), permsByKey);

  function toggle(p) {
    setDraft((cur) => {
      const next = Object.assign({}, cur);
      if (p.key in next) delete next[p.key];
      else next[p.key] = p.scoped ? "assigned" : null;
      return next;
    });
  }
  const setScope = (key, scope) => setDraft((cur) => Object.assign({}, cur, { [key]: scope }));

  function openReview() {
    setReviewing(true);
    setPreview({ loading: true });
    previewRolePermissions(role.id, draft)
      .then((rows) => setPreview({ people: summarizeRolePreview(rows) }))
      .catch((e) => setPreview({ error: t(adminErrorKey(e)) }));
  }

  const labelOf = (key) => (permsByKey[key] ? permsByKey[key].label : key);
  const scopeText = (s) => (s ? t(SCOPE_LABEL[s]) : "");
  const nameOf = (id) => {
    const p = (data.profiles || []).find((x) => x.id === id);
    return p ? p.name || p.email : id;
  };
  const people = preview && preview.people ? Object.keys(preview.people) : [];

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>{t("adminEditPermissions")}</CardTitle>
          <CardDescription>{t("adminEditPermissionsDesc")}</CardDescription>
        </CardHeader>
        <CardContent>
          {tree.map((node) => <Node key={node.module.key} node={node} depth={0} draft={draft} onToggle={toggle} onScope={setScope} />)}
        </CardContent>
      </Card>

      <div role="region" aria-label={t("adminStagedChanges")}
        className="sticky bottom-4 z-10 mt-4 flex flex-wrap items-center justify-between gap-3 rounded-surface border border-border bg-card px-4 py-3 shadow-overlay">
        <span className="text-ui font-semibold text-card-foreground">
          {changeCount ? (changeCount === 1 ? t("adminOneStaged") : t("adminNStaged").replace("{n}", changeCount)) : t("adminNoChangesYet")}
        </span>
        <span className="flex gap-2">
          <Button variant="secondary" onClick={onCancel}>{t("cancelLabel")}</Button>
          <Button onClick={openReview} disabled={!changeCount}>{t("adminReviewAndSave")}</Button>
        </span>
      </div>

      <ReviewChangesDialog
        open={reviewing}
        onClose={() => setReviewing(false)}
        title={t("adminReviewRoleTitle").replace("{name}", role.name)}
        description={t("adminReviewRoleDesc")}
        confirmLabel={t("adminSaveChanges")}
        highRisk={highRisk}
        confirmPhrase={role.name}
        loading={!!(preview && preview.loading)}
        error={preview && preview.error}
        onConfirm={async (reason) => {
          try {
            await saveRolePermissions(role.id, draft, reason);
            showToast(t("adminSaved"));
            onSaved();
            return true;
          } catch (e) { showToast(t(adminErrorKey(e))); return false; }
        }}
      >
        <div className="grid gap-4">
          <ChangeList title={t("adminRoleAdds")} tone="success"
            items={diff.added.map((a) => ({ key: a.key, label: labelOf(a.key), meta: scopeText(a.scope) }))} />
          <ChangeList title={t("adminRoleRemoves")} tone="danger"
            items={diff.removed.map((a) => ({ key: a.key, label: labelOf(a.key), meta: scopeText(a.scope) }))} />
          <ChangeList title={t("adminScopeChanges")} tone="warning"
            items={diff.changed.map((c) => ({ key: c.key, label: labelOf(c.key), meta: scopeText(c.from) + " → " + scopeText(c.to) }))} />
          {preview && preview.people ? (
            <section>
              <h3 className="m-0 mb-2 text-meta font-semibold uppercase tracking-wide text-muted">
                {countLabel(t, people.length, "adminAffectsOne", "adminAffectsN")}
              </h3>
              {people.length ? (
                <ul className="m-0 grid list-none gap-1 p-0 text-ui text-card-foreground">
                  {people.map((id) => {
                    const p = preview.people[id];
                    return (
                      <li key={id} className="flex flex-wrap items-center gap-2">
                        {nameOf(id)}
                        {p.added ? <Badge variant="success">+{p.added}</Badge> : null}
                        {p.removed ? <Badge variant="danger">−{p.removed}</Badge> : null}
                        {p.changed ? <Badge variant="warning">~{p.changed}</Badge> : null}
                      </li>
                    );
                  })}
                </ul>
              ) : <p className="m-0 text-meta text-muted">{t("adminAffectsNobodyHint")}</p>}
            </section>
          ) : null}
        </div>
      </ReviewChangesDialog>
    </>
  );
}
