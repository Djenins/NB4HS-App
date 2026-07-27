// EmployerProfile.jsx -- CRM-style Employer Profile page. Phase 1 (Employer
// info/notes/activity/documents) mirrors JobClientProfile.jsx's structure
// (header card + tab strip + SectionCard/FieldRow/modal idioms) almost
// verbatim. Phase 2 lights up the Job Openings tab with real data (and the
// Total Positions/Active Openings metrics) now that job_openings exists;
// Candidates/Placements stay honest "not available yet" placeholders since
// those data models still don't exist.
import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft, Download, FileText, MessageSquarePlus, Paperclip, Pencil, Plus, Trash2, UploadCloud
} from "lucide-react";
import { useApp, useT } from "../context/AppContext.jsx";
import { activeJobDevelopers } from "../lib/appointments.js";
import {
  ACTIVITY_TYPES, activityTypeLabel, businessInitials, EMPLOYER_PARTNERSHIP_STAGES,
  partnershipStageBadgeVariant, partnershipStageLabel, PREFERRED_COMMUNICATION_METHODS, PREFERRED_HIRING_METHODS,
  preferredCommunicationLabel, preferredHiringMethodLabel
} from "../lib/employerProfile.js";
import {
  createEmployerActivity, createEmployerDocument, createEmployerNote, createJobOpening, deleteEmployerDocument,
  fetchEmployerActivity, fetchEmployerDocuments, fetchEmployerNotes, getFileSignedUrl, updateEmployer, uploadClientFile
} from "../lib/clientsData.js";
import { employmentTypeLabel, formatPayRange, jobOpeningSortKey, statusBadgeVariant, statusLabel } from "../lib/jobOpenings.js";
import { hasReachedInterview, stageBadgeVariant as referralStageBadgeVariant, stageLabel as referralStageLabel } from "../lib/referrals.js";
import { computeRetentionRate, placementStatusBadgeVariant, placementStatusLabel } from "../lib/placements.js";
import { activeIndustryList, formatAddress, formatPhone, fmtDateLong } from "../lib/utils.js";
import { avatarColorFor } from "../components/StudentCard.jsx";
import { Avatar, AvatarFallback } from "../components/ui/avatar.jsx";
import { Badge } from "../components/ui/badge.jsx";
import { Button } from "../components/ui/button.jsx";
import { Card, CardContent } from "../components/ui/card.jsx";
import DatePicker from "../components/DatePicker.jsx";
import EmployerPipelineTracker from "../components/EmployerPipelineTracker.jsx";
import JobOpeningDetailModal from "../components/JobOpeningDetailModal.jsx";
import JobOpeningWizard from "../components/JobOpeningWizard.jsx";

const TAB_KEYS = ["overview", "jobOpenings", "candidates", "placements", "documents", "activity", "notes"];
const TAB_LABEL = {
  overview: "clientTabOverview", jobOpenings: "employerTabJobOpenings", candidates: "employerTabCandidates",
  placements: "employerTabPlacements", documents: "clientTabDocuments", activity: "employerTabActivity", notes: "clientTabNotes"
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

function MetricTile({ label, value }) {
  return (
    <div className="rounded-xl border border-border p-3 text-center">
      <div className="text-2xl font-extrabold tracking-tight text-card-foreground">{value}</div>
      <div className="mt-1 text-xs font-semibold text-muted">{label}</div>
    </div>
  );
}

// Documents live in Supabase Storage (private bucket) -- resolves a
// short-lived signed URL on click, same idiom as JobClientProfile.jsx.
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

const inputClass = "h-11 min-h-0 w-full rounded-lg border border-border bg-background px-3 text-sm text-card-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15";

function EditCompanyInfoModal({ record, industries, onSave, onCancel }) {
  const t = useT();
  const [fields, setFields] = useState({
    businessName: record.businessName || "", industry: record.industry || "", website: record.website || "",
    street: record.street || "", city: record.city || "", zip: record.zip || "",
    contactName: record.contactName || "", contactPhone: record.contactPhone || "", contactEmail: record.contactEmail || "",
    hrContactName: record.hrContactName || "", hrContactPhone: record.hrContactPhone || "", hrContactEmail: record.hrContactEmail || "",
    preferredCommunication: record.preferredCommunication || "", notes: record.notes || ""
  });
  function setField(name, value) { setFields((prev) => Object.assign({}, prev, { [name]: value })); }

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="modal-box max-w-xl" role="dialog" aria-modal="true">
        <p className="mb-4 text-base font-bold text-card-foreground">{t("companyInformationLabel")}</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div><label className="mb-1 block text-xs font-semibold text-card-foreground">{t("businessNameLabel")}</label><input className={inputClass} value={fields.businessName} onChange={(e) => setField("businessName", e.target.value)} /></div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-card-foreground">{t("industryLabel")}</label>
            <select className={inputClass} value={fields.industry} onChange={(e) => setField("industry", e.target.value)}>
              <option value="">{t("pleaseSelect")}</option>
              {industries.map((i) => <option key={i.key} value={i.key}>{i.en}</option>)}
            </select>
          </div>
          <div><label className="mb-1 block text-xs font-semibold text-card-foreground">{t("websiteLabel")}</label><input className={inputClass} value={fields.website} onChange={(e) => setField("website", e.target.value)} /></div>
          <div><label className="mb-1 block text-xs font-semibold text-card-foreground">{t("address")}</label><input className={inputClass} value={fields.street} onChange={(e) => setField("street", e.target.value)} /></div>
          <div><label className="mb-1 block text-xs font-semibold text-card-foreground">{t("city")}</label><input className={inputClass} value={fields.city} onChange={(e) => setField("city", e.target.value)} /></div>
          <div><label className="mb-1 block text-xs font-semibold text-card-foreground">{t("zip")}</label><input className={inputClass} value={fields.zip} onChange={(e) => setField("zip", e.target.value)} /></div>
          <div><label className="mb-1 block text-xs font-semibold text-card-foreground">{t("contactNameLabel")}</label><input className={inputClass} value={fields.contactName} onChange={(e) => setField("contactName", e.target.value)} /></div>
          <div><label className="mb-1 block text-xs font-semibold text-card-foreground">{t("contactPhoneLabel")}</label><input className={inputClass} value={fields.contactPhone} onChange={(e) => setField("contactPhone", e.target.value)} /></div>
          <div><label className="mb-1 block text-xs font-semibold text-card-foreground">{t("contactEmailLabel")}</label><input className={inputClass} value={fields.contactEmail} onChange={(e) => setField("contactEmail", e.target.value)} /></div>
          <div><label className="mb-1 block text-xs font-semibold text-card-foreground">{t("hrContactNameLabel")}</label><input className={inputClass} value={fields.hrContactName} onChange={(e) => setField("hrContactName", e.target.value)} /></div>
          <div><label className="mb-1 block text-xs font-semibold text-card-foreground">{t("hrContactPhoneLabel")}</label><input className={inputClass} value={fields.hrContactPhone} onChange={(e) => setField("hrContactPhone", e.target.value)} /></div>
          <div><label className="mb-1 block text-xs font-semibold text-card-foreground">{t("hrContactEmailLabel")}</label><input className={inputClass} value={fields.hrContactEmail} onChange={(e) => setField("hrContactEmail", e.target.value)} /></div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-card-foreground">{t("preferredCommunicationLabel")}</label>
            <select className={inputClass} value={fields.preferredCommunication} onChange={(e) => setField("preferredCommunication", e.target.value)}>
              <option value="">{t("pleaseSelect")}</option>
              {PREFERRED_COMMUNICATION_METHODS.map((m) => <option key={m.key} value={m.key}>{m.en}</option>)}
            </select>
          </div>
        </div>
        <div className="mt-3">
          <label className="mb-1 block text-xs font-semibold text-card-foreground">{t("companyNotesLabel")}</label>
          <textarea rows={2} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-card-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15" value={fields.notes} onChange={(e) => setField("notes", e.target.value)} />
        </div>
        <div className="pill-row" style={{ justifyContent: "flex-end", marginTop: 16, marginBottom: 0 }}>
          <button type="button" className="btn-secondary" onClick={onCancel}>{t("cancelLabel")}</button>
          <Button onClick={() => onSave(fields)}>{t("saveLabel")}</Button>
        </div>
      </div>
    </div>
  );
}

function EditPartnershipModal({ record, jobDevelopers, onSave, onCancel }) {
  const t = useT();
  const [fields, setFields] = useState({
    partnerSince: record.partnerSince || "", lastMeetingDate: record.lastMeetingDate || "", nextFollowUpDate: record.nextFollowUpDate || "",
    assignedJobDeveloperEmail: record.assignedJobDeveloperEmail || "", preferredHiringMethod: record.preferredHiringMethod || ""
  });
  function setField(name, value) { setFields((prev) => Object.assign({}, prev, { [name]: value })); }

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="modal-box max-w-lg" role="dialog" aria-modal="true">
        <p className="mb-4 text-base font-bold text-card-foreground">{t("partnershipInformationLabel")}</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div><label className="mb-1 block text-xs font-semibold text-card-foreground">{t("partnerSinceLabel")}</label><DatePicker id="employer-partner-since" value={fields.partnerSince} onChange={(v) => setField("partnerSince", v)} /></div>
          <div><label className="mb-1 block text-xs font-semibold text-card-foreground">{t("lastMeetingDateLabel")}</label><DatePicker id="employer-last-meeting" value={fields.lastMeetingDate} onChange={(v) => setField("lastMeetingDate", v)} /></div>
          <div><label className="mb-1 block text-xs font-semibold text-card-foreground">{t("nextFollowUpDateLabel")}</label><DatePicker id="employer-next-follow-up" value={fields.nextFollowUpDate} onChange={(v) => setField("nextFollowUpDate", v)} /></div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-card-foreground">{t("assignedJobDeveloperLabel")}</label>
            <select className={inputClass} value={fields.assignedJobDeveloperEmail} onChange={(e) => setField("assignedJobDeveloperEmail", e.target.value)}>
              <option value="">{t("pleaseSelect")}</option>
              {jobDevelopers.map((u) => <option key={u.id} value={u.email}>{u.name || u.email}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-card-foreground">{t("preferredHiringMethodLabel")}</label>
            <select className={inputClass} value={fields.preferredHiringMethod} onChange={(e) => setField("preferredHiringMethod", e.target.value)}>
              <option value="">{t("pleaseSelect")}</option>
              {PREFERRED_HIRING_METHODS.map((m) => <option key={m.key} value={m.key}>{m.en}</option>)}
            </select>
          </div>
        </div>
        <div className="pill-row" style={{ justifyContent: "flex-end", marginTop: 16, marginBottom: 0 }}>
          <button type="button" className="btn-secondary" onClick={onCancel}>{t("cancelLabel")}</button>
          <Button onClick={() => onSave(fields)}>{t("saveLabel")}</Button>
        </div>
      </div>
    </div>
  );
}

function AddActivityModal({ onSave, onCancel }) {
  const t = useT();
  const [fields, setFields] = useState({ date: "", type: "call", summary: "", followUpRequired: false });
  function setField(name, value) { setFields((prev) => Object.assign({}, prev, { [name]: value })); }

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="modal-box max-w-lg" role="dialog" aria-modal="true">
        <p className="mb-4 text-base font-bold text-card-foreground">{t("addActivityBtn")}</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div><label className="mb-1 block text-xs font-semibold text-card-foreground">{t("date")}</label><DatePicker id="employer-activity-date" value={fields.date} onChange={(v) => setField("date", v)} /></div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-card-foreground">{t("activityTypeFieldLabel")}</label>
            <select className={inputClass} value={fields.type} onChange={(e) => setField("type", e.target.value)}>
              {ACTIVITY_TYPES.map((a) => <option key={a.key} value={a.key}>{a.en}</option>)}
            </select>
          </div>
        </div>
        <div className="mt-3">
          <label className="mb-1 block text-xs font-semibold text-card-foreground">{t("noteContentLabel")}</label>
          <textarea rows={3} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-card-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15" value={fields.summary} onChange={(e) => setField("summary", e.target.value)} />
        </div>
        <label className="mt-3 flex items-center gap-2 text-sm text-card-foreground">
          <input type="checkbox" checked={fields.followUpRequired} onChange={(e) => setField("followUpRequired", e.target.checked)} />
          {t("followUpRequiredLabel")}
        </label>
        <div className="pill-row" style={{ justifyContent: "flex-end", marginTop: 16, marginBottom: 0 }}>
          <button type="button" className="btn-secondary" onClick={onCancel}>{t("cancelLabel")}</button>
          <Button disabled={!fields.summary.trim()} onClick={() => onSave(fields)}>{t("saveLabel")}</Button>
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
          value={content} onChange={(e) => setContent(e.target.value)} rows={4}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-card-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
        />
        <div className="pill-row" style={{ justifyContent: "flex-end", marginTop: 12, marginBottom: 0 }}>
          <button type="button" className="btn-secondary" onClick={onCancel}>{t("cancelLabel")}</button>
          <Button disabled={!content.trim()} onClick={() => onSave(content)}>{t("saveLabel")}</Button>
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
    onSave({ category: "other", fileName: file.name, file });
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

export default function EmployerProfile() {
  const { employerId } = useParams();
  const { data, requestConfirm, showToast } = useApp();
  const t = useT();
  const navigate = useNavigate();
  const [tab, setTab] = useState("overview");
  const [editingCompany, setEditingCompany] = useState(false);
  const [editingPartnership, setEditingPartnership] = useState(false);
  const [addingActivity, setAddingActivity] = useState(false);
  const [addingNote, setAddingNote] = useState(false);
  const [uploadingDocument, setUploadingDocument] = useState(false);
  const [addingJobOpening, setAddingJobOpening] = useState(false);
  const [viewingJobOpening, setViewingJobOpening] = useState(null);
  const [activity, setActivity] = useState([]);
  const [notes, setNotes] = useState([]);
  const [documents, setDocuments] = useState([]);

  const record = (data.employers || []).find((e) => e.id === employerId);
  const employerOpenings = (data.jobOpenings || [])
    .filter((o) => o.employerId === employerId)
    .sort((a, b) => jobOpeningSortKey(a) - jobOpeningSortKey(b) || (b.postedDate || "").localeCompare(a.postedDate || ""));
  const totalPositions = employerOpenings.length;
  const activeOpeningsCount = employerOpenings.filter((o) => o.status === "active").length;
  const employerReferrals = (data.referrals || []).filter((r) => r.employerId === employerId);
  const totalReferralsCount = employerReferrals.length;
  const interviewsCount = employerReferrals.filter((r) => hasReachedInterview(r.status)).length;
  const hiresCount = employerReferrals.filter((r) => r.status === "hired").length;
  const employerPlacements = (data.placements || []).filter((p) => p.employerId === employerId);
  const retentionRate = computeRetentionRate(employerPlacements);

  useEffect(() => {
    let cancelled = false;
    if (!employerId) return undefined;
    fetchEmployerActivity(employerId).then((rows) => { if (!cancelled) setActivity(rows); });
    fetchEmployerNotes(employerId).then((rows) => { if (!cancelled) setNotes(rows); });
    fetchEmployerDocuments(employerId).then((rows) => { if (!cancelled) setDocuments(rows); });
    return () => { cancelled = true; };
  }, [employerId]);

  if (!record) {
    return <Card><CardContent className="p-10 text-center text-sm text-muted">{t("employerNotFoundMessage")}</CardContent></Card>;
  }

  const industries = activeIndustryList(data.customIndustries, data.disabledIndustries);
  const jobDevelopers = activeJobDevelopers(data.profiles);
  const assignedName = (data.profiles || []).find((p) => p.email === record.assignedJobDeveloperEmail);

  async function updateRecord(patch) {
    await updateEmployer(employerId, patch);
  }

  async function addActivity(fields) {
    const created = await createEmployerActivity(employerId, fields);
    setActivity((prev) => [created].concat(prev));
    setAddingActivity(false);
    if (fields.date) await updateRecord({ lastMeetingDate: fields.date });
  }

  async function addJobOpening(fields, status) {
    await createJobOpening(Object.assign({}, fields, { status }));
    setAddingJobOpening(false);
    showToast(t("jobOpeningAdded"));
  }

  async function addNote(content) {
    const created = await createEmployerNote(employerId, content);
    setNotes((prev) => [created].concat(prev));
    setAddingNote(false);
  }

  async function uploadDocument(fields) {
    const path = await uploadClientFile(record.id, fields.file);
    const created = await createEmployerDocument(record.id, { fileName: fields.fileName, category: fields.category, storagePath: path });
    setDocuments((prev) => [created].concat(prev));
    setUploadingDocument(false);
  }
  async function deleteDocument(doc) {
    const ok = await requestConfirm(t("deleteDocumentConfirm"), { danger: true });
    if (!ok) return;
    try {
      await deleteEmployerDocument(doc.id, doc.storagePath);
      setDocuments((prev) => prev.filter((d) => d.id !== doc.id));
    } catch (err) {
      console.warn("deleteDocument failed", err);
      showToast(t("deleteDocumentError"));
    }
  }

  return (
    <>
      <Button variant="ghost" size="sm" className="mb-3 gap-1.5" onClick={() => navigate("/employers")}>
        <ArrowLeft className="h-3.5 w-3.5" /> {t("navEmployers")}
      </Button>

      <Card>
        <CardContent className="flex flex-col gap-4 p-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-4">
            <Avatar className="h-14 w-14 shrink-0">
              <AvatarFallback className={avatarColorFor(record.businessName) + " text-lg"}>{businessInitials(record.businessName)}</AvatarFallback>
            </Avatar>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="m-0 text-xl">{record.businessName}</h1>
                <Badge variant={partnershipStageBadgeVariant(record.partnershipStage)}>{partnershipStageLabel(record.partnershipStage)}</Badge>
              </div>
              <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
                {record.industry && <span>{industries.find((i) => i.key === record.industry) ? industries.find((i) => i.key === record.industry).en : record.industry}</span>}
                <span>{formatPhone(record.contactPhone) || "—"}</span>
                <span>{formatAddress(record) || "—"}</span>
              </div>
              <div className="mt-3"><EmployerPipelineTracker stage={record.partnershipStage} onChange={(s) => updateRecord({ partnershipStage: s })} /></div>
            </div>
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
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-[65fr_35fr]">
              <div className="space-y-6">
                <SectionCard title={t("companyInformationLabel")} action={
                  <Button size="icon" variant="ghost" onClick={() => setEditingCompany(true)} aria-label={t("editProfileBtn")}><Pencil className="h-3.5 w-3.5" /></Button>
                }>
                  <FieldRow label={t("websiteLabel")} value={record.website} />
                  <FieldRow label={t("address")} value={formatAddress(record)} />
                  <FieldRow label={t("contactNameLabel")} value={record.contactName} />
                  <FieldRow label={t("contactPhoneLabel")} value={formatPhone(record.contactPhone)} />
                  <FieldRow label={t("contactEmailLabel")} value={record.contactEmail} />
                  <FieldRow label={t("hrContactNameLabel")} value={record.hrContactName} />
                  <FieldRow label={t("hrContactPhoneLabel")} value={formatPhone(record.hrContactPhone)} />
                  <FieldRow label={t("hrContactEmailLabel")} value={record.hrContactEmail} />
                  <FieldRow label={t("preferredCommunicationLabel")} value={preferredCommunicationLabel(record.preferredCommunication)} />
                  <FieldRow label={t("companyNotesLabel")} value={record.notes} />
                </SectionCard>

                <SectionCard title={t("metricsLabel")}>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                    <MetricTile label={t("totalPositionsLabel")} value={totalPositions} />
                    <MetricTile label={t("totalReferralsLabel")} value={totalReferralsCount} />
                    <MetricTile label={t("totalInterviewsLabel")} value={interviewsCount} />
                    <MetricTile label={t("totalHiresLabel")} value={hiresCount} />
                    <MetricTile label={t("retentionRateLabel")} value={retentionRate === null ? "—" : retentionRate + "%"} />
                    <MetricTile label={t("activeOpeningsLabel")} value={activeOpeningsCount} />
                  </div>
                </SectionCard>

                <SectionCard title={t("employerTabActivity")} action={<Button size="sm" variant="secondary" onClick={() => setTab("activity")}>{t("viewAllBtn")}</Button>}>
                  {activity.length === 0 ? <p className="text-sm text-muted">{t("noActivityYet")}</p> : (
                    <div className="space-y-2">
                      {activity.slice(0, 3).map((a) => (
                        <div key={a.id} className="flex items-center justify-between gap-3 border-b border-border py-2 text-sm last:border-b-0">
                          <div>
                            <span className="font-semibold text-card-foreground">{activityTypeLabel(a.type)}</span>
                            {a.summary && <span className="ml-2 text-muted">{a.summary}</span>}
                          </div>
                          <span className="shrink-0 text-xs text-muted">{fmtDateLong(a.date)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </SectionCard>
              </div>

              <div className="space-y-6">
                <SectionCard title={t("partnershipInformationLabel")} action={
                  <Button size="icon" variant="ghost" onClick={() => setEditingPartnership(true)} aria-label={t("editProfileBtn")}><Pencil className="h-3.5 w-3.5" /></Button>
                }>
                  <FieldRow label={t("partnerSinceLabel")} value={fmtDateLong(record.partnerSince)} />
                  <FieldRow label={t("lastMeetingDateLabel")} value={fmtDateLong(record.lastMeetingDate)} />
                  <FieldRow label={t("nextFollowUpDateLabel")} value={fmtDateLong(record.nextFollowUpDate)} />
                  <FieldRow label={t("assignedJobDeveloperLabel")} value={assignedName ? (assignedName.name || assignedName.email) : ""} />
                  <FieldRow label={t("preferredHiringMethodLabel")} value={preferredHiringMethodLabel(record.preferredHiringMethod)} />
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

          {tab === "jobOpenings" && (
            <div>
              <div className="mb-3 flex justify-end"><Button size="sm" className="gap-1.5" onClick={() => setAddingJobOpening(true)}><Plus className="h-3.5 w-3.5" /> {t("addJobBtn")}</Button></div>
              {employerOpenings.length === 0 ? <p className="py-8 text-center text-sm text-muted">{t("noJobOpeningsYet")}</p> : (
                <div className="space-y-2">
                  {employerOpenings.map((o) => (
                    <Card key={o.id}><CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                      <button type="button" onClick={() => setViewingJobOpening(o)} className="border-0 bg-transparent p-0 text-left">
                        <div className="text-sm font-bold text-card-foreground hover:text-primary hover:underline">{o.title}</div>
                        <div className="mt-1 text-xs text-muted">
                          {employmentTypeLabel(o.employmentType)}{formatPayRange(o) ? " · " + formatPayRange(o) : ""} · {t("postedDateLabel")} {fmtDateLong(o.postedDate)}
                        </div>
                      </button>
                      <Badge variant={statusBadgeVariant(o.status)}>{statusLabel(o.status)}</Badge>
                    </CardContent></Card>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === "candidates" && (
            employerReferrals.length === 0 ? <p className="py-8 text-center text-sm text-muted">{t("noReferralsYetLabel")}</p> : (
              <div className="space-y-2">
                {employerReferrals.map((r) => (
                  <Card key={r.id}><CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                    <div>
                      <div className="text-sm font-bold text-card-foreground">{r.participantName}</div>
                      <div className="mt-0.5 text-xs text-muted">{r.positionTitle} · {t("referralDateLabel")} {fmtDateLong(r.referralDate)}</div>
                    </div>
                    <Badge variant={referralStageBadgeVariant(r.status)}>{referralStageLabel(r.status)}</Badge>
                  </CardContent></Card>
                ))}
              </div>
            )
          )}

          {tab === "placements" && (
            employerPlacements.length === 0 ? <p className="py-8 text-center text-sm text-muted">{t("noPlacementsYet")}</p> : (
              <div className="space-y-2">
                {employerPlacements.map((p) => (
                  <button key={p.id} type="button" onClick={() => navigate("/placements/" + p.id)} className="block w-full min-h-0 border-0 bg-transparent p-0 text-left">
                    <Card><CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                      <div>
                        <div className="text-sm font-bold text-card-foreground hover:text-primary hover:underline">{p.participantName}</div>
                        <div className="mt-0.5 text-xs text-muted">{p.positionTitle} · {t("jobStartDateLabel")} {fmtDateLong(p.startDate)}</div>
                      </div>
                      <Badge variant={placementStatusBadgeVariant(p.currentStatus)}>{placementStatusLabel(p.currentStatus)}</Badge>
                    </CardContent></Card>
                  </button>
                ))}
              </div>
            )
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

          {tab === "activity" && (
            <div>
              <div className="mb-3 flex justify-end"><Button size="sm" className="gap-1.5" onClick={() => setAddingActivity(true)}><Plus className="h-3.5 w-3.5" /> {t("addActivityBtn")}</Button></div>
              {activity.length === 0 ? <p className="py-8 text-center text-sm text-muted">{t("noActivityYet")}</p> : (
                <div className="space-y-2">
                  {activity.map((a) => (
                    <Card key={a.id}><CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-card-foreground">{activityTypeLabel(a.type)}</span>
                        <div className="flex items-center gap-2">
                          {a.followUpRequired && <Badge variant="warn">{t("followUpRequiredLabel")}</Badge>}
                          <Badge>{fmtDateLong(a.date)}</Badge>
                        </div>
                      </div>
                      {a.summary && <p className="mt-1.5 text-sm text-muted">{a.summary}</p>}
                      <p className="mt-1.5 text-xs font-semibold text-muted">— {a.staffName || "—"}</p>
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
        </CardContent>
      </Card>

      {editingCompany && <EditCompanyInfoModal record={record} industries={industries} onSave={async (fields) => { await updateRecord(fields); setEditingCompany(false); }} onCancel={() => setEditingCompany(false)} />}
      {editingPartnership && <EditPartnershipModal record={record} jobDevelopers={jobDevelopers} onSave={async (fields) => { await updateRecord(fields); setEditingPartnership(false); }} onCancel={() => setEditingPartnership(false)} />}
      {addingActivity && <AddActivityModal onSave={addActivity} onCancel={() => setAddingActivity(false)} />}
      {addingNote && <AddNoteModal onSave={addNote} onCancel={() => setAddingNote(false)} />}
      {uploadingDocument && <UploadDocumentModal onSave={uploadDocument} onCancel={() => setUploadingDocument(false)} />}
      {addingJobOpening && <JobOpeningWizard employers={[record]} lockEmployerId={record.id} onSave={addJobOpening} onCancel={() => setAddingJobOpening(false)} />}
      {viewingJobOpening && <JobOpeningDetailModal jobOpening={viewingJobOpening} onClose={() => setViewingJobOpening(null)} />}
    </>
  );
}
