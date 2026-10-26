// adminShared.jsx -- small pieces the Administration screens share: the
// account status badge, the person cell, dates, the reason dialog every
// account action asks for before it runs, and the review dialog every
// permission change goes through (Phase 5).
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useT } from "../../context/AppContext.jsx";
import { accountStatus } from "../../lib/adminAccounts.js";
import { avatarColorFor } from "../../lib/avatarTone.js";
import { Alert } from "../ui/alert.jsx";
import { Avatar, AvatarFallback } from "../ui/avatar.jsx";
import { Badge } from "../ui/badge.jsx";
import { Button } from "../ui/button.jsx";
import { Dialog } from "../ui/dialog.jsx";
import { Field, Input, Textarea } from "../ui/field.jsx";
import { Skeleton } from "../ui/skeleton.jsx";
import { StatusBadge } from "../ui/status-badge.jsx";

const LOCALES = { en: "en-US", ht: "fr-HT", fr: "fr-FR" };

export function fmtWhen(iso, lang, withTime) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d)) return "";
  const opts = withTime ? { dateStyle: "medium", timeStyle: "short" } : { dateStyle: "medium" };
  return d.toLocaleString(LOCALES[lang] || "en-US", opts);
}

const STATUS_LABEL = { active: "activeLabel", invited: "adminStatusInvited", inactive: "adminStatusInactive", deactivated: "adminStatusDeactivated" };

// "1 person" / "3 people": picks the singular key when n is 1.
export function countLabel(t, n, oneKey, manyKey) {
  return n === 1 ? t(oneKey) : t(manyKey).replace("{n}", n);
}

export function accountStatusLabel(status) {
  return STATUS_LABEL[status];
}

export function AccountStatusBadge({ account }) {
  const t = useT();
  const status = accountStatus(account);
  return <StatusBadge domain="account" status={status}>{t(STATUS_LABEL[status])}</StatusBadge>;
}

function initials(name, email) {
  const src = (name || "").trim();
  if (!src) return (email || "?").slice(0, 2).toUpperCase();
  const parts = src.split(/\s+/);
  return ((parts[0] || "")[0] || "") + ((parts[1] || "")[0] || "");
}

// `to` makes the name a link to the person's account.
export function PersonCell({ name, email, size = "md", to }) {
  const label = name || email;
  return (
    <div className="flex min-w-0 items-center gap-3">
      <Avatar className={size === "lg" ? "h-12 w-12" : "h-9 w-9"}>
        <AvatarFallback className={avatarColorFor(name || email)}>{initials(name, email)}</AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        {to
          ? <Link to={to} className="block truncate text-ui font-semibold text-card-foreground no-underline hover:text-primary hover:underline focus-visible:underline">{label}</Link>
          : <div className="truncate text-ui font-semibold text-card-foreground">{label}</div>}
        {name ? <div className="truncate text-meta text-muted">{email}</div> : null}
      </div>
    </div>
  );
}

// Asks for a reason (recorded in the audit log) before running `onConfirm`.
// `required` reasons need at least 3 characters, like the database.
export function ReasonDialog({ open, onClose, onConfirm, title, description, confirmLabel, danger, required = true, children }) {
  const t = useT();
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { if (open) { setReason(""); setError(""); setBusy(false); } }, [open]);

  async function submit(e) {
    e.preventDefault();
    if (required && reason.trim().length < 3) { setError(t("adminReasonRequired")); return; }
    setBusy(true);
    const ok = await onConfirm(reason.trim());
    setBusy(false);
    if (ok !== false) onClose();
  }

  return (
    <Dialog
      open={open}
      onClose={busy ? () => {} : onClose}
      title={title}
      description={description}
      size="sm"
      closeLabel={t("closeLabel")}
      as="form"
      panelProps={{ onSubmit: submit, noValidate: true }}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>{t("cancelLabel")}</Button>
          <Button type="submit" variant={danger ? "danger" : "primary"} loading={busy}>{confirmLabel}</Button>
        </>
      }
    >
      {children}
      <Field
        label={required ? t("adminReasonLabel") : t("adminReasonOptionalLabel")}
        htmlFor="admin-reason"
        hint={t("adminReasonHint")}
        error={error}
        required={required}
        className={children ? "mt-4" : undefined}
      >
        <Textarea
          id="admin-reason"
          value={reason}
          onChange={(e) => { setReason(e.target.value); if (error) setError(""); }}
          maxLength={1000}
          aria-invalid={!!error}
          data-autofocus
        />
      </Field>
    </Dialog>
  );
}

export const SCOPE_LABEL = { own: "adminScopeOwn", assigned: "adminScopeAssigned", team: "adminScopeTeam", program: "adminScopeProgram", org: "adminScopeOrg" };

// Sensitive participant data or an administration power: flagged wherever a
// permission is listed, and these changes need the typed confirmation.
export function SensitivityBadge({ sensitivity }) {
  const t = useT();
  if (sensitivity === "sensitive") return <Badge variant="warning">{t("adminSensitive")}</Badge>;
  if (sensitivity === "system") return <Badge variant="violet">{t("adminSystemPermission")}</Badge>;
  return null;
}

// The last step before an access change is saved: what will change (the
// caller's preview, as children), a required reason for the audit log and,
// for high-risk changes, typing `confirmPhrase` to unlock the button.
export function ReviewChangesDialog({ open, onClose, onConfirm, title, description, confirmLabel, highRisk, confirmPhrase, loading, error, empty, children }) {
  const t = useT();
  const [reason, setReason] = useState("");
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [reasonError, setReasonError] = useState("");

  useEffect(() => { if (open) { setReason(""); setTyped(""); setBusy(false); setReasonError(""); } }, [open]);

  const phraseOk = !highRisk || typed.trim().toLowerCase() === String(confirmPhrase || "").trim().toLowerCase();

  async function submit(e) {
    e.preventDefault();
    if (reason.trim().length < 3) { setReasonError(t("adminReasonRequired")); return; }
    if (!phraseOk) return;
    setBusy(true);
    const ok = await onConfirm(reason.trim());
    setBusy(false);
    if (ok !== false) onClose();
  }

  return (
    <Dialog open={open} onClose={busy ? () => {} : onClose} title={title} description={description} size="md" closeLabel={t("closeLabel")}
      as="form" panelProps={{ onSubmit: submit, noValidate: true }}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>{t("cancelLabel")}</Button>
          <Button type="submit" variant={highRisk ? "danger" : "primary"} loading={busy} disabled={loading || !!error || empty || !phraseOk}>{confirmLabel}</Button>
        </>
      }>
      <div className="grid gap-4">
        {loading ? <div className="space-y-2" aria-busy="true"><Skeleton className="h-5 w-2/3" /><Skeleton className="h-5 w-1/2" /></div> : null}
        {error ? <Alert tone="danger" title={t("adminPreviewFailed")}>{error}</Alert> : null}
        {!loading && !error ? children : null}
        {highRisk && !loading && !error ? (
          <Alert tone="warning" title={t("adminHighRiskTitle")}>{t("adminHighRiskBody")}</Alert>
        ) : null}
        <Field label={t("adminReasonLabel")} htmlFor="review-reason" hint={t("adminReasonHint")} error={reasonError} required>
          <Textarea id="review-reason" value={reason} maxLength={1000} aria-invalid={!!reasonError}
            onChange={(e) => { setReason(e.target.value); if (reasonError) setReasonError(""); }} />
        </Field>
        {highRisk ? (
          <Field label={t("adminTypeToConfirm").replace("{phrase}", confirmPhrase)} htmlFor="review-confirm">
            <Input id="review-confirm" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" spellCheck={false} />
          </Field>
        ) : null}
      </div>
    </Dialog>
  );
}

// "Gains / Loses / Scope changes" lists for a preview, by permission label.
export function ChangeList({ title, tone, items }) {
  if (!items.length) return null;
  return (
    <section>
      <h3 className="m-0 mb-2 flex items-center gap-2 text-meta font-semibold uppercase tracking-wide text-muted">
        <Badge variant={tone} dot>{items.length}</Badge>{title}
      </h3>
      <ul className="m-0 grid list-none gap-1 p-0 text-ui text-card-foreground">
        {items.map((it) => <li key={it.key} className="flex flex-wrap items-center gap-2">{it.label}{it.meta ? <span className="text-meta text-muted">{it.meta}</span> : null}</li>)}
      </ul>
    </section>
  );
}
