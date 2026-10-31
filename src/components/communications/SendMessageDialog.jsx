// SendMessageDialog.jsx -- write a text or email to one client and queue it.
//
// The database decides (send_client_message): it refuses without a usable
// address, without the client's consent for that channel and purpose, or
// over the hourly cap, and it logs the message in the communications log.
// This form shows the same checks up front -- where the message goes, what
// the client agreed to -- and lets staff record the client's answer when it
// was never asked, so nobody discovers the refusal only after typing.
import { useEffect, useState } from "react";
import { CheckCircle2, ShieldAlert } from "lucide-react";
import { useApp, useT } from "../../context/AppContext.jsx";
import {
  BODY_MAX, MESSAGE_CHANNELS, MESSAGE_LANGUAGES, MESSAGE_PURPOSES, SMS_MAX, SUBJECT_MAX,
  composeProblem, fetchTemplates, fillTemplate, messageAddress, sendClientMessage, sendErrorKey, smsSegments
} from "../../lib/communications.js";
import { CONSENT_METHODS, currentConsents, fetchConsents, recordConsent } from "../../lib/outreachContacts.js";
import { Alert } from "../ui/alert.jsx";
import { Button } from "../ui/button.jsx";
import { Dialog } from "../ui/dialog.jsx";
import { Field, Input, Select, Textarea } from "../ui/field.jsx";
import { SegmentedControl } from "../ui/segmented-control.jsx";
import ClientPicker from "./ClientPicker.jsx";

// Language names are written in their own language, so they need no translation.
export const LANGUAGE_NAMES = { en: "English", ht: "Kreyòl", fr: "Français" };
export const CHANNEL_KEY = { sms: "commsChannelSms", email: "commsChannelEmail" };

function ConsentPanel({ client, channel, purpose, consent, onRecorded }) {
  const t = useT();
  const { showToast } = useApp();
  const [method, setMethod] = useState("verbal");
  const [saving, setSaving] = useState(null);
  const status = consent ? consent.status : "none";

  async function record(next) {
    setSaving(next);
    try {
      await recordConsent(client.id, { channel, purpose, status: next, method });
      await onRecorded();
    } catch (err) {
      console.warn("recordConsent failed", err);
      showToast(t("userActionError"));
    } finally {
      setSaving(null);
    }
  }

  if (status === "granted") {
    return (
      <p className="m-0 flex items-center gap-2 text-meta text-muted">
        <CheckCircle2 className="h-4 w-4 shrink-0 text-tone-success-solid" aria-hidden="true" />
        {t("commsConsentGranted")}
      </p>
    );
  }
  return (
    <Alert tone="warning" title={status === "revoked" ? t("commsConsentRevokedTitle") : t("commsConsentMissingTitle")}>
      <p className="m-0">{status === "revoked" ? t("commsConsentRevokedBody") : t("commsConsentMissingBody")}</p>
      <div className="mt-3 flex flex-wrap items-end gap-2">
        <Field label={t("commsConsentHowLabel")} htmlFor="comm-consent-method" className="min-w-[10rem]">
          <Select id="comm-consent-method" value={method} onChange={(e) => setMethod(e.target.value)}>
            {CONSENT_METHODS.map((m) => <option key={m} value={m}>{t("snapConsentMethod_" + m)}</option>)}
          </Select>
        </Field>
        <Button type="button" size="sm" variant="secondary" loading={saving === "granted"} disabled={!!saving} onClick={() => record("granted")}>
          {t("commsConsentRecordAgreed")}
        </Button>
        {status !== "revoked" ? (
          <Button type="button" size="sm" variant="ghost" loading={saving === "revoked"} disabled={!!saving} onClick={() => record("revoked")}>
            {t("commsConsentRecordDeclined")}
          </Button>
        ) : null}
      </div>
    </Alert>
  );
}

// `client` fixes the recipient; without it the form starts with the picker.
export default function SendMessageDialog({ client: fixedClient, onSent, onCancel }) {
  const t = useT();
  const [client, setClient] = useState(fixedClient || null);
  const [fields, setFields] = useState({ channel: "sms", purpose: "appointment_reminders", language: "en", subject: "", body: "", templateId: "" });
  const [templates, setTemplates] = useState([]);
  const [consents, setConsents] = useState(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchTemplates().then(setTemplates).catch((err) => { console.warn("fetchTemplates failed", err); setTemplates([]); });
  }, []);

  function loadConsents() {
    if (!client) { setConsents(null); return Promise.resolve(); }
    return fetchConsents(client.id).then(setConsents).catch((err) => { console.warn("fetchConsents failed", err); setConsents([]); });
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadConsents(); }, [client && client.id]);

  function set(name, value) {
    setError(null);
    setFields((prev) => Object.assign({}, prev, { [name]: value }));
  }
  function setChannel(channel) {
    setError(null);
    setFields((prev) => Object.assign({}, prev, { channel, templateId: "" }));
  }
  function applyTemplate(id) {
    const tpl = templates.find((x) => x.id === id);
    setError(null);
    setFields((prev) => tpl
      ? Object.assign({}, prev, { templateId: id, purpose: tpl.purpose, language: tpl.language, subject: tpl.subject || prev.subject, body: tpl.body })
      : Object.assign({}, prev, { templateId: "" }));
  }

  const consent = consents ? currentConsents(consents)[fields.channel + ":" + fields.purpose] : null;
  const granted = !!consent && consent.status === "granted";
  const address = messageAddress(client, fields.channel);
  const problem = composeProblem(fields, client, granted);
  const preview = fillTemplate(fields.body, client);
  const limit = fields.channel === "sms" ? SMS_MAX : BODY_MAX;
  const usable = templates.filter((x) => x.active && x.channel === fields.channel);

  async function submit(e) {
    e.preventDefault();
    if (problem || sending) return;
    setSending(true);
    setError(null);
    try {
      const entry = await sendClientMessage(client.id, fields);
      onSent(entry, client);
    } catch (err) {
      console.warn("sendClientMessage failed", err);
      setError(sendErrorKey(err));
      if (err && err.hint === "consent_required") loadConsents();
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog
      open
      onClose={onCancel}
      title={t("commsSendMessageTitle")}
      description={t("commsSendMessageDesc")}
      size="lg"
      closeLabel={t("closeLabel")}
      as="form"
      panelProps={{ onSubmit: submit }}
      footer={
        <>
          {problem && client ? <span className="mr-auto text-meta text-muted">{t(problem)}</span> : null}
          <Button type="button" variant="secondary" onClick={onCancel} disabled={sending}>{t("cancelLabel")}</Button>
          <Button type="submit" loading={sending} disabled={!!problem}>{t("commsQueueMessageBtn")}</Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {!fixedClient ? <ClientPicker value={client} onChange={setClient} id="msg-client" /> : null}

        <SegmentedControl
          label={t("commsChannelLabel")}
          value={fields.channel}
          onChange={setChannel}
          options={MESSAGE_CHANNELS.map((c) => ({ value: c, label: t(CHANNEL_KEY[c]) }))}
        />

        {client ? (
          <p className="m-0 text-meta text-muted">
            {address
              ? <>{t("commsSendsTo")} <span className="font-semibold tabular-nums text-card-foreground">{address}</span></>
              : t(fields.channel === "sms" ? "commsProblemNoPhone" : "commsProblemNoEmail")}
          </p>
        ) : null}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label={t("commsPurposeLabel")} htmlFor="msg-purpose">
            <Select id="msg-purpose" value={fields.purpose} onChange={(e) => set("purpose", e.target.value)}>
              {MESSAGE_PURPOSES.map((p) => <option key={p} value={p}>{t("snapPurpose_" + p)}</option>)}
            </Select>
          </Field>
          <Field label={t("commsLanguageLabel")} htmlFor="msg-language">
            <Select id="msg-language" value={fields.language} onChange={(e) => set("language", e.target.value)}>
              {MESSAGE_LANGUAGES.map((l) => <option key={l} value={l}>{LANGUAGE_NAMES[l]}</option>)}
            </Select>
          </Field>
          <Field label={t("commsTemplateLabel")} htmlFor="msg-template" hint={usable.length ? null : t("commsNoTemplatesHint")}>
            <Select id="msg-template" value={fields.templateId} onChange={(e) => applyTemplate(e.target.value)} disabled={!usable.length}>
              <option value="">{t("commsNoTemplate")}</option>
              {usable.map((x) => <option key={x.id} value={x.id}>{x.name} · {LANGUAGE_NAMES[x.language]}</option>)}
            </Select>
          </Field>
        </div>

        {client && consents ? (
          <ConsentPanel client={client} channel={fields.channel} purpose={fields.purpose} consent={consent} onRecorded={loadConsents} />
        ) : null}

        {fields.channel === "email" ? (
          <Field label={t("commsSubjectLabel")} htmlFor="msg-subject" required>
            <Input id="msg-subject" value={fields.subject} maxLength={SUBJECT_MAX} onChange={(e) => set("subject", e.target.value)} />
          </Field>
        ) : null}

        <Field
          label={t("commsMessageLabel")}
          htmlFor="msg-body"
          required
          hint={
            <span className="tabular-nums">
              {preview.length} / {limit}
              {fields.channel === "sms" && preview ? " · " + t("commsSmsParts").replace("{n}", smsSegments(preview)) : ""}
              {" · "}{t("commsFirstNameHint")}
            </span>
          }
          error={preview.length > limit ? t("commsProblemTooLong") : null}
        >
          <Textarea id="msg-body" value={fields.body} rows={fields.channel === "sms" ? 4 : 7} onChange={(e) => set("body", e.target.value)} />
        </Field>

        {client && fields.body.indexOf("{first_name}") !== -1 ? (
          <div>
            <p className="m-0 mb-1 text-meta font-semibold text-muted">{t("commsPreviewLabel")}</p>
            <p className="m-0 whitespace-pre-wrap rounded-control border border-border bg-surface-sunken px-3 py-2 text-body text-card-foreground">{preview}</p>
          </div>
        ) : null}

        <p className="m-0 flex items-start gap-2 text-meta text-muted">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          {t("commsPrivacyNote")}
        </p>

        {error ? <Alert tone="danger">{t(error)}</Alert> : null}
      </div>
    </Dialog>
  );
}
