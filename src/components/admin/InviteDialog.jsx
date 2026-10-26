// InviteDialog.jsx -- "Invite staff": name, email, starting account type and
// how the invite reaches them. By email, Supabase Auth sends the one-time
// link; "Copy a link" hands it back here once, for when email isn't set up
// or the person is in the room. Either way they choose their own password
// on /reset-password -- the admin never sees or sets it.
import { useEffect, useState } from "react";
import { Check, Copy, Link2, Mail } from "lucide-react";
import { useApp, useT } from "../../context/AppContext.jsx";
import { INVITE_ROLES, adminErrorKey, inviteStaff } from "../../lib/adminAccounts.js";
import { roleLabel } from "../../lib/utils.js";
import { Alert } from "../ui/alert.jsx";
import { Button } from "../ui/button.jsx";
import { Dialog } from "../ui/dialog.jsx";
import { Field, Input, Select } from "../ui/field.jsx";
import { SegmentedControl } from "../ui/segmented-control.jsx";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// The one-time link, shown once with a copy button.
export function InviteLinkPanel({ link }) {
  const t = useT();
  const [copied, setCopied] = useState(false);
  async function copy() {
    try { await navigator.clipboard.writeText(link); setCopied(true); } catch (e) { setCopied(false); }
  }
  return (
    <div className="flex flex-col gap-3">
      <Alert tone="warning" title={t("adminInviteLinkTitle")}>{t("adminInviteLinkWarning")}</Alert>
      <div className="flex gap-2">
        <Input readOnly value={link} aria-label={t("adminInviteLinkTitle")} onFocus={(e) => e.target.select()} className="font-mono text-meta" />
        <Button type="button" variant="secondary" onClick={copy}>
          {copied ? <Check className="h-4 w-4" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
          {copied ? t("adminCopied") : t("copyLabel")}
        </Button>
      </div>
    </div>
  );
}

export default function InviteDialog({ open, onClose, existingEmails, onInvited }) {
  const { lang, showToast } = useApp();
  const t = useT();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("staff");
  const [delivery, setDelivery] = useState("email");
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [link, setLink] = useState(null);

  useEffect(() => {
    if (open) { setName(""); setEmail(""); setRole("staff"); setDelivery("email"); setErrors({}); setBusy(false); setLink(null); }
  }, [open]);

  async function submit(e) {
    e.preventDefault();
    const clean = email.trim().toLowerCase();
    const next = {};
    if (!name.trim()) next.name = t("adminNameRequired");
    if (!EMAIL.test(clean)) next.email = t("invalidEmail");
    else if (existingEmails.indexOf(clean) !== -1) next.email = t("duplicateEmail");
    setErrors(next);
    if (Object.keys(next).length) return;
    setBusy(true);
    try {
      const res = await inviteStaff({ email: clean, name: name.trim(), role, delivery });
      onInvited();
      if (res && res.link) { setLink(res.link); }
      else { showToast(t("adminInviteSent").replace("{email}", clean)); onClose(); }
    } catch (err) {
      showToast(t(adminErrorKey(err)));
    }
    setBusy(false);
  }

  if (link) {
    return (
      <Dialog open={open} onClose={onClose} title={t("adminInviteCreated")} description={t("adminInviteCreatedDesc").replace("{name}", name.trim())} size="md" closeLabel={t("closeLabel")}
        footer={<Button onClick={onClose}>{t("doneLabel")}</Button>}>
        <InviteLinkPanel link={link} />
      </Dialog>
    );
  }

  return (
    <Dialog
      open={open}
      onClose={busy ? () => {} : onClose}
      title={t("adminInviteStaff")}
      description={t("adminInviteDesc")}
      size="md"
      closeLabel={t("closeLabel")}
      as="form"
      panelProps={{ onSubmit: submit, noValidate: true }}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>{t("cancelLabel")}</Button>
          <Button type="submit" loading={busy}>
            {delivery === "email" ? <Mail className="h-4 w-4" aria-hidden="true" /> : <Link2 className="h-4 w-4" aria-hidden="true" />}
            {delivery === "email" ? t("adminSendInvite") : t("adminCreateInviteLink")}
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        <Field label={t("fullNameLabel")} htmlFor="invite-name" error={errors.name} required>
          <Input id="invite-name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" maxLength={120} aria-invalid={!!errors.name} data-autofocus />
        </Field>
        <Field label={t("emailAddressCol")} htmlFor="invite-email" error={errors.email} required>
          <Input id="invite-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="off" aria-invalid={!!errors.email} />
        </Field>
        <Field label={t("adminAccountTypeLabel")} htmlFor="invite-role" hint={t("adminAccountTypeHint")}>
          <Select id="invite-role" value={role} onChange={(e) => setRole(e.target.value)}>
            {INVITE_ROLES.map((r) => <option key={r} value={r}>{roleLabel(r, lang)}</option>)}
          </Select>
        </Field>
        <Field label={t("adminDeliveryLabel")} hint={delivery === "email" ? t("adminDeliveryEmailHint") : t("adminDeliveryLinkHint")}>
          <SegmentedControl
            className="self-start"
            label={t("adminDeliveryLabel")}
            value={delivery}
            onChange={setDelivery}
            options={[{ value: "email", label: t("adminDeliveryEmail") }, { value: "link", label: t("adminDeliveryLink") }]}
          />
        </Field>
      </div>
    </Dialog>
  );
}
