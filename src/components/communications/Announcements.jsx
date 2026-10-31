// Announcements.jsx -- the Communications module's Announcements section:
// notices from leadership to every staff member (closures, training days,
// policy changes). Everyone with communications.announcements.view reads
// them; posting one sends each of them an in-app notification (the
// notify_staff_announcement trigger), and the bell links here.
//
// Pinned notices sit on top, then important ones, then newest. An
// announcement stops showing after its last day or once it's archived;
// posters can see and restore archived ones. Opening this page marks what's
// on it as read for you, so "New" means new since your last look.
import { useEffect, useRef, useState } from "react";
import { Archive, ArchiveRestore, Megaphone, Pencil, Pin, Plus } from "lucide-react";
import { useApp, useT } from "../../context/AppContext.jsx";
import {
  ANNOUNCEMENT_BODY_MAX, ANNOUNCEMENT_TITLE_MAX, currentAnnouncements, fetchAnnouncementReads, fetchAnnouncements,
  markAnnouncementRead, postAnnouncement, setAnnouncementArchived, subscribeAnnouncements, updateAnnouncement
} from "../../lib/communications.js";
import { dateStrFromDate, fmtDateLong, todayStr } from "../../lib/utils.js";
import DatePicker from "../DatePicker.jsx";
import { Badge } from "../ui/badge.jsx";
import { Button } from "../ui/button.jsx";
import { Card } from "../ui/card.jsx";
import { Dialog } from "../ui/dialog.jsx";
import { EmptyState } from "../ui/empty-state.jsx";
import { Field, Input, Textarea } from "../ui/field.jsx";
import { PageHeader } from "../ui/page-header.jsx";
import { SegmentedControl } from "../ui/segmented-control.jsx";
import { cn } from "../../lib/cn.js";

function AnnouncementDialog({ announcement, onSave, onCancel }) {
  const t = useT();
  const [fields, setFields] = useState(announcement
    ? { title: announcement.title, body: announcement.body, priority: announcement.priority, pinned: announcement.pinned, expiresOn: announcement.expiresOn }
    : { title: "", body: "", priority: "normal", pinned: false, expiresOn: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const ready = fields.title.trim() && fields.body.trim();

  function set(name, value) { setError(null); setFields((prev) => Object.assign({}, prev, { [name]: value })); }

  async function submit(e) {
    e.preventDefault();
    if (!ready || saving) return;
    setSaving(true);
    try { await onSave(fields); } catch (err) { console.warn("save announcement failed", err); setError(t("userActionError")); } finally { setSaving(false); }
  }

  return (
    <Dialog
      open onClose={onCancel} size="lg" closeLabel={t("closeLabel")}
      title={announcement ? t("commsEditAnnouncement") : t("commsNewAnnouncement")}
      description={announcement ? null : t("commsNewAnnouncementDesc")}
      as="form" panelProps={{ onSubmit: submit }}
      footer={
        <>
          {error ? <span role="alert" className="mr-auto text-meta text-tone-danger-ink">{error}</span> : null}
          <Button type="button" variant="secondary" onClick={onCancel} disabled={saving}>{t("cancelLabel")}</Button>
          <Button type="submit" loading={saving} disabled={!ready}>{announcement ? t("saveLabel") : t("commsPostAnnouncement")}</Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label={t("commsAnnouncementTitleLabel")} htmlFor="ann-title" required>
          <Input id="ann-title" value={fields.title} maxLength={ANNOUNCEMENT_TITLE_MAX} onChange={(e) => set("title", e.target.value)} data-autofocus />
        </Field>
        <Field label={t("commsMessageLabel")} htmlFor="ann-body" required hint={<span className="tabular-nums">{fields.body.length} / {ANNOUNCEMENT_BODY_MAX}</span>}>
          <Textarea id="ann-body" value={fields.body} rows={6} maxLength={ANNOUNCEMENT_BODY_MAX} onChange={(e) => set("body", e.target.value)} />
        </Field>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <SegmentedControl label={t("commsPriorityLabel")} value={fields.priority} onChange={(v) => set("priority", v)}
            options={[{ value: "normal", label: t("commsPriority_normal") }, { value: "important", label: t("commsPriority_important") }]} />
          <Field label={t("commsShowUntilLabel")} htmlFor="ann-expires" hint={t("commsShowUntilHint")}>
            <DatePicker id="ann-expires" value={fields.expiresOn} onChange={(v) => set("expiresOn", v)} min={todayStr()} />
          </Field>
        </div>
        <label className="m-0 flex cursor-pointer items-center gap-2.5 text-ui font-medium text-card-foreground">
          <input type="checkbox" checked={fields.pinned} onChange={(e) => set("pinned", e.target.checked)} className="h-4 w-4 cursor-pointer accent-primary" />
          {t("commsPinLabel")}
        </label>
      </div>
    </Dialog>
  );
}

function AnnouncementCard({ a, isNew, canPost, onEdit, onArchive, lang }) {
  const t = useT();
  return (
    <Card role="article" className={cn("p-5 sm:p-6", a.priority === "important" && !a.archivedAt && "border-tone-warning-border")} aria-labelledby={"ann-" + a.id}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {a.pinned ? <Pin className="h-4 w-4 text-muted" aria-label={t("commsPinned")} /> : null}
            <h2 id={"ann-" + a.id} className="m-0 text-heading font-bold text-card-foreground">{a.title}</h2>
            {isNew ? <Badge variant="info" dot>{t("commsNew")}</Badge> : null}
            {a.priority === "important" ? <Badge variant="warning">{t("commsPriority_important")}</Badge> : null}
            {a.archivedAt ? <Badge variant="neutral">{t("commsArchived")}</Badge> : null}
          </div>
          <p className="m-0 mt-1 text-meta text-muted">
            {[a.authorName, fmtDateLong(dateStrFromDate(new Date(a.createdAt)), lang)].filter(Boolean).join(" · ")}
            {a.expiresOn ? " · " + t("commsShowsUntil").replace("{date}", fmtDateLong(a.expiresOn, lang)) : ""}
          </p>
        </div>
        {canPost ? (
          <div className="flex shrink-0 flex-wrap gap-2">
            <Button size="sm" variant="ghost" onClick={() => onEdit(a)}><Pencil className="h-4 w-4" aria-hidden="true" /> {t("editLabel")}</Button>
            <Button size="sm" variant="ghost" onClick={() => onArchive(a, !a.archivedAt)}>
              {a.archivedAt
                ? <><ArchiveRestore className="h-4 w-4" aria-hidden="true" /> {t("commsRestore")}</>
                : <><Archive className="h-4 w-4" aria-hidden="true" /> {t("commsArchive")}</>}
            </Button>
          </div>
        ) : null}
      </div>
      <p className="m-0 mt-3 max-w-[75ch] whitespace-pre-wrap text-body text-card-foreground">{a.body}</p>
    </Card>
  );
}

export default function Announcements({ intent }) {
  const { lang, can, session, requestConfirm, showToast } = useApp();
  const t = useT();
  const [list, setList] = useState(null);
  const [readIds, setReadIds] = useState(new Set());
  const [loadError, setLoadError] = useState(false);
  const [view, setView] = useState("current");
  const [editing, setEditing] = useState(intent === "new" ? "new" : null);
  // Unread when the page opened: those keep their "New" badge for this visit
  // even after they're marked read.
  const newOnOpen = useRef(null);
  const canPost = can("communications.announcements.post");
  const today = todayStr();

  function load() {
    setLoadError(false);
    return Promise.all([fetchAnnouncements(), fetchAnnouncementReads()])
      .then(([rows, reads]) => { setList(rows); setReadIds(reads); })
      .catch((err) => { console.warn("fetchAnnouncements failed", err); setLoadError(true); });
  }
  useEffect(() => {
    load();
    return subscribeAnnouncements(() => { fetchAnnouncements().then(setList).catch(() => {}); });
  }, []);

  const current = currentAnnouncements(list || [], today);
  useEffect(() => {
    if (list === null || newOnOpen.current) return;
    const unread = current.filter((a) => !readIds.has(a.id));
    newOnOpen.current = new Set(unread.map((a) => a.id));
    unread.forEach((a) => { markAnnouncementRead(a.id).catch((err) => console.warn("markAnnouncementRead failed", err)); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list]);

  const archived = (list || []).filter((a) => a.archivedAt || (a.expiresOn && a.expiresOn < today));
  const shown = view === "archived" ? archived : current;
  // Your own posts are never "new" to you.
  const isNew = (a) => a.createdBy !== (session && session.id) &&
    (!readIds.has(a.id) || (newOnOpen.current && newOnOpen.current.has(a.id)));

  async function save(fields) {
    if (editing === "new") await postAnnouncement(fields);
    else await updateAnnouncement(editing.id, fields);
    showToast(t(editing === "new" ? "commsAnnouncementPosted" : "commsAnnouncementSaved"));
    setEditing(null);
    load();
  }

  async function archive(a, on) {
    if (on && !(await requestConfirm(t("commsArchiveConfirm")))) return;
    try {
      await setAnnouncementArchived(a.id, on);
      load();
    } catch (err) {
      console.warn("setAnnouncementArchived failed", err);
      showToast(t("userActionError"));
    }
  }

  return (
    <>
      <PageHeader
        title={t("commsAnnouncementsTitle")}
        description={t("commsAnnouncementsDesc")}
        actions={canPost ? <Button onClick={() => setEditing("new")}><Plus className="h-4 w-4" aria-hidden="true" /> {t("commsNewAnnouncement")}</Button> : null}
      />

      {canPost ? (
        <SegmentedControl className="mb-4" label={t("commsShowLabel")} value={view} onChange={setView}
          options={[{ value: "current", label: t("commsCurrent") }, { value: "archived", label: t("commsArchivedAndExpired") }]} />
      ) : null}

      {loadError ? (
        <EmptyState variant="error" title={t("commsLoadErrorTitle")} description={t("commsLoadErrorDesc")}
          action={<Button variant="secondary" onClick={load}>{t("retryLabel")}</Button>} />
      ) : list === null ? null : !shown.length ? (
        <EmptyState icon={Megaphone}
          title={t(view === "archived" ? "commsNoArchivedTitle" : "commsAnnouncementsEmptyTitle")}
          description={t(view === "archived" ? "commsNoArchivedDesc" : canPost ? "commsAnnouncementsEmptyPosterDesc" : "commsAnnouncementsEmptyDesc")}
          action={canPost && view === "current" ? <Button onClick={() => setEditing("new")}><Plus className="h-4 w-4" aria-hidden="true" /> {t("commsNewAnnouncement")}</Button> : null} />
      ) : (
        <div className="space-y-4">
          {shown.map((a) => (
            <AnnouncementCard key={a.id} a={a} isNew={view === "current" && isNew(a)} canPost={canPost} lang={lang}
              onEdit={setEditing} onArchive={archive} />
          ))}
        </div>
      )}

      {editing ? <AnnouncementDialog announcement={editing === "new" ? null : editing} onSave={save} onCancel={() => setEditing(null)} /> : null}
    </>
  );
}
