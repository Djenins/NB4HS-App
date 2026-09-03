// JobClientProfile.jsx -- rich Job Developer client detail page (mockup
// parity). Route: /jobdeveloper/:clientId, where clientId is the raw
// jobClients[].id (this page is fundamentally about one program record's
// detail). Notes/Documents reuse the unified client_notes/client_documents
// tables (masterClients.js, resolved via the record's nbId), but notes are
// scoped to department "job" so they stay separate from Case Manager's
// department "case" notes on the same client -- see fetchClientNotes().
import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft, Briefcase, Download, FileText, MessageSquarePlus, MoreHorizontal, Paperclip, Pencil, Plus, Trash2, UploadCloud, X
} from "lucide-react";
import { useApp, useT } from "../context/AppContext.jsx";
import {
  APPLICATION_STATUSES, applicationStatusLabel, BARRIERS_TO_EMPLOYMENT, barrierLabel,
  computeJobReadinessScore, EMPLOYMENT_STATUSES, employmentStatusLabel, JOB_SERVICES_PROVIDED, jobServiceLabel,
  readinessBucket, WORK_AUTH_STATUSES, workAuthLabel
} from "../lib/jobProfile.js";
import { findClientByNbId } from "../lib/masterClients.js";
import {
  createApplication, createClientDocument, createClientNote, deleteApplication, deleteClientDocument,
  fetchApplications, fetchClientDocuments, fetchClientNotes, getFileSignedUrl, updateJobClient, uploadClientFile
} from "../lib/clientsData.js";
import { formatAddress, formatPhone, fmtDateLong, initialsOf } from "../lib/utils.js";
import CircularGauge from "../components/CircularGauge.jsx";
import DatePicker from "../components/DatePicker.jsx";
import JobPipelineTracker from "../components/JobPipelineTracker.jsx";
import NbIdBadge from "../components/NbIdBadge.jsx";
import { avatarColorFor } from "../components/StudentCard.jsx";
import { Avatar, AvatarFallback } from "../components/ui/avatar.jsx";
import { Badge } from "../components/ui/badge.jsx";
import { Button } from "../components/ui/button.jsx";
import { Card, CardContent } from "../components/ui/card.jsx";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../components/ui/dropdown-menu.jsx";

const TAB_KEYS = ["overview", "applications", "interviews", "services", "documents", "notes", "history"];
const TAB_LABEL = {
  overview: "clientTabOverview", applications: "recentApplicationsLabel", interviews: "clientTabAppointments",
  services: "servicesProvidedLabel", documents: "clientTabDocuments", notes: "clientTabNotes", history: "clientTabActivity"
};

function SectionCard({ title, action, children }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="m-0 text-sm font-bold text-card-foreground">{title}</h3>
          {action}
        </div>
        {children}
      </CardContent>
    </Card>
  );
}

function FieldRow({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border py-2 text-sm last:border-b-0">
      <span className="text-muted">{label}</span>
      <span className="font-semibold text-card-foreground">{value || "—"}</span>
    </div>
  );
}

function Chip({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "rounded-full border px-3 py-1 text-xs font-semibold transition-colors " +
        (active ? "border-primary bg-primary-tint text-primary" : "border-border bg-background text-muted hover:border-[#b7c0d1]")
      }
    >
      {children}
    </button>
  );
}

// Documents/resumes now live in Supabase Storage (private bucket), not as
// inline base64 -- this resolves a short-lived signed URL on click instead
// of an <a href> pointing straight at a data URI.
function StorageDownloadLink({ path, fileName, children, className }) {
  const [loading, setLoading] = useState(false);
  async function handleClick(e) {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    const url = await getFileSignedUrl(path);
    setLoading(false);
    if (url) {
      const a = document.createElement("a");
      a.href = url; a.download = fileName || "";
      document.body.appendChild(a); a.click(); a.remove();
    }
  }
  return (
    <a href="#" onClick={handleClick} className={className}>
      {children}
    </a>
  );
}

function ApplicationRowMenu({ onDelete }) {
  const t = useT();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="icon" variant="ghost" className="h-8 w-8" aria-label={t("actionsLabel")}>
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={onDelete} className="text-accent focus:bg-tint-danger">
          <Trash2 className="h-3.5 w-3.5" /> {t("deleteLabel")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function PersonalInfoModal({ record, onSave, onCancel }) {
  const t = useT();
  const [fields, setFields] = useState({
    phone: record.phone || "", email: record.email || "", street: record.street || "", city: record.city || "", zip: record.zip || "",
    transportation: record.transportation || "", preferredLanguage: record.preferredLanguage || "", secondaryLanguage: record.secondaryLanguage || ""
  });
  function setField(name, value) { setFields((prev) => Object.assign({}, prev, { [name]: value })); }
  const inputClass = "h-11 min-h-0 w-full rounded-lg border border-border bg-background px-3 text-sm text-card-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15";

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="modal-box max-w-xl" role="dialog" aria-modal="true">
        <p className="mb-4 text-base font-bold text-card-foreground">{t("personalInformationLabel")}</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div><label className="mb-1 block text-xs font-semibold text-card-foreground">{t("phone")}</label><input className={inputClass} value={fields.phone} onChange={(e) => setField("phone", e.target.value)} placeholder={t("phPhone")} /></div>
          <div><label className="mb-1 block text-xs font-semibold text-card-foreground">{t("email")}</label><input className={inputClass} value={fields.email} onChange={(e) => setField("email", e.target.value)} placeholder={t("phEmail")} /></div>
          <div><label className="mb-1 block text-xs font-semibold text-card-foreground">{t("address")}</label><input className={inputClass} value={fields.street} onChange={(e) => setField("street", e.target.value)} placeholder={t("phAddress")} /></div>
          <div><label className="mb-1 block text-xs font-semibold text-card-foreground">{t("city")}</label><input className={inputClass} value={fields.city} onChange={(e) => setField("city", e.target.value)} placeholder={t("phCity")} /></div>
          <div><label className="mb-1 block text-xs font-semibold text-card-foreground">{t("zip")}</label><input className={inputClass} value={fields.zip} onChange={(e) => setField("zip", e.target.value)} placeholder={t("phZip")} /></div>
          <div><label className="mb-1 block text-xs font-semibold text-card-foreground">Transportation</label><input className={inputClass} value={fields.transportation} onChange={(e) => setField("transportation", e.target.value)} placeholder={t("phTransportation")} /></div>
          <div><label className="mb-1 block text-xs font-semibold text-card-foreground">Preferred Language</label><input className={inputClass} value={fields.preferredLanguage} onChange={(e) => setField("preferredLanguage", e.target.value)} placeholder={t("phPreferredLanguage")} /></div>
          <div><label className="mb-1 block text-xs font-semibold text-card-foreground">Secondary Language</label><input className={inputClass} value={fields.secondaryLanguage} onChange={(e) => setField("secondaryLanguage", e.target.value)} placeholder={t("phSecondaryLanguage")} /></div>
        </div>
        <div className="pill-row" style={{ justifyContent: "flex-end", marginTop: 16, marginBottom: 0 }}>
          <button type="button" className="btn-secondary" onClick={onCancel}>{t("cancelLabel")}</button>
          <Button onClick={() => onSave(fields)}>{t("saveLabel")}</Button>
        </div>
      </div>
    </div>
  );
}

function AddApplicationModal({ onSave, onCancel }) {
  const t = useT();
  const [fields, setFields] = useState({ company: "", position: "", appliedDate: "", status: "applied", nextStepDate: "", nextStepNote: "", interviewDate: "", interviewNotes: "" });
  function setField(name, value) { setFields((prev) => Object.assign({}, prev, { [name]: value })); }
  const inputClass = "h-11 min-h-0 w-full rounded-lg border border-border bg-background px-3 text-sm text-card-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15";

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="modal-box max-w-xl" role="dialog" aria-modal="true">
        <p className="mb-4 text-base font-bold text-card-foreground">{t("addApplicationBtn")}</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div><label className="mb-1 block text-xs font-semibold text-card-foreground">{t("companyLabel")} *</label><input className={inputClass} value={fields.company} onChange={(e) => setField("company", e.target.value)} placeholder={t("phCompany")} /></div>
          <div><label className="mb-1 block text-xs font-semibold text-card-foreground">{t("positionLabel")} *</label><input className={inputClass} value={fields.position} onChange={(e) => setField("position", e.target.value)} placeholder={t("phPositionTitle")} /></div>
          <div><label className="mb-1 block text-xs font-semibold text-card-foreground">{t("appliedDateLabel")}</label><DatePicker id="app-applied-date" value={fields.appliedDate} onChange={(v) => setField("appliedDate", v)} /></div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-card-foreground">{t("statusLabel")}</label>
            <select className={inputClass} value={fields.status} onChange={(e) => setField("status", e.target.value)}>
              {APPLICATION_STATUSES.map((s) => <option key={s.key} value={s.key}>{s.en}</option>)}
            </select>
          </div>
          <div><label className="mb-1 block text-xs font-semibold text-card-foreground">{t("nextStepLabel")}</label><DatePicker id="app-next-step-date" value={fields.nextStepDate} onChange={(v) => setField("nextStepDate", v)} /></div>
          <div><label className="mb-1 block text-xs font-semibold text-card-foreground">{t("interviewDateLabel")}</label><DatePicker id="app-interview-date" value={fields.interviewDate} onChange={(v) => setField("interviewDate", v)} /></div>
        </div>
        <div className="mt-3">
          <label className="mb-1 block text-xs font-semibold text-card-foreground">{t("noteContentLabel")}</label>
          <input className={inputClass} value={fields.nextStepNote} onChange={(e) => setField("nextStepNote", e.target.value)} placeholder={t("nextStepLabel")} />
        </div>
        {fields.interviewDate && (
          <div className="mt-3">
            <label className="mb-1 block text-xs font-semibold text-card-foreground">{t("interviewNotesLabel")}</label>
            <input className={inputClass} value={fields.interviewNotes} onChange={(e) => setField("interviewNotes", e.target.value)} placeholder={t("phInterviewNotes")} />
          </div>
        )}
        <div className="pill-row" style={{ justifyContent: "flex-end", marginTop: 16, marginBottom: 0 }}>
          <button type="button" className="btn-secondary" onClick={onCancel}>{t("cancelLabel")}</button>
          <Button disabled={!fields.company.trim() || !fields.position.trim()} onClick={() => onSave(fields)}>{t("saveLabel")}</Button>
        </div>
      </div>
    </div>
  );
}

function AddNoteModal({ onSave, onCancel }) {
  const t = useT();
  const [content, setContent] = useState("");
  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="modal-box max-w-lg" role="dialog" aria-modal="true">
        <p className="mb-4 text-base font-bold text-card-foreground">{t("addNoteBtn")}</p>
        <textarea
          value={content} onChange={(e) => setContent(e.target.value)} rows={4} placeholder={t("phNoteContent")}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-card-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
        />
        <div className="pill-row" style={{ justifyContent: "flex-end", marginTop: 12, marginBottom: 0 }}>
          <button type="button" className="btn-secondary" onClick={onCancel}>{t("cancelLabel")}</button>
          <Button disabled={!content.trim()} onClick={() => onSave({ content, type: "general", visibility: "all", department: "job" })}>{t("saveLabel")}</Button>
        </div>
      </div>
    </div>
  );
}

function UploadDocumentModal({ onSave, onCancel }) {
  const t = useT();
  const [fileName, setFileName] = useState("");
  const fileRef = useRef(null);
  function submit() {
    const file = fileRef.current && fileRef.current.files && fileRef.current.files[0];
    if (!file) return;
    onSave({ category: "other", fileName: file.name, file, program: "job" });
  }
  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="modal-box max-w-lg" role="dialog" aria-modal="true">
        <p className="mb-4 text-base font-bold text-card-foreground">{t("uploadDocumentBtn")}</p>
        <input
          ref={fileRef} type="file" onChange={(e) => setFileName(e.target.files && e.target.files[0] ? e.target.files[0].name : "")}
          className="block w-full text-sm text-card-foreground file:mr-3 file:rounded-lg file:border-0 file:bg-primary-tint file:px-3 file:py-2 file:text-sm file:font-semibold file:text-primary"
        />
        <div className="pill-row" style={{ justifyContent: "flex-end", marginTop: 12, marginBottom: 0 }}>
          <button type="button" className="btn-secondary" onClick={onCancel}>{t("cancelLabel")}</button>
          <Button disabled={!fileName} onClick={submit}>{t("saveLabel")}</Button>
        </div>
      </div>
    </div>
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
    return <Card><CardContent className="p-10 text-center text-sm text-muted">{t("jobClientNotFoundMessage")}</CardContent></Card>;
  }

  const name = (record.firstName + " " + record.lastName).trim();
  const interviews = applications.filter((a) => a.interviewDate);
  const score = computeJobReadinessScore(record);
  const bucket = readinessBucket(score);

  async function updateRecord(patch) {
    await updateJobClient(clientId, patch);
  }

  async function toggleChip(field, key) {
    const cur = record[field] || [];
    const next = cur.indexOf(key) !== -1 ? cur.filter((k) => k !== key) : cur.concat([key]);
    await updateRecord({ [field]: next });
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
    .concat(notes.map((n) => ({ date: n.date, text: (n.staffName || "—") + " added a note: “" + n.content + "”" })))
    .concat(documents.map((d) => ({ date: d.uploadedAt, text: (d.uploadedBy || "—") + " uploaded " + d.fileName })))
    .concat(applications.map((a) => ({ date: a.appliedDate, text: "Applied to " + a.position + " at " + a.company })))
    .filter((i) => i.date)
    .sort((a, b) => b.date.localeCompare(a.date));

  return (
    <>
      <Button variant="ghost" size="sm" className="mb-3 gap-1.5" onClick={() => navigate("/jobdeveloper")}>
        <ArrowLeft className="h-3.5 w-3.5" /> {t("navJobDeveloper")}
      </Button>

      <Card>
        <CardContent className="flex flex-col gap-4 p-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-4">
            <Avatar className="h-14 w-14 shrink-0">
              <AvatarFallback className={avatarColorFor(name) + " text-lg"}>{initialsOf(record)}</AvatarFallback>
            </Avatar>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="m-0 text-xl">{name}</h1>
                {record.nbId && <NbIdBadge nbId={record.nbId} />}
                <Badge variant="success">{t("statusActive")}</Badge>
              </div>
              <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
                <span>{formatPhone(record.phone) || "—"}</span>
                <span>{formatAddress(record) || "—"}</span>
                <span>{t("intakeDateLabel")}: {fmtDateLong(record.intakeDate)}</span>
              </div>
              <div className="mt-3"><JobPipelineTracker stage={record.pipelineStage} onChange={(s) => updateRecord({ pipelineStage: s })} /></div>
            </div>
          </div>
          <div className="flex flex-col items-center">
            <span className="mb-1 text-xs font-semibold text-muted">{t("jobReadinessScoreLabel")}</span>
            <CircularGauge value={score} tone={bucket.tone} label={t(bucket.labelKey)} />
          </div>
        </CardContent>
      </Card>

      <Card className="mt-5">
        <div className="flex flex-wrap gap-1 overflow-x-auto border-b border-border px-3 pt-2">
          {TAB_KEYS.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={
                "shrink-0 rounded-t-lg px-3 py-2 text-sm font-semibold transition-colors " +
                (tab === key ? "border-b-2 border-primary text-primary" : "text-muted hover:text-card-foreground")
              }
            >
              {t(TAB_LABEL[key])}
            </button>
          ))}
        </div>
        <CardContent className="p-5">
          {tab === "overview" && (
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-[72fr_28fr]">
              <div className="space-y-6">
                <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                  <SectionCard title={t("employmentStatusLabel")}>
                    <select
                      className="h-11 min-h-0 w-full rounded-lg border border-border bg-background px-3 text-sm text-card-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
                      value={record.employmentStatus} onChange={(e) => updateRecord({ employmentStatus: e.target.value })}
                    >
                      {EMPLOYMENT_STATUSES.map((s) => <option key={s.key} value={s.key}>{s.en}</option>)}
                    </select>
                  </SectionCard>

                  <SectionCard title={t("workAuthorizationLabel")}>
                    <select
                      className="h-11 min-h-0 w-full rounded-lg border border-border bg-background px-3 text-sm text-card-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
                      value={record.workAuthorization} onChange={(e) => updateRecord({ workAuthorization: e.target.value })}
                    >
                      <option value="">{t("pleaseSelect")}</option>
                      {WORK_AUTH_STATUSES.map((s) => <option key={s.key} value={s.key}>{s.en}</option>)}
                    </select>
                    {record.workAuthorization && (
                      <div className="mt-2">
                        <label className="mb-1 block text-xs font-semibold text-card-foreground">{t("expirationDateLabel")}</label>
                        <DatePicker id="work-auth-expiration" value={record.workAuthorizationExpiration} onChange={(v) => updateRecord({ workAuthorizationExpiration: v })} />
                      </div>
                    )}
                  </SectionCard>

                  <SectionCard title={t("resumeLabel2")}>
                    {record.hasResume && record.resumeStoragePath ? (
                      <StorageDownloadLink path={record.resumeStoragePath} fileName={record.resumeFileName || "resume"} className="flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline">
                        <Download className="h-4 w-4" /> {t("viewDownloadBtn")}
                      </StorageDownloadLink>
                    ) : (
                      <p className="text-sm text-muted">{t("noResumeUploadedYet")}</p>
                    )}
                    <input ref={resumeFileRef} type="file" accept=".pdf,.doc,.docx" onChange={uploadResume} className="mt-2 block w-full text-sm text-card-foreground file:mr-3 file:rounded-lg file:border-0 file:bg-primary-tint file:px-3 file:py-2 file:text-sm file:font-semibold file:text-primary" />
                  </SectionCard>
                </div>

                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  <SectionCard title={t("personalInformationLabel")} action={
                    <Button size="icon" variant="ghost" onClick={() => setEditingPersonal(true)} aria-label={t("editProfileBtn")}><Pencil className="h-3.5 w-3.5" /></Button>
                  }>
                    <FieldRow label={t("dobLabel")} value={fmtDateLong(masterClient && masterClient.dob)} />
                    <FieldRow label={t("phone")} value={formatPhone(record.phone)} />
                    <FieldRow label={t("email")} value={record.email} />
                    <FieldRow label={t("address")} value={formatAddress(record)} />
                    <FieldRow label="Transportation" value={record.transportation} />
                    <FieldRow label="Preferred Language" value={record.preferredLanguage} />
                    <FieldRow label="Secondary Language" value={record.secondaryLanguage} />
                  </SectionCard>

                  <div className="space-y-4">
                    <SectionCard title={t("barriersToEmploymentLabel")}>
                      <div className="flex flex-wrap gap-2">
                        {BARRIERS_TO_EMPLOYMENT.map((b) => (
                          <Chip key={b.key} active={(record.barriers || []).indexOf(b.key) !== -1} onClick={() => toggleChip("barriers", b.key)}>{b.en}</Chip>
                        ))}
                      </div>
                    </SectionCard>

                    <SectionCard title={t("servicesProvidedLabel")}>
                      <div className="flex flex-wrap gap-2">
                        {JOB_SERVICES_PROVIDED.map((s) => (
                          <Chip key={s.key} active={(record.servicesProvided || []).indexOf(s.key) !== -1} onClick={() => toggleChip("servicesProvided", s.key)}>{s.en}</Chip>
                        ))}
                      </div>
                    </SectionCard>
                  </div>
                </div>

                <SectionCard title={t("recentApplicationsLabel")} action={<Button size="sm" variant="secondary" onClick={() => setTab("applications")}>{t("viewAllBtn")}</Button>}>
                  {applications.length === 0 ? <p className="text-sm text-muted">{t("noApplicationsYet")}</p> : (
                    <div className="overflow-auto rounded-xl border border-border">
                      <table className="w-full border-collapse text-sm">
                        <thead><tr>
                          <th className="bg-card px-3 py-2 text-left text-xs font-semibold text-muted">{t("companyLabel")}</th>
                          <th className="bg-card px-3 py-2 text-left text-xs font-semibold text-muted">{t("positionLabel")}</th>
                          <th className="bg-card px-3 py-2 text-left text-xs font-semibold text-muted">{t("appliedDateLabel")}</th>
                          <th className="bg-card px-3 py-2 text-left text-xs font-semibold text-muted">{t("statusLabel")}</th>
                          <th className="bg-card px-3 py-2 text-left text-xs font-semibold text-muted">{t("nextStepLabel")}</th>
                          <th className="bg-card px-3 py-2"><span className="sr-only">{t("actionsLabel")}</span></th>
                        </tr></thead>
                        <tbody className="divide-y divide-border">
                          {applications.slice(0, 3).map((a) => (
                            <tr key={a.id} className="hover:bg-tint-neutral">
                              <td className="px-3 py-2 font-semibold text-card-foreground">{a.company}</td>
                              <td className="px-3 py-2 text-card-foreground">{a.position}</td>
                              <td className="px-3 py-2 text-card-foreground">{fmtDateLong(a.appliedDate)}</td>
                              <td className="px-3 py-2"><Badge variant="neutral">{applicationStatusLabel(a.status)}</Badge></td>
                              <td className="px-3 py-2 text-card-foreground">{fmtDateLong(a.nextStepDate)}</td>
                              <td className="px-3 py-2 text-right"><ApplicationRowMenu onDelete={() => removeApplication(a.id)} /></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </SectionCard>
              </div>

              <div className="space-y-6">
                <SectionCard title={t("skillsLabel")} action={<Button size="sm" variant="ghost" onClick={() => setTab("services")}>{t("viewAllBtn")}</Button>}>
                  <div className="mb-2 flex flex-wrap gap-2">
                    {(record.skills || []).length === 0 && <p className="text-sm text-muted">{t("noSkillsYet")}</p>}
                    {(record.skills || []).map((s) => (
                      <span key={s} className="flex items-center gap-1 rounded-full bg-tint-neutral px-3 py-1 text-xs font-semibold text-card-foreground">
                        {s}
                        <button type="button" onClick={() => removeSkill(s)} className="border-0 bg-transparent p-0 text-muted hover:text-accent"><X className="h-3 w-3" /></button>
                      </span>
                    ))}
                  </div>
                  <input
                    value={skillInput} onChange={(e) => setSkillInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addSkill(); } }}
                    placeholder={t("addSkillPlaceholder")}
                    className="h-10 min-h-0 w-full rounded-lg border border-border bg-background px-3 text-sm text-card-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
                  />
                </SectionCard>

                <SectionCard title={t("latestNoteLabel")} action={<Button size="sm" variant="ghost" onClick={() => setTab("notes")}>{t("viewAllBtn")}</Button>}>
                  {notes.length === 0 ? <p className="text-sm text-muted">{t("noNotesYet")}</p> : (
                    <div>
                      <p className="text-xs text-muted">{fmtDateLong(notes[0].date)}</p>
                      <p className="mt-1 text-sm text-card-foreground">{notes[0].content}</p>
                      <p className="mt-1.5 text-xs font-semibold text-muted">— {notes[0].staffName || "—"}</p>
                    </div>
                  )}
                </SectionCard>

                <SectionCard title={t("clientTabDocuments")} action={<Button size="sm" variant="ghost" onClick={() => setTab("documents")}>{t("viewAllBtn")}</Button>}>
                  {documents.length === 0 ? <p className="text-sm text-muted">{t("noDocumentsYet")}</p> : (
                    <div className="space-y-2">
                      {documents.slice(0, 3).map((d) => (
                        <div key={d.id} className="flex items-center justify-between gap-2 text-sm">
                          <div className="flex min-w-0 items-center gap-2">
                            <FileText className="h-4 w-4 shrink-0 text-accent" />
                            <div className="min-w-0">
                              <div className="truncate font-semibold text-card-foreground">{d.fileName}</div>
                              <div className="text-xs text-muted">{fmtDateLong(d.uploadedAt)}</div>
                            </div>
                          </div>
                          <StorageDownloadLink path={d.storagePath} fileName={d.fileName} className="shrink-0 text-muted hover:text-primary">
                            <Download className="h-4 w-4" />
                          </StorageDownloadLink>
                        </div>
                      ))}
                    </div>
                  )}
                </SectionCard>
              </div>
            </div>
          )}

          {tab === "applications" && (
            <div>
              <div className="mb-3 flex justify-end"><Button size="sm" className="gap-1.5" onClick={() => setAddingApplication(true)}><Plus className="h-3.5 w-3.5" /> {t("addApplicationBtn")}</Button></div>
              {applications.length === 0 ? <p className="py-8 text-center text-sm text-muted">{t("noApplicationsYet")}</p> : (
                <div className="overflow-auto rounded-xl border border-border">
                  <table className="w-full border-collapse text-sm">
                    <thead><tr>
                      <th className="bg-card px-3 py-2 text-left text-xs font-semibold text-muted">{t("companyLabel")}</th>
                      <th className="bg-card px-3 py-2 text-left text-xs font-semibold text-muted">{t("positionLabel")}</th>
                      <th className="bg-card px-3 py-2 text-left text-xs font-semibold text-muted">{t("appliedDateLabel")}</th>
                      <th className="bg-card px-3 py-2 text-left text-xs font-semibold text-muted">{t("statusLabel")}</th>
                      <th className="bg-card px-3 py-2 text-left text-xs font-semibold text-muted">{t("nextStepLabel")}</th>
                      <th className="bg-card px-3 py-2"><span className="sr-only">{t("actionsLabel")}</span></th>
                    </tr></thead>
                    <tbody className="divide-y divide-border">
                      {applications.map((a) => (
                        <tr key={a.id} className="hover:bg-tint-neutral">
                          <td className="px-3 py-2 font-semibold text-card-foreground">{a.company}</td>
                          <td className="px-3 py-2 text-card-foreground">{a.position}</td>
                          <td className="px-3 py-2 text-card-foreground">{fmtDateLong(a.appliedDate)}</td>
                          <td className="px-3 py-2"><Badge variant="neutral">{applicationStatusLabel(a.status)}</Badge></td>
                          <td className="px-3 py-2 text-card-foreground">{fmtDateLong(a.nextStepDate)}</td>
                          <td className="px-3 py-2 text-right"><ApplicationRowMenu onDelete={() => removeApplication(a.id)} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {tab === "interviews" && (
            interviews.length === 0 ? <p className="py-8 text-center text-sm text-muted">{t("noInterviewsYet")}</p> : (
              <div className="space-y-2">
                {interviews.map((a) => (
                  <Card key={a.id}><CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-card-foreground">{a.company} · {a.position}</span>
                      <Badge>{fmtDateLong(a.interviewDate)}</Badge>
                    </div>
                    {a.interviewNotes && <p className="mt-1.5 text-sm text-muted">{a.interviewNotes}</p>}
                  </CardContent></Card>
                ))}
              </div>
            )
          )}

          {tab === "services" && (
            <div className="flex flex-wrap gap-2">
              {JOB_SERVICES_PROVIDED.map((s) => (
                <Chip key={s.key} active={(record.servicesProvided || []).indexOf(s.key) !== -1} onClick={() => toggleChip("servicesProvided", s.key)}>{s.en}</Chip>
              ))}
            </div>
          )}

          {tab === "documents" && (
            <div>
              <div className="mb-3 flex justify-end"><Button size="sm" className="gap-1.5" onClick={() => setUploadingDocument(true)}><UploadCloud className="h-3.5 w-3.5" /> {t("uploadDocumentBtn")}</Button></div>
              {documents.length === 0 ? <p className="py-8 text-center text-sm text-muted">{t("noDocumentsYet")}</p> : (
                <div className="space-y-2">
                  {documents.map((d) => (
                    <Card key={d.id}><CardContent className="flex flex-wrap items-center justify-between gap-2 p-4">
                      <div className="flex items-center gap-2">
                        <Paperclip className="h-4 w-4 text-primary" />
                        <div>
                          <div className="text-sm font-bold text-card-foreground">{d.fileName}</div>
                          <div className="text-xs text-muted">{t("uploadedByLabel")}: {d.uploadedBy || "—"} · {fmtDateLong(d.uploadedAt)}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <StorageDownloadLink path={d.storagePath} fileName={d.fileName} className="flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
                          <Download className="h-3.5 w-3.5" /> {t("downloadLabel")}
                        </StorageDownloadLink>
                        <button
                          type="button"
                          title={t("deleteLabel")}
                          onClick={() => deleteDocument(d)}
                          className="flex h-8 w-8 min-h-0 items-center justify-center rounded-lg border-0 bg-transparent p-0 text-muted hover:bg-background hover:text-accent"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </CardContent></Card>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === "notes" && (
            <div>
              <div className="mb-3 flex justify-end"><Button size="sm" className="gap-1.5" onClick={() => setAddingNote(true)}><MessageSquarePlus className="h-3.5 w-3.5" /> {t("addNoteBtn")}</Button></div>
              {notes.length === 0 ? <p className="py-8 text-center text-sm text-muted">{t("noNotesYet")}</p> : (
                <div className="space-y-2">
                  {notes.map((n) => (
                    <Card key={n.id}><CardContent className="p-4">
                      <span className="text-sm font-bold text-card-foreground">{n.staffName || "—"} · {fmtDateLong(n.date)}</span>
                      <p className="mt-1.5 text-sm text-card-foreground">{n.content}</p>
                    </CardContent></Card>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === "history" && (
            historyItems.length === 0 ? <p className="py-8 text-center text-sm text-muted">{t("historyEmptyMessage")}</p> : (
              <div className="space-y-2">
                {historyItems.map((item, i) => (
                  <div key={i} className="flex items-center gap-3 border-b border-border py-2 text-sm last:border-b-0">
                    <Briefcase className="h-3.5 w-3.5 shrink-0 text-primary" />
                    <span className="text-card-foreground">{item.text}</span>
                    <span className="ml-auto shrink-0 text-xs text-muted">{fmtDateLong(item.date)}</span>
                  </div>
                ))}
              </div>
            )
          )}
        </CardContent>
      </Card>

      {editingPersonal && <PersonalInfoModal record={record} onSave={async (fields) => { await updateRecord(fields); setEditingPersonal(false); }} onCancel={() => setEditingPersonal(false)} />}
      {addingApplication && <AddApplicationModal onSave={addApplication} onCancel={() => setAddingApplication(false)} />}
      {addingNote && <AddNoteModal onSave={addNote} onCancel={() => setAddingNote(false)} />}
      {uploadingDocument && <UploadDocumentModal onSave={uploadDocument} onCancel={() => setUploadingDocument(false)} />}
    </>
  );
}
