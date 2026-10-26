// JobClientProfile.jsx -- rich Job Developer client detail page (mockup
// parity). Route: /jobdeveloper/:clientId, where clientId is the raw
// jobClients[].id (this page is fundamentally about one program record's
// detail). Notes/Documents reuse the unified client_notes/client_documents
// tables (masterClients.js, resolved via the record's nbId), but notes are
// scoped to department "job" so they stay separate from Case Manager's
// department "case" notes on the same client -- see fetchClientNotes().
//
// Layout follows the record-page template (ClientProfile.jsx +
// ClientHeader.jsx): ghost back link, identity header with two visible
// actions and a More menu, a summary card (pipeline tracker + readiness
// gauge), then <Tabs> with counts and a TabPanel of SectionCards. Lists
// inside a panel are divided rows; applications use DataTable; every edit
// is a ui Dialog form.
import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft, Briefcase, CalendarClock, CalendarDays, Download, FileText, Mail, MapPin, MessageSquarePlus, MoreHorizontal,
  Paperclip, Pencil, Phone, Plus, StickyNote, Trash2, UploadCloud, UserX, X
} from "lucide-react";
import { useApp, useT } from "../context/AppContext.jsx";
import {
  APPLICATION_STATUSES, applicationStatusLabel, BARRIERS_TO_EMPLOYMENT,
  computeJobReadinessScore, EMPLOYMENT_STATUSES, JOB_SERVICES_PROVIDED,
  readinessBucket, WORK_AUTH_STATUSES
} from "../lib/jobProfile.js";
import { findClientByNbId } from "../lib/masterClients.js";
import {
  createApplication, createClientDocument, createClientNote, deleteApplication, deleteClientDocument,
  fetchApplications, fetchClientDocuments, fetchClientNotes, getFileSignedUrl, updateJobClient, uploadClientFile
} from "../lib/clientsData.js";
import { avatarColorFor } from "../lib/avatarTone.js";
import { formatAddress, formatPhone, fmtDateLong, initialsOf } from "../lib/utils.js";
import CircularGauge from "../components/CircularGauge.jsx";
import DatePicker from "../components/DatePicker.jsx";
import JobPipelineTracker from "../components/JobPipelineTracker.jsx";
import NbIdBadge from "../components/NbIdBadge.jsx";
import { Avatar, AvatarFallback } from "../components/ui/avatar.jsx";
import { Button } from "../components/ui/button.jsx";
import { Card } from "../components/ui/card.jsx";
import { DataTable } from "../components/ui/data-table.jsx";
import { Dialog } from "../components/ui/dialog.jsx";
import { DetailRow } from "../components/ui/drawer.jsx";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from "../components/ui/dropdown-menu.jsx";
import { EmptyState } from "../components/ui/empty-state.jsx";
import { Field, Input, Select, Textarea } from "../components/ui/field.jsx";
import { FilterChips } from "../components/ui/filter-chips.jsx";
import { IconButton } from "../components/ui/icon-button.jsx";
import { SectionCard } from "../components/ui/section-card.jsx";
import { StatusBadge } from "../components/ui/status-badge.jsx";
import { TabPanel, Tabs } from "../components/ui/tabs.jsx";
import AddressInput from "../components/AddressInput.jsx";

const TAB_KEYS = ["overview", "applications", "interviews", "services", "documents", "notes", "history"];
const TAB_LABEL = {
  overview: "clientTabOverview", applications: "applicationsTabLabel", interviews: "clientTabAppointments",
  services: "servicesProvidedLabel", documents: "clientTabDocuments", notes: "clientTabNotes", history: "clientTabActivity"
};
const TAB_ID_BASE = "job-client-profile";

// One list row inside a flush SectionCard: hairline between rows, card padding.
const ROW = "border-b border-line-subtle px-5 py-4 last:border-b-0 sm:px-6";

// FilterChips scrolls sideways by default (a filter row); a multi-select
// field of tags reads better wrapped, so every option stays in view.
const WRAP_CHIPS = "flex-wrap overflow-visible";

const FILE_INPUT = "h-auto py-1.5 file:mr-3 file:cursor-pointer file:rounded-control file:border-0 file:bg-primary-tint file:px-3 file:py-1.5 file:text-ui file:font-semibold file:text-primary [@media(pointer:coarse)]:h-auto";

function FieldRow({ label, value }) {
  return <DetailRow label={label}>{value || "—"}</DetailRow>;
}

// Documents/resumes now live in Supabase Storage (private bucket), not as
// inline base64 -- this resolves a short-lived signed URL on click and
// hands it to a temporary <a download>.
async function downloadStorageFile(path, fileName) {
  const url = await getFileSignedUrl(path);
  if (url) {
    const a = document.createElement("a");
    a.href = url; a.download = fileName || "";
    document.body.appendChild(a); a.click(); a.remove();
  }
}

// A real button (not an href="#" link) that fetches the signed URL; spins
// while it resolves so a second click can't start a second download.
function DownloadButton({ path, fileName, label, iconOnly, variant = "ghost", size = "sm" }) {
  const [loading, setLoading] = useState(false);
  async function onClick() {
    if (loading) return;
    setLoading(true);
    try { await downloadStorageFile(path, fileName); } finally { setLoading(false); }
  }
  if (iconOnly) {
    return (
      <IconButton label={label} onClick={onClick} disabled={loading} aria-busy={loading || undefined}>
        <Download aria-hidden="true" />
      </IconButton>
    );
  }
  return (
    <Button variant={variant} size={size} onClick={onClick} loading={loading}>
      {loading ? null : <Download className="h-4 w-4" aria-hidden="true" />}{label}
    </Button>
  );
}

// Runs an async save with the footer button in its loading state, so a
// double-click can't submit twice. The caller closes the dialog on success.
function useSaving() {
  const [saving, setSaving] = useState(false);
  async function run(fn) {
    setSaving(true);
    try { await fn(); } finally { setSaving(false); }
  }
  return [saving, run];
}

function DialogFooter({ onCancel, saving, disabled, submitLabel }) {
  const t = useT();
  return (
    <>
      <Button type="button" variant="secondary" onClick={onCancel} disabled={saving}>{t("cancelLabel")}</Button>
      <Button type="submit" loading={saving} disabled={disabled}>{submitLabel}</Button>
    </>
  );
}

function ApplicationRowMenu({ application, onDelete }) {
  const t = useT();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <IconButton label={t("actionsLabel") + ": " + application.company} size="sm">
          <MoreHorizontal aria-hidden="true" />
        </IconButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={onDelete} className="text-tone-danger-ink focus:bg-tone-danger-bg data-[highlighted]:bg-tone-danger-bg">
          <Trash2 className="h-4 w-4" aria-hidden="true" /> {t("deleteLabel")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function PersonalInfoModal({ record, onSave, onCancel }) {
  const t = useT();
  const [saving, run] = useSaving();
  const [fields, setFields] = useState({
    phone: record.phone || "", email: record.email || "", street: record.street || "", city: record.city || "", zip: record.zip || "",
    transportation: record.transportation || "", preferredLanguage: record.preferredLanguage || "", secondaryLanguage: record.secondaryLanguage || ""
  });
  function setField(name, value) { setFields((prev) => Object.assign({}, prev, { [name]: value })); }
  function text(name, labelKey, phKey, extra) {
    // The street field suggests addresses and fills city/zip from the pick.
    const addr = name === "street" ? { as: Input, onAddressSelect: (a) => setFields((prev) => Object.assign({}, prev, { street: a.street, city: a.city || prev.city, zip: a.zip || prev.zip })) } : null;
    const Control = addr ? AddressInput : Input;
    const id = "job-personal-" + name;
    return (
      <Field label={t(labelKey)} htmlFor={id}>
        <Control {...addr} id={id} value={fields[name]} onChange={(e) => setField(name, e.target.value)} placeholder={t(phKey)} autoComplete="off" {...extra} />
      </Field>
    );
  }

  return (
    <Dialog
      open
      onClose={onCancel}
      title={t("personalInformationLabel")}
      size="lg"
      closeLabel={t("closeLabel")}
      as="form"
      panelProps={{ onSubmit: (e) => { e.preventDefault(); run(() => onSave(fields)); } }}
      footer={<DialogFooter onCancel={onCancel} saving={saving} submitLabel={t("saveLabel")} />}
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {text("phone", "phone", "phPhone", { type: "tel", "data-autofocus": true })}
        {text("email", "email", "phEmail", { type: "email" })}
        {text("street", "address", "phAddress")}
        {text("city", "city", "phCity")}
        {text("zip", "zip", "phZip")}
        {text("transportation", "transportationLabel", "phTransportation")}
        {text("preferredLanguage", "preferredLanguageLabel", "phPreferredLanguage")}
        {text("secondaryLanguage", "secondaryLanguageLabel", "phSecondaryLanguage")}
      </div>
    </Dialog>
  );
}

function AddApplicationModal({ onSave, onCancel }) {
  const t = useT();
  const [saving, run] = useSaving();
  const [fields, setFields] = useState({ company: "", position: "", appliedDate: "", status: "applied", nextStepDate: "", nextStepNote: "", interviewDate: "", interviewNotes: "" });
  function setField(name, value) { setFields((prev) => Object.assign({}, prev, { [name]: value })); }
  const incomplete = !fields.company.trim() || !fields.position.trim();

  return (
    <Dialog
      open
      onClose={onCancel}
      title={t("addApplicationBtn")}
      size="lg"
      closeLabel={t("closeLabel")}
      as="form"
      panelProps={{ onSubmit: (e) => { e.preventDefault(); if (!incomplete) run(() => onSave(fields)); } }}
      footer={<DialogFooter onCancel={onCancel} saving={saving} disabled={incomplete} submitLabel={t("saveLabel")} />}
    >
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={t("companyLabel")} htmlFor="app-company" required>
            <Input id="app-company" value={fields.company} onChange={(e) => setField("company", e.target.value)} placeholder={t("phCompany")} autoComplete="off" data-autofocus />
          </Field>
          <Field label={t("positionLabel")} htmlFor="app-position" required>
            <Input id="app-position" value={fields.position} onChange={(e) => setField("position", e.target.value)} placeholder={t("phPositionTitle")} autoComplete="off" />
          </Field>
          <Field label={t("appliedDateLabel")} htmlFor="app-applied-date">
            <DatePicker id="app-applied-date" value={fields.appliedDate} onChange={(v) => setField("appliedDate", v)} />
          </Field>
          <Field label={t("statusLabel")} htmlFor="app-status">
            <Select id="app-status" value={fields.status} onChange={(e) => setField("status", e.target.value)}>
              {APPLICATION_STATUSES.map((s) => <option key={s.key} value={s.key}>{s.en}</option>)}
            </Select>
          </Field>
          <Field label={t("nextStepLabel")} htmlFor="app-next-step-date">
            <DatePicker id="app-next-step-date" value={fields.nextStepDate} onChange={(v) => setField("nextStepDate", v)} />
          </Field>
          <Field label={t("interviewDateLabel")} htmlFor="app-interview-date">
            <DatePicker id="app-interview-date" value={fields.interviewDate} onChange={(v) => setField("interviewDate", v)} />
          </Field>
        </div>
        <Field label={t("noteContentLabel")} htmlFor="app-next-step-note">
          <Input id="app-next-step-note" value={fields.nextStepNote} onChange={(e) => setField("nextStepNote", e.target.value)} placeholder={t("nextStepLabel")} autoComplete="off" />
        </Field>
        {fields.interviewDate ? (
          <Field label={t("interviewNotesLabel")} htmlFor="app-interview-notes">
            <Input id="app-interview-notes" value={fields.interviewNotes} onChange={(e) => setField("interviewNotes", e.target.value)} placeholder={t("phInterviewNotes")} autoComplete="off" />
          </Field>
        ) : null}
      </div>
    </Dialog>
  );
}

function AddNoteModal({ onSave, onCancel }) {
  const t = useT();
  const [saving, run] = useSaving();
  const [content, setContent] = useState("");
  return (
    <Dialog
      open
      onClose={onCancel}
      title={t("addNoteBtn")}
      size="md"
      closeLabel={t("closeLabel")}
      as="form"
      panelProps={{ onSubmit: (e) => { e.preventDefault(); if (content.trim()) run(() => onSave({ content, type: "general", visibility: "all", department: "job" })); } }}
      footer={<DialogFooter onCancel={onCancel} saving={saving} disabled={!content.trim()} submitLabel={t("saveLabel")} />}
    >
      <Field label={t("noteContentLabel")} htmlFor="job-note-content" required>
        <Textarea id="job-note-content" value={content} onChange={(e) => setContent(e.target.value)} rows={4} placeholder={t("phNoteContent")} data-autofocus />
      </Field>
    </Dialog>
  );
}

function UploadDocumentModal({ onSave, onCancel }) {
  const t = useT();
  const [saving, run] = useSaving();
  const [fileName, setFileName] = useState("");
  const fileRef = useRef(null);
  function submit(e) {
    e.preventDefault();
    const file = fileRef.current && fileRef.current.files && fileRef.current.files[0];
    if (!file) return;
    run(() => onSave({ category: "other", fileName: file.name, file, program: "job" }));
  }
  return (
    <Dialog
      open
      onClose={onCancel}
      title={t("uploadDocumentBtn")}
      size="md"
      closeLabel={t("closeLabel")}
      as="form"
      panelProps={{ onSubmit: submit }}
      footer={<DialogFooter onCancel={onCancel} saving={saving} disabled={!fileName} submitLabel={t("saveLabel")} />}
    >
      <Field label={t("documentFileLabel")} htmlFor="job-document-file" required>
        <Input
          id="job-document-file" ref={fileRef} type="file" data-autofocus
          onChange={(e) => setFileName(e.target.files && e.target.files[0] ? e.target.files[0].name : "")}
          className={FILE_INPUT}
        />
      </Field>
    </Dialog>
  );
}

function ContactItem({ icon: Icon, label, children }) {
  return (
    <div className="flex min-w-0 items-center gap-1.5">
      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
      <dt className="sr-only">{label}</dt>
      <dd className="m-0 min-w-0 break-words">{children}</dd>
    </div>
  );
}

// Identity header -- ClientHeader's anatomy for a Job Developer record:
// back link, avatar, name as the page h1, NB ID + status, contact line,
// two visible actions and the rest under More.
function JobClientHeader({ record, name, onBack, onAddApplication, onEditPersonal, onAddNote, onUploadDocument }) {
  const t = useT();
  return (
    <header className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div className="min-w-0">
        <Button variant="ghost" size="sm" className="-ml-2 mb-2 text-muted" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          {t("navJobDeveloper")}
        </Button>
        <div className="flex items-start gap-4">
          <Avatar className="h-14 w-14 shrink-0" aria-hidden="true">
            <AvatarFallback className={avatarColorFor(name) + " text-section"}>{initialsOf(record)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <h1 className="m-0 text-heading font-bold text-card-foreground [text-wrap:balance]">{name}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {record.nbId ? <NbIdBadge nbId={record.nbId} /> : null}
              <StatusBadge domain="client" status="active">{t("statusActive")}</StatusBadge>
            </div>
            <dl className="m-0 mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-meta text-muted">
              <ContactItem icon={Phone} label={t("phone")}><span className="tabular-nums">{formatPhone(record.phone) || "—"}</span></ContactItem>
              <ContactItem icon={Mail} label={t("email")}>{record.email || "—"}</ContactItem>
              <ContactItem icon={MapPin} label={t("address")}>{formatAddress(record) || "—"}</ContactItem>
              <ContactItem icon={CalendarDays} label={t("intakeDateLabel")}>
                <span>{t("intakeDateLabel")}: <span className="tabular-nums">{fmtDateLong(record.intakeDate)}</span></span>
              </ContactItem>
            </dl>
          </div>
        </div>
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <Button onClick={onAddApplication}>
          <Plus className="h-4 w-4" aria-hidden="true" /> {t("addApplicationBtn")}
        </Button>
        <Button variant="secondary" onClick={onEditPersonal}>
          <Pencil className="h-4 w-4" aria-hidden="true" /> {t("editProfileBtn")}
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <IconButton label={t("moreActionsBtn")} variant="secondary" size="lg">
              <MoreHorizontal aria-hidden="true" />
            </IconButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-[14rem]">
            <DropdownMenuItem onSelect={onAddNote}>
              <MessageSquarePlus className="h-4 w-4 text-muted" aria-hidden="true" />{t("addNoteBtn")}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onUploadDocument}>
              <UploadCloud className="h-4 w-4 text-muted" aria-hidden="true" />{t("uploadDocumentBtn")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

export default function JobClientProfile() {
  const { clientId } = useParams();
  const { data, requestConfirm, showToast } = useApp();
  const t = useT();
  const navigate = useNavigate();
  const [tab, setTab] = useState("overview");
  const [editingPersonal, setEditingPersonal] = useState(false);
  const [addingApplication, setAddingApplication] = useState(false);
  const [addingNote, setAddingNote] = useState(false);
  const [uploadingDocument, setUploadingDocument] = useState(false);
  const [skillInput, setSkillInput] = useState("");
  const resumeFileRef = useRef(null);
  // Applications/notes/documents are their own tables now (see
  // plans/wobbly-munching-rose.md) -- fetched per-client on demand rather
  // than embedded on the job_clients row or held in global AppContext state.
  const [applications, setApplications] = useState([]);
  const [notes, setNotes] = useState([]);
  const [documents, setDocuments] = useState([]);

  const record = (data.jobClients || []).find((c) => c.id === clientId);
  const masterClient = record && record.nbId ? findClientByNbId(record.nbId, data) : null;
  const masterClientId = masterClient && masterClient.id;
  const recordId = record && record.id;

  useEffect(() => {
    let cancelled = false;
    if (!recordId) { setApplications([]); return; }
    fetchApplications(recordId).then((rows) => { if (!cancelled) setApplications(rows); });
    return () => { cancelled = true; };
  }, [recordId]);

  useEffect(() => {
    let cancelled = false;
    if (!masterClientId) { setNotes([]); setDocuments([]); return; }
    fetchClientNotes(masterClientId, "job").then((rows) => { if (!cancelled) setNotes(rows); });
    fetchClientDocuments(masterClientId).then((rows) => { if (!cancelled) setDocuments(rows); });
    return () => { cancelled = true; };
  }, [masterClientId]);

  if (!record) {
    return (
      <Card>
        <EmptyState
          variant="no-results"
          icon={UserX}
          title={t("clientNotFoundTitle")}
          description={t("jobClientNotFoundMessage")}
          action={<Button variant="secondary" onClick={() => navigate("/workforce/participants")}><ArrowLeft className="h-4 w-4" aria-hidden="true" />{t("navJobDeveloper")}</Button>}
        />
      </Card>
    );
  }

  const name = (record.firstName + " " + record.lastName).trim();
  const interviews = applications.filter((a) => a.interviewDate);
  const score = computeJobReadinessScore(record);
  const bucket = readinessBucket(score);
  const servicesProvided = record.servicesProvided || [];
  const skills = record.skills || [];

  async function updateRecord(patch) {
    await updateJobClient(clientId, patch);
  }

  async function addSkill() {
    const v = skillInput.trim();
    if (!v) return;
    await updateRecord({ skills: (record.skills || []).concat([v]) });
    setSkillInput("");
  }
  async function removeSkill(skill) {
    await updateRecord({ skills: (record.skills || []).filter((s) => s !== skill) });
  }

  async function addApplication(fields) {
    const created = await createApplication(record.id, fields);
    setApplications((prev) => [created].concat(prev));
    setAddingApplication(false);
  }

  async function removeApplication(id) {
    const ok = await requestConfirm(t("removeApplicationConfirm"), { danger: true });
    if (!ok) return;
    await deleteApplication(id);
    setApplications((prev) => prev.filter((a) => a.id !== id));
  }

  async function uploadResume() {
    const file = resumeFileRef.current && resumeFileRef.current.files && resumeFileRef.current.files[0];
    if (!file) return;
    const path = await uploadClientFile(record.id, file);
    await updateRecord({ hasResume: true, resumeStoragePath: path, resumeFileName: file.name });
  }

  async function addNote(fields) {
    if (!masterClient) return;
    const created = await createClientNote(masterClient.id, fields);
    setNotes((prev) => [created].concat(prev));
    setAddingNote(false);
  }
  async function uploadDocument(fields) {
    if (!masterClient) return;
    const path = await uploadClientFile(masterClient.id, fields.file);
    const created = await createClientDocument(masterClient.id, { fileName: fields.fileName, category: fields.category, storagePath: path, program: fields.program });
    setDocuments((prev) => [created].concat(prev));
    setUploadingDocument(false);
  }

  async function deleteDocument(doc) {
    const ok = await requestConfirm(t("deleteDocumentConfirm"), { danger: true });
    if (!ok) return;
    try {
      await deleteClientDocument(doc.id, doc.storagePath);
      setDocuments((prev) => prev.filter((d) => d.id !== doc.id));
    } catch (err) {
      console.warn("deleteDocument failed", err);
      showToast(t("deleteDocumentError"));
    }
  }

  const historyItems = []
    .concat(notes.map((n) => ({ key: "note-" + n.id, icon: StickyNote, date: n.date, text: t("activityNoteAdded") + " — " + (n.staffName || "—"), detail: n.content })))
    .concat(documents.map((d) => ({ key: "doc-" + d.id, icon: FileText, date: d.uploadedAt, text: t("activityDocumentUploaded") + ": " + d.fileName + " — " + (d.uploadedBy || "—") })))
    .concat(applications.map((a) => ({ key: "app-" + a.id, icon: Briefcase, date: a.appliedDate, text: t("activityApplicationSubmitted") + ": " + a.position + " · " + a.company })))
    .filter((i) => i.date)
    .sort((a, b) => b.date.localeCompare(a.date));

  const TAB_COUNTS = {
    applications: applications.length, interviews: interviews.length, services: servicesProvided.length,
    documents: documents.length, notes: notes.length
  };
  const tabItems = TAB_KEYS.map((key) => ({ value: key, label: t(TAB_LABEL[key]), count: TAB_COUNTS[key] || null }));

  const serviceOptions = JOB_SERVICES_PROVIDED.map((s) => ({ value: s.key, label: s.en }));
  const barrierOptions = BARRIERS_TO_EMPLOYMENT.map((b) => ({ value: b.key, label: b.en }));

  const applicationColumns = [
    { key: "company", header: t("companyLabel"), cell: (a) => <span className="font-semibold">{a.company}</span> },
    { key: "position", header: t("positionLabel"), cell: (a) => a.position },
    { key: "applied", header: t("appliedDateLabel"), cell: (a) => <span className="whitespace-nowrap tabular-nums">{fmtDateLong(a.appliedDate)}</span> },
    { key: "status", header: t("statusLabel"), cell: (a) => <StatusBadge domain="application" status={a.status}>{applicationStatusLabel(a.status)}</StatusBadge> },
    { key: "next", header: t("nextStepLabel"), cell: (a) => <span className="whitespace-nowrap tabular-nums">{fmtDateLong(a.nextStepDate)}</span> },
    {
      key: "actions", header: <span className="sr-only">{t("actionsLabel")}</span>, className: "w-12 text-right",
      cell: (a) => <ApplicationRowMenu application={a} onDelete={() => removeApplication(a.id)} />
    }
  ];
  function renderApplicationCard(a) {
    return (
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="break-words text-ui font-semibold text-card-foreground">{a.company}</div>
          <div className="mt-0.5 break-words text-meta text-muted">{a.position}</div>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <StatusBadge domain="application" status={a.status}>{applicationStatusLabel(a.status)}</StatusBadge>
            <span className="text-meta text-muted">{t("appliedDateLabel")}: <span className="tabular-nums">{fmtDateLong(a.appliedDate)}</span></span>
            {a.nextStepDate ? <span className="text-meta text-muted">{t("nextStepLabel")}: <span className="tabular-nums">{fmtDateLong(a.nextStepDate)}</span></span> : null}
          </div>
        </div>
        <ApplicationRowMenu application={a} onDelete={() => removeApplication(a.id)} />
      </div>
    );
  }
  function applicationsTable(rows, stackBelow) {
    return (
      <DataTable
        caption={t("applicationsTabLabel")}
        columns={applicationColumns}
        rows={rows}
        getRowId={(a) => a.id}
        renderCard={renderApplicationCard}
        stackBelow={stackBelow}
      />
    );
  }
  const applicationsEmpty = (
    <EmptyState
      compact icon={Briefcase}
      title={t("noApplicationsYet")}
      description={t("jobApplicationsEmptyHint")}
      action={<Button variant="secondary" onClick={() => setAddingApplication(true)}><Plus className="h-4 w-4" aria-hidden="true" />{t("addApplicationBtn")}</Button>}
    />
  );

  return (
    <>
      <JobClientHeader
        record={record} name={name}
        onBack={() => navigate("/workforce/participants")}
        onAddApplication={() => setAddingApplication(true)}
        onEditPersonal={() => setEditingPersonal(true)}
        onAddNote={() => setAddingNote(true)}
        onUploadDocument={() => setUploadingDocument(true)}
      />

      {/* Summary: where this job seeker is in the pipeline, and how ready. */}
      <Card className="mb-6 flex flex-col gap-5 p-5 sm:p-6 lg:flex-row lg:items-center">
        <div className="min-w-0 flex-1">
          <p className="m-0 mb-3 text-meta font-semibold text-muted">{t("pipelineStageLabel")}</p>
          <JobPipelineTracker stage={record.pipelineStage} onChange={(s) => updateRecord({ pipelineStage: s })} />
        </div>
        <div className="flex shrink-0 flex-col items-center border-t border-line-subtle pt-5 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
          <p className="m-0 mb-2 text-meta font-semibold text-muted">{t("jobReadinessScoreLabel")}</p>
          <CircularGauge value={score} tone={bucket.tone} label={t(bucket.labelKey)} title={t("jobReadinessScoreLabel")} />
        </div>
      </Card>

      <Tabs label={t("jobClientRecordSectionsLabel")} value={tab} onChange={setTab} items={tabItems} idBase={TAB_ID_BASE} className="mb-5" />

      <TabPanel idBase={TAB_ID_BASE} value={tab}>
        {tab === "overview" && (
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <div className="flex min-w-0 flex-col gap-6">
              <SectionCard title={t("employmentDetailsLabel")}>
                {/* Status and work authorization share a row; the resume picker
                    gets a full row so the native "No file chosen" text isn't cut. */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label={t("employmentStatusLabel")} htmlFor="job-employment-status">
                    <Select id="job-employment-status" value={record.employmentStatus} onChange={(e) => updateRecord({ employmentStatus: e.target.value })}>
                      {EMPLOYMENT_STATUSES.map((s) => <option key={s.key} value={s.key}>{s.en}</option>)}
                    </Select>
                  </Field>

                  <div className="flex flex-col gap-4">
                    <Field label={t("workAuthorizationLabel")} htmlFor="job-work-auth">
                      <Select id="job-work-auth" value={record.workAuthorization} onChange={(e) => updateRecord({ workAuthorization: e.target.value })}>
                        <option value="">{t("pleaseSelect")}</option>
                        {WORK_AUTH_STATUSES.map((s) => <option key={s.key} value={s.key}>{s.en}</option>)}
                      </Select>
                    </Field>
                    {record.workAuthorization ? (
                      <Field label={t("expirationDateLabel")} htmlFor="work-auth-expiration">
                        <DatePicker id="work-auth-expiration" value={record.workAuthorizationExpiration} onChange={(v) => updateRecord({ workAuthorizationExpiration: v })} />
                      </Field>
                    ) : null}
                  </div>

                  <Field
                    className="sm:col-span-2"
                    label={t("resumeLabel2")} htmlFor="job-resume-file"
                    hint={record.hasResume && record.resumeStoragePath ? null : t("noResumeUploadedYet")}
                  >
                    {record.hasResume && record.resumeStoragePath ? (
                      <div>
                        <DownloadButton path={record.resumeStoragePath} fileName={record.resumeFileName || "resume"} label={t("viewDownloadBtn")} variant="secondary" />
                      </div>
                    ) : null}
                    <Input id="job-resume-file" ref={resumeFileRef} type="file" accept=".pdf,.doc,.docx" onChange={uploadResume} className={FILE_INPUT} />
                  </Field>
                </div>
              </SectionCard>

              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <SectionCard
                  title={t("personalInformationLabel")}
                  action={
                    <IconButton label={t("editProfileBtn")} onClick={() => setEditingPersonal(true)}>
                      <Pencil aria-hidden="true" />
                    </IconButton>
                  }
                >
                  <dl className="m-0">
                    <FieldRow label={t("dobLabel")} value={fmtDateLong(masterClient && masterClient.dob)} />
                    <FieldRow label={t("phone")} value={formatPhone(record.phone)} />
                    <FieldRow label={t("email")} value={record.email} />
                    <FieldRow label={t("address")} value={formatAddress(record)} />
                    <FieldRow label={t("transportationLabel")} value={record.transportation} />
                    <FieldRow label={t("preferredLanguageLabel")} value={record.preferredLanguage} />
                    <FieldRow label={t("secondaryLanguageLabel")} value={record.secondaryLanguage} />
                  </dl>
                </SectionCard>

                <div className="flex min-w-0 flex-col gap-6">
                  <SectionCard title={t("barriersToEmploymentLabel")}>
                    <FilterChips
                      multiple label={t("barriersToEmploymentLabel")} options={barrierOptions} className={WRAP_CHIPS}
                      value={record.barriers || []} onChange={(next) => updateRecord({ barriers: next })}
                    />
                  </SectionCard>

                  <SectionCard title={t("servicesProvidedLabel")}>
                    <FilterChips
                      multiple label={t("servicesProvidedLabel")} options={serviceOptions} className={WRAP_CHIPS}
                      value={servicesProvided} onChange={(next) => updateRecord({ servicesProvided: next })}
                    />
                  </SectionCard>
                </div>
              </div>

              <SectionCard
                title={t("recentApplicationsLabel")}
                action={<Button size="sm" variant="secondary" onClick={() => setTab("applications")}>{t("viewAllBtn")}</Button>}
                flush={applications.length === 0}
              >
                {applications.length === 0 ? applicationsEmpty : applicationsTable(applications.slice(0, 3), "xl")}
              </SectionCard>
            </div>

            <div className="flex min-w-0 flex-col gap-6">
              <SectionCard title={t("skillsLabel")} action={<Button size="sm" variant="ghost" onClick={() => setTab("services")}>{t("viewAllBtn")}</Button>}>
                {skills.length === 0 ? (
                  <p className="m-0 mb-4 text-meta text-muted">{t("noSkillsYet")}</p>
                ) : (
                  <ul className="m-0 mb-4 flex list-none flex-wrap gap-2 p-0">
                    {skills.map((s) => (
                      <li key={s} className="inline-flex items-center gap-0.5 rounded-chip border border-border bg-surface-sunken py-0.5 pl-3 pr-0.5 text-meta font-semibold text-card-foreground">
                        {s}
                        <IconButton size="sm" label={t("removeSkillLabel") + ": " + s} className="h-7 w-7 rounded-chip" onClick={() => removeSkill(s)}>
                          <X aria-hidden="true" />
                        </IconButton>
                      </li>
                    ))}
                  </ul>
                )}
                <Field label={t("addSkillLabel")} htmlFor="job-add-skill" hint={t("addSkillPlaceholder")}>
                  <Input
                    id="job-add-skill"
                    value={skillInput} onChange={(e) => setSkillInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addSkill(); } }}
                    autoComplete="off"
                  />
                </Field>
              </SectionCard>

              <SectionCard title={t("latestNoteLabel")} action={<Button size="sm" variant="ghost" onClick={() => setTab("notes")}>{t("viewAllBtn")}</Button>}>
                {notes.length === 0 ? <p className="m-0 text-meta text-muted">{t("noNotesYet")}</p> : (
                  <div>
                    <p className="m-0 text-meta text-muted tabular-nums">{fmtDateLong(notes[0].date)}</p>
                    <p className="m-0 mt-1 whitespace-pre-wrap text-body text-card-foreground">{notes[0].content}</p>
                    <p className="m-0 mt-1.5 text-meta font-semibold text-muted">— {notes[0].staffName || "—"}</p>
                  </div>
                )}
              </SectionCard>

              <SectionCard title={t("clientTabDocuments")} action={<Button size="sm" variant="ghost" onClick={() => setTab("documents")}>{t("viewAllBtn")}</Button>} flush={documents.length > 0}>
                {documents.length === 0 ? <p className="m-0 text-meta text-muted">{t("noDocumentsYet")}</p> : (
                  <ul className="m-0 list-none p-0">
                    {documents.slice(0, 3).map((d) => (
                      <li key={d.id} className={ROW + " flex items-center justify-between gap-3 py-3"}>
                        <div className="flex min-w-0 items-center gap-2">
                          <FileText className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
                          <div className="min-w-0">
                            <div className="truncate text-ui font-semibold text-card-foreground">{d.fileName}</div>
                            <div className="text-meta text-muted tabular-nums">{fmtDateLong(d.uploadedAt)}</div>
                          </div>
                        </div>
                        <DownloadButton iconOnly path={d.storagePath} fileName={d.fileName} label={t("downloadLabel") + ": " + d.fileName} />
                      </li>
                    ))}
                  </ul>
                )}
              </SectionCard>
            </div>
          </div>
        )}

        {tab === "applications" && (
          <SectionCard
            title={t("applicationsTabLabel")}
            action={<Button size="sm" variant="secondary" onClick={() => setAddingApplication(true)}><Plus className="h-4 w-4" aria-hidden="true" />{t("addApplicationBtn")}</Button>}
            flush={applications.length === 0}
          >
            {applications.length === 0 ? applicationsEmpty : applicationsTable(applications, "lg")}
          </SectionCard>
        )}

        {tab === "interviews" && (
          <SectionCard title={t("clientTabAppointments")} flush>
            {interviews.length === 0 ? (
              <EmptyState compact icon={CalendarClock} title={t("noInterviewsYet")} description={t("jobInterviewsEmptyHint")} />
            ) : (
              <ul className="m-0 list-none p-0">
                {interviews.map((a) => (
                  <li key={a.id} className={ROW}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="break-words text-ui font-semibold text-card-foreground">{a.company} · {a.position}</span>
                      <span className="text-meta font-semibold text-muted tabular-nums">{fmtDateLong(a.interviewDate)}</span>
                    </div>
                    {a.interviewNotes ? <p className="m-0 mt-1.5 max-w-[75ch] text-body text-muted">{a.interviewNotes}</p> : null}
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        )}

        {tab === "services" && (
          <SectionCard title={t("servicesProvidedLabel")}>
            <FilterChips
              multiple label={t("servicesProvidedLabel")} options={serviceOptions} className={WRAP_CHIPS}
              value={servicesProvided} onChange={(next) => updateRecord({ servicesProvided: next })}
            />
          </SectionCard>
        )}

        {tab === "documents" && (
          <SectionCard
            title={t("clientTabDocuments")}
            action={<Button size="sm" variant="secondary" onClick={() => setUploadingDocument(true)}><UploadCloud className="h-4 w-4" aria-hidden="true" />{t("uploadDocumentBtn")}</Button>}
            flush
          >
            {documents.length === 0 ? (
              <EmptyState compact icon={FileText} title={t("noDocumentsYet")} description={t("clientDocumentsEmptyHint")} />
            ) : (
              <ul className="m-0 list-none p-0">
                {documents.map((d) => (
                  <li key={d.id} className={ROW + " flex flex-wrap items-center justify-between gap-3"}>
                    <div className="flex min-w-0 items-start gap-3">
                      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-chip bg-tone-info-bg text-tone-info-ink">
                        <Paperclip className="h-4 w-4" aria-hidden="true" />
                      </span>
                      <div className="min-w-0">
                        <div className="break-words text-ui font-semibold text-card-foreground">{d.fileName}</div>
                        <div className="mt-0.5 text-meta text-muted">
                          {t("uploadedByLabel")}: {d.uploadedBy || "—"} · <span className="tabular-nums">{fmtDateLong(d.uploadedAt)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <DownloadButton path={d.storagePath} fileName={d.fileName} label={t("downloadLabel")} />
                      <IconButton label={t("deleteLabel") + ": " + d.fileName} variant="danger" onClick={() => deleteDocument(d)}>
                        <Trash2 aria-hidden="true" />
                      </IconButton>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        )}

        {tab === "notes" && (
          <SectionCard
            title={t("clientTabNotes")}
            action={<Button size="sm" variant="secondary" onClick={() => setAddingNote(true)}><MessageSquarePlus className="h-4 w-4" aria-hidden="true" />{t("addNoteBtn")}</Button>}
            flush
          >
            {notes.length === 0 ? (
              <EmptyState compact icon={StickyNote} title={t("noNotesYet")} description={t("clientNotesEmptyHint")} />
            ) : (
              <ul className="m-0 list-none p-0">
                {notes.map((n) => (
                  <li key={n.id} className={ROW}>
                    <span className="text-ui font-semibold text-card-foreground">
                      {n.staffName || "—"} · <span className="tabular-nums">{fmtDateLong(n.date)}</span>
                    </span>
                    <p className="m-0 mt-2 max-w-[75ch] whitespace-pre-wrap text-body text-card-foreground">{n.content}</p>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        )}

        {tab === "history" && (
          <SectionCard title={t("clientTabActivity")} flush>
            {historyItems.length === 0 ? (
              <EmptyState compact icon={CalendarClock} title={t("historyEmptyMessage")} description={t("clientActivityEmptyHint")} />
            ) : (
              <ol className="m-0 list-none p-0">
                {historyItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <li key={item.key} className={ROW + " flex items-start gap-3 py-3"}>
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-chip bg-tone-info-bg text-tone-info-ink">
                        <Icon className="h-4 w-4" aria-hidden="true" />
                      </span>
                      <div className="min-w-0 flex-1 pt-1">
                        <div className="break-words text-ui font-medium text-card-foreground">{item.text}</div>
                        {item.detail ? <p className="m-0 mt-0.5 line-clamp-2 break-words text-meta text-muted">“{item.detail}”</p> : null}
                      </div>
                      <span className="shrink-0 pt-1.5 text-meta text-muted tabular-nums">{fmtDateLong(item.date)}</span>
                    </li>
                  );
                })}
              </ol>
            )}
          </SectionCard>
        )}
      </TabPanel>

      {editingPersonal && <PersonalInfoModal record={record} onSave={async (fields) => { await updateRecord(fields); setEditingPersonal(false); }} onCancel={() => setEditingPersonal(false)} />}
      {addingApplication && <AddApplicationModal onSave={addApplication} onCancel={() => setAddingApplication(false)} />}
      {addingNote && <AddNoteModal onSave={addNote} onCancel={() => setAddingNote(false)} />}
      {uploadingDocument && <UploadDocumentModal onSave={uploadDocument} onCancel={() => setUploadingDocument(false)} />}
    </>
  );
}
