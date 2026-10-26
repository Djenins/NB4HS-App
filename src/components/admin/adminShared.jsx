// adminShared.jsx -- small pieces the Administration screens share: the
// account status badge, the person cell, dates, and the reason dialog every
// account action asks for before it runs.
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useT } from "../../context/AppContext.jsx";
import { accountStatus } from "../../lib/adminAccounts.js";
import { avatarColorFor } from "../../lib/avatarTone.js";
import { Avatar, AvatarFallback } from "../ui/avatar.jsx";
import { Button } from "../ui/button.jsx";
import { Dialog } from "../ui/dialog.jsx";
import { Field, Textarea } from "../ui/field.jsx";
import { StatusBadge } from "../ui/status-badge.jsx";

const LOCALES = { en: "en-US", ht: "fr-HT", fr: "fr-FR" };

export function fmtWhen(iso, lang, withTime) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d)) return "";
  const opts = withTime ? { dateStyle: "medium", timeStyle: "short" } : { dateStyle: "medium" };
  return d.toLocaleString(LOCALES[lang] || "en-US", opts);
}

const STATUS_LABEL = { active: "activeLabel", invited: "adminStatusInvited", pending: "adminStatusPending", deactivated: "adminStatusDeactivated" };

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
