// MessageTemplates.jsx -- the Communications module's Templates section:
// reusable client messages per channel, purpose and language. Only people
// with communications.templates.manage see this section; everyone who sends
// messages picks from the active ones in the send form.
//
// Templates are switched off rather than deleted, so a message sent from one
// keeps pointing at something real. Text templates stay within one long SMS
// (480 characters); {first_name} is filled in when the message is sent.
import { useEffect, useState } from "react";
import { FileText, Pencil, Plus } from "lucide-react";
import { useApp, useT } from "../../context/AppContext.jsx";
import {
  BODY_MAX, MESSAGE_CHANNELS, MESSAGE_LANGUAGES, MESSAGE_PURPOSES, SMS_MAX, SUBJECT_MAX, fetchTemplates, saveTemplate, smsSegments
} from "../../lib/communications.js";
import { Badge } from "../ui/badge.jsx";
import { Button } from "../ui/button.jsx";
import { Dialog } from "../ui/dialog.jsx";
import { EmptyState } from "../ui/empty-state.jsx";
import { Field, Input, Select, Textarea } from "../ui/field.jsx";
import { PageHeader } from "../ui/page-header.jsx";
import { SectionCard } from "../ui/section-card.jsx";
import { SegmentedControl } from "../ui/segmented-control.jsx";
import { CHANNEL_KEY, LANGUAGE_NAMES } from "./SendMessageDialog.jsx";

const BLANK = { name: "", channel: "sms", purpose: "appointment_reminders", language: "en", subject: "", body: "", active: true };

function TemplateDialog({ template, onSave, onCancel }) {
  const t = useT();
  const [fields, setFields] = useState(template ? Object.assign({}, template) : BLANK);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const limit = fields.channel === "sms" ? SMS_MAX : BODY_MAX;
  const ready = fields.name.trim() && fields.body.trim() && fields.body.length <= limit &&
    (fields.channel === "sms" || fields.subject.trim());

  function set(name, value) { setError(null); setFields((prev) => Object.assign({}, prev, { [name]: value })); }

  async function submit(e) {
    e.preventDefault();
    if (!ready || saving) return;
    setSaving(true);
    try { await onSave(fields); } catch (err) { console.warn("saveTemplate failed", err); setError(t("userActionError")); } finally { setSaving(false); }
  }

  return (
    <Dialog
      open onClose={onCancel} size="lg" closeLabel={t("closeLabel")}
      title={template ? t("commsEditTemplate") : t("commsNewTemplate")}
      as="form" panelProps={{ onSubmit: submit }}
      footer={
        <>
          {error ? <span role="alert" className="mr-auto text-meta text-tone-danger-ink">{error}</span> : null}
          <Button type="button" variant="secondary" onClick={onCancel} disabled={saving}>{t("cancelLabel")}</Button>
          <Button type="submit" loading={saving} disabled={!ready}>{t("saveLabel")}</Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label={t("commsTemplateNameLabel")} htmlFor="tpl-name" hint={t("commsTemplateNameHint")} required>
          <Input id="tpl-name" value={fields.name} maxLength={80} onChange={(e) => set("name", e.target.value)} data-autofocus />
        </Field>
        <SegmentedControl label={t("commsChannelLabel")} value={fields.channel} onChange={(v) => set("channel", v)}
          options={MESSAGE_CHANNELS.map((c) => ({ value: c, label: t(CHANNEL_KEY[c]) }))} />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={t("commsPurposeLabel")} htmlFor="tpl-purpose">
            <Select id="tpl-purpose" value={fields.purpose} onChange={(e) => set("purpose", e.target.value)}>
              {MESSAGE_PURPOSES.map((p) => <option key={p} value={p}>{t("snapPurpose_" + p)}</option>)}
            </Select>
          </Field>
          <Field label={t("commsLanguageLabel")} htmlFor="tpl-language">
            <Select id="tpl-language" value={fields.language} onChange={(e) => set("language", e.target.value)}>
              {MESSAGE_LANGUAGES.map((l) => <option key={l} value={l}>{LANGUAGE_NAMES[l]}</option>)}
            </Select>
          </Field>
        </div>
        {fields.channel === "email" ? (
          <Field label={t("commsSubjectLabel")} htmlFor="tpl-subject" required>
            <Input id="tpl-subject" value={fields.subject} maxLength={SUBJECT_MAX} onChange={(e) => set("subject", e.target.value)} />
          </Field>
        ) : null}
        <Field
          label={t("commsMessageLabel")} htmlFor="tpl-body" required
          hint={<span className="tabular-nums">{fields.body.length} / {limit}{fields.channel === "sms" && fields.body ? " · " + t("commsSmsParts").replace("{n}", smsSegments(fields.body)) : ""} · {t("commsFirstNameHint")}</span>}
          error={fields.body.length > limit ? t("commsProblemTooLong") : null}
        >
          <Textarea id="tpl-body" value={fields.body} rows={fields.channel === "sms" ? 4 : 8} onChange={(e) => set("body", e.target.value)} />
        </Field>
        <label className="m-0 flex cursor-pointer items-center gap-2.5 text-ui font-medium text-card-foreground">
          <input type="checkbox" checked={fields.active} onChange={(e) => set("active", e.target.checked)} className="h-4 w-4 cursor-pointer accent-primary" />
          {t("commsTemplateActive")}
        </label>
      </div>
    </Dialog>
  );
}

export default function MessageTemplates() {
  const { showToast } = useApp();
  const t = useT();
  const [templates, setTemplates] = useState(null);
  const [loadError, setLoadError] = useState(false);
  const [editing, setEditing] = useState(null); // null, "new", or a template

  function load() {
    setLoadError(false);
    return fetchTemplates().then(setTemplates).catch((err) => { console.warn("fetchTemplates failed", err); setLoadError(true); });
  }
  useEffect(() => { load(); }, []);

  async function save(fields) {
    await saveTemplate(editing === "new" ? null : editing.id, fields);
    setEditing(null);
    showToast(t("commsTemplateSaved"));
    load();
  }

  const list = templates || [];
  const groups = MESSAGE_PURPOSES.map((p) => ({ purpose: p, items: list.filter((x) => x.purpose === p) })).filter((g) => g.items.length);

  return (
    <>
      <PageHeader
        title={t("commsTemplatesTitle")}
        description={t("commsTemplatesDesc")}
        actions={<Button onClick={() => setEditing("new")}><Plus className="h-4 w-4" aria-hidden="true" /> {t("commsNewTemplate")}</Button>}
      />

      {loadError ? (
        <EmptyState variant="error" title={t("commsLoadErrorTitle")} description={t("commsLoadErrorDesc")}
          action={<Button variant="secondary" onClick={load}>{t("retryLabel")}</Button>} />
      ) : templates !== null && !list.length ? (
        <EmptyState icon={FileText} title={t("commsTemplatesEmptyTitle")} description={t("commsTemplatesEmptyDesc")}
          action={<Button onClick={() => setEditing("new")}><Plus className="h-4 w-4" aria-hidden="true" /> {t("commsNewTemplate")}</Button>} />
      ) : (
        <div className="space-y-6">
          {groups.map((g) => (
            <SectionCard key={g.purpose} title={t("snapPurpose_" + g.purpose)} flush>
              <ul className="m-0 list-none p-0">
                {g.items.map((x) => (
                  <li key={x.id} className="flex flex-col gap-2 border-b border-line-subtle px-5 py-4 last:border-b-0 sm:flex-row sm:items-start sm:justify-between sm:px-6">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-ui font-semibold text-card-foreground">{x.name}</span>
                        <Badge variant="neutral">{t(CHANNEL_KEY[x.channel])}</Badge>
                        <Badge variant="neutral">{LANGUAGE_NAMES[x.language]}</Badge>
                        {!x.active ? <Badge variant="warning">{t("commsTemplateOff")}</Badge> : null}
                      </div>
                      {x.subject ? <p className="m-0 mt-1.5 text-ui font-medium text-card-foreground">{x.subject}</p> : null}
                      <p className="m-0 mt-1 line-clamp-3 max-w-[75ch] whitespace-pre-wrap text-body text-muted">{x.body}</p>
                    </div>
                    <Button size="sm" variant="secondary" onClick={() => setEditing(x)}>
                      <Pencil className="h-4 w-4" aria-hidden="true" /> {t("editLabel")}
                    </Button>
                  </li>
                ))}
              </ul>
            </SectionCard>
          ))}
        </div>
      )}

      {editing ? <TemplateDialog template={editing === "new" ? null : editing} onSave={save} onCancel={() => setEditing(null)} /> : null}
    </>
  );
}
