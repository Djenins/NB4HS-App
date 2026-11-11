// AccessLevels.jsx -- the simple access screen and its pieces
// (lib/accessLevels.js, migration a1_simple_access_levels):
//   AccessLevelsForm     one No access / Staff / Manager choice per program,
//                        plus the Front desk and Administrator switches
//                        (used here and in "Invite staff")
//   AccessSummaryBadges  the one-line summary in the staff list
//   LevelSelect          a single program's choice (each program's
//                        Staff & Access page)
//   AccessTab            the Access tab of a staff account
//
// Saving switches the person from "follows their account type" to "uses
// access levels". Nobody is switched until an admin saves their levels, and
// the form starts from what they can do today, so saving unchanged levels
// keeps the same access.
import { useCallback, useEffect, useState } from "react";
import { Settings2 } from "lucide-react";
import { useApp, useT } from "../../context/AppContext.jsx";
import { adminErrorKey } from "../../lib/adminAccounts.js";
import {
  ACCESS_PROGRAMS, LEVELS, LEVEL_LABEL, PROGRAM_LABEL, accessSummary, emptyAccess, fetchUserAccessLevels,
  sameAccess, saveAccessLevels, switchToAccountType
} from "../../lib/accessLevels.js";
import { roleLabel } from "../../lib/utils.js";
import { Alert } from "../ui/alert.jsx";
import { Badge } from "../ui/badge.jsx";
import { Button } from "../ui/button.jsx";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card.jsx";
import { Select } from "../ui/field.jsx";
import { Skeleton } from "../ui/skeleton.jsx";
import { Switch } from "../ui/switch.jsx";
import { ReasonDialog } from "./adminShared.jsx";

export function LevelSelect({ id, value, onChange, disabled, label }) {
  const t = useT();
  return (
    <Select id={id} value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} aria-label={label} className="w-40">
      {LEVELS.map((l) => <option key={l} value={l}>{t(LEVEL_LABEL[l])}</option>)}
    </Select>
  );
}

function SwitchRow({ label, description, checked, onChange, disabled }) {
  const t = useT();
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
      <div className="min-w-0 flex-1">
        <div className="text-ui font-semibold text-card-foreground">{label}</div>
        <div className="text-meta text-muted">{description}</div>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} disabled={disabled} label={label} onText={t("accessOn")} offText={t("accessOff")} />
    </li>
  );
}

export function AccessLevelsForm({ value, onChange, disabled, showAdmin = true, idBase = "access" }) {
  const t = useT();
  const setLevel = (p, l) => onChange({ ...value, levels: { ...value.levels, [p]: l } });
  return (
    <div className="grid gap-4">
      <ul className="m-0 list-none divide-y divide-line-subtle rounded-control border border-border p-0">
        {ACCESS_PROGRAMS.map((p) => (
          <li key={p} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <label htmlFor={idBase + "-" + p} className="text-ui font-semibold text-card-foreground">{t(PROGRAM_LABEL[p])}</label>
            <LevelSelect id={idBase + "-" + p} value={value.levels[p]} onChange={(l) => setLevel(p, l)} disabled={disabled} />
          </li>
        ))}
      </ul>
      <p className="m-0 text-meta text-muted">{t("accessLevelsLegend")}</p>
      <ul className="m-0 list-none divide-y divide-line-subtle rounded-control border border-border p-0">
        <SwitchRow label={t("accessFrontDesk")} description={t("accessFrontDeskDesc")} checked={value.frontDesk}
          onChange={(v) => onChange({ ...value, frontDesk: v })} disabled={disabled} />
        {showAdmin ? (
          <SwitchRow label={t("accessAdministrator")} description={t("accessAdministratorDesc")} checked={value.admin}
            onChange={(v) => onChange({ ...value, admin: v })} disabled={disabled} />
        ) : null}
      </ul>
    </div>
  );
}

export function AccessSummaryBadges({ access, mode }) {
  const t = useT();
  if (!access) return <span className="text-muted">—</span>;
  const parts = accessSummary(access);
  return (
    <div className="flex flex-wrap gap-1">
      {parts.length ? parts.map((p) => (
        <Badge key={p.key} variant={p.key === "admin" ? "warning" : p.level === "manager" ? "info" : "neutral"}>
          {p.program ? t(PROGRAM_LABEL[p.program]) + (p.level === "manager" ? " · " + t("accessLevelManager") : "")
            : t(p.key === "admin" ? "accessAdministrator" : "accessFrontDesk")}
        </Badge>
      )) : <span className="text-muted">{t("accessLevelNone")}</span>}
      {mode === "account_type" ? <span className="sr-only">{t("accessFollowsAccountType")}</span> : null}
    </div>
  );
}

export default function AccessTab({ account, isSelf, onChanged, onOpenAdvanced }) {
  const { can, lang, showToast } = useApp();
  const t = useT();
  const [current, setCurrent] = useState(null); // { access, mode }
  const [draft, setDraft] = useState(emptyAccess());
  const [dialog, setDialog] = useState(null); // "save" | "revert"
  const [loadError, setLoadError] = useState(false);

  const load = useCallback(() => {
    setLoadError(false);
    return fetchUserAccessLevels(account.id)
      .then((r) => { setCurrent(r); setDraft(r.access); })
      .catch(() => setLoadError(true));
  }, [account.id]);
  useEffect(() => { load(); }, [load]);

  const editable = can("admin.permissions.assign") && !isSelf;
  const who = account.name || account.email;

  if (loadError) {
    return <Alert tone="danger" title={t("accessLoadFailed")} action={<Button variant="secondary" onClick={load}>{t("retryLabel")}</Button>} />;
  }
  if (!current) {
    return <div className="space-y-3" aria-busy="true"><Skeleton className="h-12 w-full" /><Skeleton className="h-64 w-full" /></div>;
  }

  const onLevels = current.mode === "levels";
  const dirty = !sameAccess(draft, current.access);
  const canSave = editable && (dirty || !onLevels);

  return (
    <>
      {onLevels ? null : (
        <Alert tone="info" className="mb-4" title={t("accessFollowsAccountTypeTitle")}>
          {t("accessFollowsAccountTypeBody").replace("{name}", who).replace("{type}", roleLabel(account.role, lang))}
        </Alert>
      )}
      {!account.active ? <Alert tone="warning" className="mb-4">{t("accessAccountOff")}</Alert> : null}

      <Card>
        <CardHeader>
          <CardTitle>{t("accessTitle")}</CardTitle>
          <CardDescription>{t("accessDesc").replace("{name}", who)}</CardDescription>
        </CardHeader>
        <CardContent>
          <AccessLevelsForm value={draft} onChange={setDraft} disabled={!editable} />
          {editable ? (
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <Button onClick={() => setDialog("save")} disabled={!canSave}>
                {onLevels ? t("accessSave") : t("accessSwitch")}
              </Button>
              {dirty ? <Button variant="ghost" onClick={() => setDraft(current.access)}>{t("accessUndoChanges")}</Button> : null}
              {onLevels ? (
                <Button variant="ghost" className="ml-auto" onClick={() => setDialog("revert")}>{t("accessUseAccountType")}</Button>
              ) : null}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <div className="mt-6 flex flex-wrap items-center gap-2 text-meta text-muted">
        <Settings2 className="h-4 w-4" aria-hidden="true" />
        <span>{t("accessAdvancedHint")}</span>
        <Button variant="ghost" size="sm" onClick={onOpenAdvanced}>{t("accessAdvancedOpen")}</Button>
      </div>

      <ReasonDialog
        open={dialog === "save"}
        onClose={() => setDialog(null)}
        required={false}
        danger={current.access.admin && !draft.admin}
        title={(onLevels ? t("accessSaveTitle") : t("accessSwitchTitle")).replace("{name}", who)}
        description={onLevels ? t("accessSaveDesc") : t("accessSwitchDesc")}
        confirmLabel={onLevels ? t("accessSave") : t("accessSwitch")}
        onConfirm={async (reason) => {
          try {
            await saveAccessLevels(account.id, draft, reason);
            showToast(t("accessSaved"));
            await load();
            onChanged();
            return true;
          } catch (e) { showToast(t(adminErrorKey(e))); return false; }
        }}
      />
      <ReasonDialog
        open={dialog === "revert"}
        onClose={() => setDialog(null)}
        required={false}
        danger
        title={t("accessUseAccountTypeTitle").replace("{name}", who)}
        description={t("accessUseAccountTypeDesc").replace("{type}", roleLabel(account.accountTypeBefore || account.role, lang))}
        confirmLabel={t("accessUseAccountType")}
        onConfirm={async (reason) => {
          try {
            await switchToAccountType(account.id, reason);
            showToast(t("accessSaved"));
            await load();
            onChanged();
            return true;
          } catch (e) { showToast(t(adminErrorKey(e))); return false; }
        }}
      />
    </>
  );
}
