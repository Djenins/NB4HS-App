// Newsletters.jsx -- the Communications module's Newsletters section
// (c2_newsletters): one email to many clients.
//
// A newsletter is written once (subject, message, one language) for an
// audience -- everyone, or one program's participants -- and goes only to
// clients whose newest consent for email + "program updates" is "granted".
// The editor shows that count live, so the number on the Send button is the
// number the database will use. Sent newsletters can't be edited; what
// hasn't gone out yet can be stopped.
//
// Every newsletter email carries the organization's mailing address and an
// unsubscribe link (US CAN-SPAM). The address is the `mailing_address` app
// setting, set here by whoever manages System Settings; until it exists the
// database refuses to send.
import { useEffect, useState } from "react";
import { MailPlus, Newspaper, Pencil, Send, ShieldAlert, Trash2, XCircle } from "lucide-react";
import { useApp, useT } from "../../context/AppContext.jsx";
import {
  NEWSLETTER_AUDIENCES, NEWSLETTER_BODY_MAX, NEWSLETTER_SUBJECT_MAX, MESSAGE_LANGUAGES, cancelNewsletter, deleteNewsletter,
  fetchNewsletterStats, fetchNewsletters, newsletterAudienceCount, newsletterErrorKey, saveNewsletter, sendNewsletter
} from "../../lib/communications.js";
import { saveAppSetting } from "../../lib/permissionAdmin.js";
import { dateStrFromDate, fmtDateLong } from "../../lib/utils.js";
import { Alert } from "../ui/alert.jsx";
import { Badge } from "../ui/badge.jsx";
import { Button } from "../ui/button.jsx";
import { Dialog } from "../ui/dialog.jsx";
import { EmptyState } from "../ui/empty-state.jsx";
import { Field, Input, Select, Textarea } from "../ui/field.jsx";
import { PageHeader } from "../ui/page-header.jsx";
import { SectionCard } from "../ui/section-card.jsx";
import { StatusBadge } from "../ui/status-badge.jsx";
import { LANGUAGE_NAMES } from "./SendMessageDialog.jsx";
import { LayoutFields, LayoutPicker, NewsletterPreview } from "./NewsletterLayoutEditor.jsx";
import { normalizeContent, starterContent } from "../../../supabase/functions/send-outbound/newsletterLayout.js";

const BLANK = { subject: "", body: "", language: "en", audience: "all", layout: "plain", content: null };

function MailingAddressCard({ address, canEdit, onSaved }) {
  const t = useT();
  const { showToast } = useApp();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(address || "");
  const [saving, setSaving] = useState(false);

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await saveAppSetting("mailing_address", value.trim(), "Newsletter mailing address");
      await onSaved();
      setEditing(false);
      showToast(t("nlAddressSaved"));
    } catch (err) {
      console.warn("save mailing address failed", err);
      showToast(t("nlAddressInvalid"));
    } finally {
      setSaving(false);
    }
  }

  if (!address && !editing) {
    return (
      <Alert tone="warning" title={t("nlAddressMissingTitle")} className="mb-6"
        action={canEdit ? <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>{t("nlAddressSet")}</Button> : null}>
        {t(canEdit ? "nlAddressMissingBody" : "nlAddressMissingAskAdmin")}
      </Alert>
    );
  }
  return (
    <SectionCard title={t("nlAddressTitle")} description={t("nlAddressDesc")} className="mb-6"
      action={canEdit && !editing ? <Button size="sm" variant="ghost" onClick={() => { setValue(address || ""); setEditing(true); }}><Pencil className="h-4 w-4" aria-hidden="true" /> {t("editLabel")}</Button> : null}>
      {editing ? (
        <form onSubmit={save} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <Field label={t("nlAddressLabel")} htmlFor="nl-address" hint={t("nlAddressHint")} className="flex-1">
            <Input id="nl-address" value={value} maxLength={300} onChange={(e) => setValue(e.target.value)} data-autofocus />
          </Field>
          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={() => setEditing(false)} disabled={saving}>{t("cancelLabel")}</Button>
            <Button type="submit" loading={saving} disabled={value.trim().length < 10}>{t("saveLabel")}</Button>
          </div>
        </form>
      ) : (
        <p className="m-0 text-body text-card-foreground">{address}</p>
      )}
    </SectionCard>
  );
}

function NewsletterEditor({ newsletter, hasAddress, address, onSaved, onSent, onCancel }) {
  const t = useT();
  const [fields, setFields] = useState(newsletter
    ? {
        subject: newsletter.subject, body: newsletter.body, language: newsletter.language, audience: newsletter.audience,
        layout: newsletter.layout, content: newsletter.content ? normalizeContent(newsletter.content, newsletter.layout) : null
      }
    : BLANK);
  // Until someone edits the blocks, picking another layout swaps in that
  // layout's starter content; after that, their words are kept.
  const [touched, setTouched] = useState(!!(newsletter && newsletter.content));
  const [count, setCount] = useState(null);
  const [busy, setBusy] = useState(null); // "save" | "send"
  const [error, setError] = useState(null);
  // Sending asks once more, in the footer (a confirm modal would open under this dialog).
  const [confirming, setConfirming] = useState(false);
  const isPlain = fields.layout === "plain";
  const ready = fields.subject.trim() && (isPlain ? fields.body.trim() : fields.content && fields.content.headline.trim());

  useEffect(() => {
    let cancelled = false;
    setCount(null);
    newsletterAudienceCount(fields.audience)
      .then((n) => { if (!cancelled) setCount(n); })
      .catch((err) => { console.warn("newsletterAudienceCount failed", err); if (!cancelled) setCount(0); });
    return () => { cancelled = true; };
  }, [fields.audience]);

  function set(name, value) { setError(null); setConfirming(false); setFields((prev) => Object.assign({}, prev, { [name]: value })); }

  function chooseLayout(key) {
    setError(null);
    setConfirming(false);
    setFields((prev) => {
      if (key === "plain" || (touched && prev.content)) return Object.assign({}, prev, { layout: key });
      const content = starterContent(key);
      // Coming from plain text, keep what was already written as the intro.
      if (prev.layout === "plain" && prev.body.trim()) content.intro = prev.body.trim();
      return Object.assign({}, prev, { layout: key, content });
    });
  }
  function setContent(content) { setTouched(true); set("content", content); }

  async function save() {
    setBusy("save");
    try { await saveNewsletter(newsletter && newsletter.id, fields); onSaved(); }
    catch (err) { console.warn("saveNewsletter failed", err); setError("userActionError"); }
    finally { setBusy(null); }
  }

  async function send() {
    setConfirming(false);
    setBusy("send");
    try {
      const id = await saveNewsletter(newsletter && newsletter.id, fields);
      const sent = await sendNewsletter(id);
      onSent(sent);
    } catch (err) {
      console.warn("sendNewsletter failed", err);
      setError(newsletterErrorKey(err));
    } finally {
      setBusy(null);
    }
  }

  return (
    <Dialog
      open onClose={onCancel} size={isPlain ? "xl" : "2xl"} closeLabel={t("closeLabel")}
      title={newsletter ? t("nlEditTitle") : t("nlNewTitle")}
      description={t("nlEditorDesc")}
      footer={confirming ? (
        <>
          <span role="status" className="mr-auto text-ui font-semibold text-card-foreground">{t("nlSendConfirm").replace("{n}", count)}</span>
          <Button type="button" variant="secondary" onClick={() => setConfirming(false)}>{t("nlBack")}</Button>
          <Button type="button" onClick={send} data-autofocus>
            <Send className="h-4 w-4" aria-hidden="true" /> {t("nlConfirmSend").replace("{n}", count)}
          </Button>
        </>
      ) : (
        <>
          {error ? <span role="alert" className="mr-auto text-meta text-tone-danger-ink">{t(error)}</span> : null}
          {!error && !hasAddress ? <span className="mr-auto text-meta text-muted">{t("nlNoAddress")}</span> : null}
          <Button type="button" variant="secondary" onClick={onCancel} disabled={!!busy}>{t("cancelLabel")}</Button>
          <Button type="button" variant="secondary" onClick={save} loading={busy === "save"} disabled={!ready || !!busy}>{t("nlSaveDraft")}</Button>
          <Button type="button" onClick={() => setConfirming(true)} loading={busy === "send"} disabled={!ready || !!busy || !count || !hasAddress}>
            <Send className="h-4 w-4" aria-hidden="true" /> {count === null ? t("nlSendPlain") : t("nlSendBtn").replace("{n}", count)}
          </Button>
        </>
      )}
    >
      <div className={isPlain ? "" : "grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]"}>
      <div className="flex min-w-0 flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={t("nlAudienceLabel")} htmlFor="nl-audience"
            hint={count === null ? t("nlCounting") : t(count === 1 ? "nlAudienceCountOne" : "nlAudienceCount").replace("{n}", count)}>
            <Select id="nl-audience" value={fields.audience} onChange={(e) => set("audience", e.target.value)}>
              {NEWSLETTER_AUDIENCES.map((a) => <option key={a} value={a}>{t("nlAudience_" + a)}</option>)}
            </Select>
          </Field>
          <Field label={t("commsLanguageLabel")} htmlFor="nl-language" hint={t("nlLanguageHint")}>
            <Select id="nl-language" value={fields.language} onChange={(e) => set("language", e.target.value)}>
              {MESSAGE_LANGUAGES.map((l) => <option key={l} value={l}>{LANGUAGE_NAMES[l]}</option>)}
            </Select>
          </Field>
        </div>
        {count === 0 ? <Alert tone="info">{t("nlNoRecipients")}</Alert> : null}
        <Field label={t("commsSubjectLabel")} htmlFor="nl-subject" required>
          <Input id="nl-subject" value={fields.subject} maxLength={NEWSLETTER_SUBJECT_MAX} onChange={(e) => set("subject", e.target.value)} data-autofocus />
        </Field>
        <LayoutPicker value={fields.layout} onChange={chooseLayout} />
        {isPlain ? (
          <Field label={t("commsMessageLabel")} htmlFor="nl-body" required
            hint={<span className="tabular-nums">{fields.body.length} / {NEWSLETTER_BODY_MAX} · {t("nlBodyHint")}</span>}>
            <Textarea id="nl-body" value={fields.body} rows={12} maxLength={NEWSLETTER_BODY_MAX} onChange={(e) => set("body", e.target.value)} />
          </Field>
        ) : (
          <LayoutFields layout={fields.layout} content={fields.content} onChange={setContent} />
        )}
        <p className="m-0 flex items-start gap-2 text-meta text-muted">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          {t(isPlain ? "nlPrivacyNote" : "nlPrivacyNoteImages")}
        </p>
      </div>
      {!isPlain ? (
        <div className="min-w-0 lg:sticky lg:top-0 lg:self-start">
          <NewsletterPreview layout={fields.layout} content={fields.content} subject={fields.subject} language={fields.language} address={address} />
        </div>
      ) : null}
      </div>
    </Dialog>
  );
}

function StatsLine({ n, stats }) {
  const t = useT();
  if (n.status === "draft") return null;
  const s = stats || { waiting: 0, sent: 0, failed: 0, cancelled: 0, unsubscribed: 0 };
  const parts = [
    t("nlStatRecipients").replace("{n}", n.recipientCount),
    t("nlStatSent").replace("{n}", s.sent),
    s.waiting ? t("nlStatWaiting").replace("{n}", s.waiting) : null,
    s.failed ? t("nlStatFailed").replace("{n}", s.failed) : null,
    s.cancelled ? t("nlStatStopped").replace("{n}", s.cancelled) : null,
    s.unsubscribed ? t("nlStatUnsubscribed").replace("{n}", s.unsubscribed) : null
  ].filter(Boolean);
  return <p className="m-0 mt-1 text-meta tabular-nums text-muted">{parts.join(" · ")}</p>;
}

export default function Newsletters() {
  const { lang, can, orgSettings, refetchOrgSettings, requestConfirm, showToast } = useApp();
  const t = useT();
  const [list, setList] = useState(null);
  const [stats, setStats] = useState({});
  const [loadError, setLoadError] = useState(false);
  const [editing, setEditing] = useState(null); // null | "new" | newsletter
  const address = orgSettings && typeof orgSettings.mailing_address === "string" ? orgSettings.mailing_address : "";

  function load() {
    setLoadError(false);
    fetchNewsletterStats().then(setStats);
    return fetchNewsletters().then(setList).catch((err) => { console.warn("fetchNewsletters failed", err); setLoadError(true); });
  }
  useEffect(() => { load(); }, []);

  async function remove(n) {
    if (!(await requestConfirm(t("nlDeleteConfirm"), { danger: true }))) return;
    try { await deleteNewsletter(n.id); load(); } catch (err) { console.warn("deleteNewsletter failed", err); showToast(t("userActionError")); }
  }
  async function stop(n) {
    if (!(await requestConfirm(t("nlStopConfirm"), { danger: true }))) return;
    try {
      const stopped = await cancelNewsletter(n.id);
      showToast(t("nlStoppedToast").replace("{n}", stopped));
      load();
    } catch (err) {
      console.warn("cancelNewsletter failed", err);
      showToast(t("userActionError"));
    }
  }

  const items = list || [];
  return (
    <>
      <PageHeader
        title={t("nlTitle")}
        description={t("nlDesc")}
        actions={<Button onClick={() => setEditing("new")}><MailPlus className="h-4 w-4" aria-hidden="true" /> {t("nlNewTitle")}</Button>}
      />

      {list !== null ? (
        <MailingAddressCard key={address} address={address} canEdit={can("admin.settings.manage")} onSaved={refetchOrgSettings} />
      ) : null}

      {loadError ? (
        <EmptyState variant="error" title={t("commsLoadErrorTitle")} description={t("commsLoadErrorDesc")}
          action={<Button variant="secondary" onClick={load}>{t("retryLabel")}</Button>} />
      ) : list === null ? null : !items.length ? (
        <EmptyState icon={Newspaper} title={t("nlEmptyTitle")} description={t("nlEmptyDesc")}
          action={<Button onClick={() => setEditing("new")}><MailPlus className="h-4 w-4" aria-hidden="true" /> {t("nlNewTitle")}</Button>} />
      ) : (
        <SectionCard title={t("nlListTitle")} flush>
          <ul className="m-0 list-none p-0">
            {items.map((n) => {
              const s = stats[n.id];
              return (
                <li key={n.id} className="flex flex-col gap-2 border-b border-line-subtle px-5 py-4 last:border-b-0 sm:flex-row sm:items-start sm:justify-between sm:px-6">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-ui font-semibold text-card-foreground">{n.subject}</span>
                      <StatusBadge domain="newsletter" status={n.status}>{t("nlStatus_" + n.status)}</StatusBadge>
                      <Badge variant="neutral">{t("nlAudience_" + n.audience)}</Badge>
                      <Badge variant="neutral">{LANGUAGE_NAMES[n.language]}</Badge>
                      {n.layout && n.layout !== "plain" ? <Badge variant="info">{t("nlLayout_" + n.layout)}</Badge> : null}
                    </div>
                    <p className="m-0 mt-1 text-meta text-muted">
                      {n.sentAt
                        ? t("nlSentOn").replace("{date}", fmtDateLong(dateStrFromDate(new Date(n.sentAt)), lang))
                        : t("nlEditedOn").replace("{date}", fmtDateLong(dateStrFromDate(new Date(n.updatedAt)), lang))}
                      {n.authorName ? " · " + n.authorName : ""}
                    </p>
                    <StatsLine n={n} stats={s} />
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    {n.status === "draft" ? (
                      <>
                        <Button size="sm" variant="secondary" onClick={() => setEditing(n)}><Pencil className="h-4 w-4" aria-hidden="true" /> {t("editLabel")}</Button>
                        <Button size="sm" variant="ghost" onClick={() => remove(n)}><Trash2 className="h-4 w-4" aria-hidden="true" /> {t("deleteLabel")}</Button>
                      </>
                    ) : null}
                    {n.status === "sent" && s && s.waiting > 0 ? (
                      <Button size="sm" variant="ghost" onClick={() => stop(n)}><XCircle className="h-4 w-4" aria-hidden="true" /> {t("nlStop")}</Button>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        </SectionCard>
      )}

      {editing ? (
        <NewsletterEditor
          newsletter={editing === "new" ? null : editing}
          hasAddress={!!address}
          address={address}
          onCancel={() => setEditing(null)}
          onSaved={() => { setEditing(null); showToast(t("nlDraftSaved")); load(); }}
          onSent={(n) => { setEditing(null); showToast(t("nlSentToast").replace("{n}", n.recipient_count)); load(); }}
        />
      ) : null}
    </>
  );
}
