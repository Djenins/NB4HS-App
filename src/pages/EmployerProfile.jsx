// EmployerProfile.jsx -- CRM-style Employer Profile page. Phase 1 (Employer
// info/notes/activity/documents) mirrors JobClientProfile.jsx's structure.
// Phase 2 lit up the Job Openings tab with real data (and the Total
// Positions/Active Openings metrics) once job_openings existed; Phase 3/4 did
// the same for Candidates (data.referrals, filtered to this employer) and
// Placements (data.placements, linking into /placements/:placementId) --
// both tabs are real now, not placeholders.
//
// Layout follows the record-page template (ClientProfile.jsx +
// ClientHeader.jsx): ghost back link, identity header with two visible
// actions and a More menu, a summary card with the partnership tracker, then
// <Tabs> with counts and a TabPanel of SectionCards. Lists inside a panel
// are divided rows; every edit is a ui Dialog form. JobOpeningWizard and
// JobOpeningDetailModal are their own components and are called unchanged.
import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft, Briefcase, Building2, CalendarClock, ChevronRight, Download, Factory, FileText, Handshake, Mail, MapPin,
  MessageSquarePlus, MoreHorizontal, Paperclip, Pencil, Phone, Plus, StickyNote, Trash2, UploadCloud, UserCheck, Users
} from "lucide-react";
import { useApp, useT } from "../context/AppContext.jsx";
import { activeJobDevelopers } from "../lib/appointments.js";
import {
  ACTIVITY_TYPES, activityTypeLabel, businessInitials,
  partnershipStageLabel, PREFERRED_COMMUNICATION_METHODS, PREFERRED_HIRING_METHODS,
  preferredCommunicationLabel, preferredHiringMethodLabel
} from "../lib/employerProfile.js";
import {
  createEmployerActivity, createEmployerDocument, createEmployerNote, createJobOpening, deleteEmployerDocument,
  fetchEmployerActivity, fetchEmployerDocuments, fetchEmployerNotes, getFileSignedUrl, updateEmployer, uploadClientFile
} from "../lib/clientsData.js";
import { employmentTypeLabel, formatPayRange, jobOpeningSortKey, statusLabel } from "../lib/jobOpenings.js";
import { hasReachedInterview, stageLabel as referralStageLabel } from "../lib/referrals.js";
import { computeRetentionRate, placementStatusLabel } from "../lib/placements.js";
import { cn } from "../lib/cn.js";
import { activeIndustryList, formatAddress, formatPhone, fmtDateLong } from "../lib/utils.js";
import { Button, BUTTON_RESET } from "../components/ui/button.jsx";
import { Card } from "../components/ui/card.jsx";
import { Dialog } from "../components/ui/dialog.jsx";
import { DetailRow } from "../components/ui/drawer.jsx";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger
} from "../components/ui/dropdown-menu.jsx";
import { EmptyState } from "../components/ui/empty-state.jsx";
import { Field, Input, Select, Textarea } from "../components/ui/field.jsx";
import { IconButton } from "../components/ui/icon-button.jsx";
import { SectionCard } from "../components/ui/section-card.jsx";
import { StatusBadge } from "../components/ui/status-badge.jsx";
import { TabPanel, Tabs } from "../components/ui/tabs.jsx";
import DatePicker from "../components/DatePicker.jsx";
import EmployerPipelineTracker from "../components/EmployerPipelineTracker.jsx";
import JobOpeningDetailModal from "../components/JobOpeningDetailModal.jsx";
import JobOpeningWizard from "../components/JobOpeningWizard.jsx";
import AddressInput from "../components/AddressInput.jsx";
import RecordHeader, { ContactItem } from "../components/RecordHeader.jsx";

const TAB_KEYS = ["overview", "jobOpenings", "candidates", "placements", "documents", "activity", "notes"];
const TAB_LABEL = {
  overview: "clientTabOverview", jobOpenings: "employerTabJobOpenings", candidates: "employerTabCandidates",
  placements: "employerTabPlacements", documents: "clientTabDocuments", activity: "employerTabActivity", notes: "clientTabNotes"
};
const TAB_ID_BASE = "employer-profile";

// One list row inside a flush SectionCard: hairline between rows, card padding.
const ROW = "border-b border-line-subtle px-5 py-4 last:border-b-0 sm:px-6";
// A whole row that opens something: the <li> carries the rule, the button
// fills it with the same padding and a sunken hover.
const ROW_ITEM = "border-b border-line-subtle last:border-b-0";
const ROW_BUTTON =
  BUTTON_RESET + " flex w-full items-center justify-between gap-3 px-5 py-4 text-left text-card-foreground transition-colors duration-fast " +
  "hover:bg-surface-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset sm:px-6";

const FILE_INPUT = "h-auto py-1.5 file:mr-3 file:cursor-pointer file:rounded-control file:border-0 file:bg-primary-tint file:px-3 file:py-1.5 file:text-ui file:font-semibold file:text-primary [@media(pointer:coarse)]:h-auto";

function FieldRow({ label, value }) {
  return <DetailRow label={label}>{value || "—"}</DetailRow>;
}

// Documents live in Supabase Storage (private bucket) -- resolves a
// short-lived signed URL on click and hands it to a temporary <a download>.
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
function DownloadButton({ path, fileName, label, iconOnly }) {
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
    <Button variant="ghost" size="sm" onClick={onClick} loading={loading}>
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

function EditCompanyInfoModal({ record, industries, onSave, onCancel }) {
  const t = useT();
  const [saving, run] = useSaving();
  const [fields, setFields] = useState({
    businessName: record.businessName || "", industry: record.industry || "", website: record.website || "",
    street: record.street || "", city: record.city || "", zip: record.zip || "",
    contactName: record.contactName || "", contactPhone: record.contactPhone || "", contactEmail: record.contactEmail || "",
    hrContactName: record.hrContactName || "", hrContactPhone: record.hrContactPhone || "", hrContactEmail: record.hrContactEmail || "",
    preferredCommunication: record.preferredCommunication || "", notes: record.notes || ""
  });
  function setField(name, value) { setFields((prev) => Object.assign({}, prev, { [name]: value })); }
  function text(name, labelKey, phKey, extra) {
    // The street field suggests addresses and fills city/zip from the pick.
    const addr = name === "street" ? { as: Input, onAddressSelect: (a) => setFields((prev) => Object.assign({}, prev, { street: a.street, city: a.city || prev.city, zip: a.zip || prev.zip })) } : null;
    const Control = addr ? AddressInput : Input;
    const id = "employer-" + name;
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
      title={t("companyInformationLabel")}
      size="lg"
      closeLabel={t("closeLabel")}
      as="form"
      panelProps={{ onSubmit: (e) => { e.preventDefault(); run(() => onSave(fields)); } }}
      footer={<DialogFooter onCancel={onCancel} saving={saving} submitLabel={t("saveLabel")} />}
    >
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {text("businessName", "businessNameLabel", "phBusinessName", { "data-autofocus": true })}
          <Field label={t("industryLabel")} htmlFor="employer-industry">
            <Select id="employer-industry" value={fields.industry} onChange={(e) => setField("industry", e.target.value)}>
              <option value="">{t("pleaseSelect")}</option>
              {industries.map((i) => <option key={i.key} value={i.key}>{i.en}</option>)}
            </Select>
          </Field>
          {text("website", "websiteLabel", "phWebsite", { type: "url" })}
          {text("street", "address", "phAddress")}
          {text("city", "city", "phCity")}
          {text("zip", "zip", "phZip")}
          {text("contactName", "contactNameLabel", "phContactName")}
          {text("contactPhone", "contactPhoneLabel", "phPhone", { type: "tel" })}
          {text("contactEmail", "contactEmailLabel", "phEmail", { type: "email" })}
          {text("hrContactName", "hrContactNameLabel", "phContactName")}
          {text("hrContactPhone", "hrContactPhoneLabel", "phPhone", { type: "tel" })}
          {text("hrContactEmail", "hrContactEmailLabel", "phEmail", { type: "email" })}
          <Field label={t("preferredCommunicationLabel")} htmlFor="employer-preferred-communication">
            <Select id="employer-preferred-communication" value={fields.preferredCommunication} onChange={(e) => setField("preferredCommunication", e.target.value)}>
              <option value="">{t("pleaseSelect")}</option>
              {PREFERRED_COMMUNICATION_METHODS.map((m) => <option key={m.key} value={m.key}>{m.en}</option>)}
            </Select>
          </Field>
        </div>
        <Field label={t("companyNotesLabel")} htmlFor="employer-notes">
          <Textarea id="employer-notes" rows={2} value={fields.notes} onChange={(e) => setField("notes", e.target.value)} placeholder={t("phCompanyNotes")} />
        </Field>
      </div>
    </Dialog>
  );
}

function EditPartnershipModal({ record, jobDevelopers, onSave, onCancel }) {
  const t = useT();
  const [saving, run] = useSaving();
  const [fields, setFields] = useState({
    partnerSince: record.partnerSince || "", lastMeetingDate: record.lastMeetingDate || "", nextFollowUpDate: record.nextFollowUpDate || "",
    assignedJobDeveloperEmail: record.assignedJobDeveloperEmail || "", preferredHiringMethod: record.preferredHiringMethod || ""
  });
  function setField(name, value) { setFields((prev) => Object.assign({}, prev, { [name]: value })); }

  return (
    <Dialog
      open
      onClose={onCancel}
      title={t("partnershipInformationLabel")}
      size="md"
      closeLabel={t("closeLabel")}
      as="form"
      panelProps={{ onSubmit: (e) => { e.preventDefault(); run(() => onSave(fields)); } }}
      footer={<DialogFooter onCancel={onCancel} saving={saving} submitLabel={t("saveLabel")} />}
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label={t("partnerSinceLabel")} htmlFor="employer-partner-since">
          <DatePicker id="employer-partner-since" value={fields.partnerSince} onChange={(v) => setField("partnerSince", v)} />
        </Field>
        <Field label={t("lastMeetingDateLabel")} htmlFor="employer-last-meeting">
          <DatePicker id="employer-last-meeting" value={fields.lastMeetingDate} onChange={(v) => setField("lastMeetingDate", v)} />
        </Field>
        <Field label={t("nextFollowUpDateLabel")} htmlFor="employer-next-follow-up">
          <DatePicker id="employer-next-follow-up" value={fields.nextFollowUpDate} onChange={(v) => setField("nextFollowUpDate", v)} />
        </Field>
        <Field label={t("assignedJobDeveloperLabel")} htmlFor="employer-assigned-jd">
          <Select id="employer-assigned-jd" value={fields.assignedJobDeveloperEmail} onChange={(e) => setField("assignedJobDeveloperEmail", e.target.value)}>
            <option value="">{t("pleaseSelect")}</option>
            {jobDevelopers.map((u) => <option key={u.id} value={u.email}>{u.name || u.email}</option>)}
          </Select>
        </Field>
        <Field label={t("preferredHiringMethodLabel")} htmlFor="employer-hiring-method">
          <Select id="employer-hiring-method" value={fields.preferredHiringMethod} onChange={(e) => setField("preferredHiringMethod", e.target.value)}>
            <option value="">{t("pleaseSelect")}</option>
            {PREFERRED_HIRING_METHODS.map((m) => <option key={m.key} value={m.key}>{m.en}</option>)}
          </Select>
        </Field>
      </div>
    </Dialog>
  );
}

function AddActivityModal({ onSave, onCancel }) {
  const t = useT();
  const [saving, run] = useSaving();
  const [fields, setFields] = useState({ date: "", type: "call", summary: "", followUpRequired: false });
  function setField(name, value) { setFields((prev) => Object.assign({}, prev, { [name]: value })); }

  return (
    <Dialog
      open
      onClose={onCancel}
      title={t("addActivityBtn")}
      size="md"
      closeLabel={t("closeLabel")}
      as="form"
      panelProps={{ onSubmit: (e) => { e.preventDefault(); if (fields.summary.trim()) run(() => onSave(fields)); } }}
      footer={<DialogFooter onCancel={onCancel} saving={saving} disabled={!fields.summary.trim()} submitLabel={t("saveLabel")} />}
    >
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={t("date")} htmlFor="employer-activity-date">
            <DatePicker id="employer-activity-date" value={fields.date} onChange={(v) => setField("date", v)} />
          </Field>
          <Field label={t("activityTypeFieldLabel")} htmlFor="employer-activity-type">
            <Select id="employer-activity-type" value={fields.type} onChange={(e) => setField("type", e.target.value)}>
              {ACTIVITY_TYPES.map((a) => <option key={a.key} value={a.key}>{a.en}</option>)}
            </Select>
          </Field>
        </div>
        <Field label={t("noteContentLabel")} htmlFor="employer-activity-summary" required>
          <Textarea id="employer-activity-summary" rows={3} value={fields.summary} onChange={(e) => setField("summary", e.target.value)} placeholder={t("phActivitySummary")} />
        </Field>
        <label className="m-0 flex cursor-pointer items-center gap-2.5 text-ui font-medium text-card-foreground">
          <input type="checkbox" checked={fields.followUpRequired} onChange={(e) => setField("followUpRequired", e.target.checked)} className="h-4 w-4 cursor-pointer accent-primary" />
          {t("followUpRequiredLabel")}
        </label>
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
      panelProps={{ onSubmit: (e) => { e.preventDefault(); if (content.trim()) run(() => onSave(content)); } }}
      footer={<DialogFooter onCancel={onCancel} saving={saving} disabled={!content.trim()} submitLabel={t("saveLabel")} />}
    >
      <Field label={t("noteContentLabel")} htmlFor="employer-note-content" required>
        <Textarea id="employer-note-content" value={content} onChange={(e) => setContent(e.target.value)} rows={4} placeholder={t("phNoteContent")} data-autofocus />
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
    run(() => onSave({ category: "other", fileName: file.name, file }));
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
      <Field label={t("documentFileLabel")} htmlFor="employer-document-file" required>
        <Input
          id="employer-document-file" ref={fileRef} type="file" data-autofocus
          onChange={(e) => setFileName(e.target.files && e.target.files[0] ? e.target.files[0].name : "")}
          className={FILE_INPUT}
        />
      </Field>
    </Dialog>
  );
}

// Identity header -- the shared RecordHeader for an employer: back link,
// initials avatar, business name as the page h1, partnership stage, contact
// line, the "at a glance" facts, two visible actions and the rest under More.
function EmployerHeader({ record, industryName, facts, onBack, onAddJob, onEditCompany, onEditPartnership, onAddActivity, onAddNote, onUploadDocument }) {
  const t = useT();

  function moreMenu(size) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <IconButton label={t("moreActionsBtn")} variant="secondary" size={size}>
            <MoreHorizontal aria-hidden="true" />
          </IconButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-[14rem]">
          <DropdownMenuItem onSelect={onEditPartnership}>
            <Handshake className="h-4 w-4 text-muted" aria-hidden="true" />{t("editPartnershipBtn")}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={onAddActivity}>
            <CalendarClock className="h-4 w-4 text-muted" aria-hidden="true" />{t("addActivityBtn")}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={onAddNote}>
            <MessageSquarePlus className="h-4 w-4 text-muted" aria-hidden="true" />{t("addNoteBtn")}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={onUploadDocument}>
            <UploadCloud className="h-4 w-4 text-muted" aria-hidden="true" />{t("uploadDocumentBtn")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <RecordHeader
      name={record.businessName}
      initials={businessInitials(record.businessName)}
      onBack={onBack}
      backLabel={t("navEmployers")}
      facts={facts}
      badges={<StatusBadge domain="employer" status={record.partnershipStage}>{partnershipStageLabel(record.partnershipStage)}</StatusBadge>}
      contact={
        <>
          {industryName ? <ContactItem icon={Factory} label={t("industryLabel")}>{industryName}</ContactItem> : null}
          <ContactItem icon={Phone} label={t("contactPhoneLabel")}><span className="tabular-nums">{formatPhone(record.contactPhone) || "—"}</span></ContactItem>
          {record.contactEmail ? <ContactItem icon={Mail} label={t("contactEmailLabel")}>{record.contactEmail}</ContactItem> : null}
          <ContactItem icon={MapPin} label={t("address")}>{formatAddress(record) || "—"}</ContactItem>
        </>
      }
      actions={
        <>
          <Button onClick={onAddJob}>
            <Plus className="h-4 w-4" aria-hidden="true" /> {t("addJobBtn")}
          </Button>
          <Button variant="secondary" onClick={onEditCompany}>
            <Pencil className="h-4 w-4" aria-hidden="true" /> {t("editProfileBtn")}
          </Button>
          {moreMenu("lg")}
        </>
      }
      compactActions={
        <>
          <Button size="sm" onClick={onAddJob}>
            <Plus className="h-4 w-4" aria-hidden="true" /><span className="hidden sm:inline">{t("addJobBtn")}</span>
          </Button>
          {moreMenu("sm")}
        </>
      }
    />
  );
}

// One metric in the overview's Metrics section: a sunken well inside the
// card (not a card in a card), tabular value over a meta label.
function MetricTile({ label, value }) {
  return (
    <div className="flex flex-col-reverse gap-1 rounded-control bg-surface-sunken px-3 py-3">
      <dt className="text-meta font-medium text-muted">{label}</dt>
      <dd className="m-0 text-heading font-bold tabular-nums text-card-foreground">{value}</dd>
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
    return (
      <Card>
        <EmptyState
          variant="no-results"
          icon={Building2}
          title={t("employerNotFoundTitle")}
          description={t("employerNotFoundMessage")}
          action={<Button variant="secondary" onClick={() => navigate("/workforce/employers")}><ArrowLeft className="h-4 w-4" aria-hidden="true" />{t("navEmployers")}</Button>}
        />
      </Card>
    );
  }

  const industries = activeIndustryList(data.customIndustries, data.disabledIndustries);
  const jobDevelopers = activeJobDevelopers(data.profiles);
  const assignedName = (data.profiles || []).find((p) => p.email === record.assignedJobDeveloperEmail);
  const industryMatch = record.industry ? industries.find((i) => i.key === record.industry) : null;
  const industryName = record.industry ? (industryMatch ? industryMatch.en : record.industry) : "";

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

  // The header's "at a glance" strip, from counts the overview already shows.
  const headerFacts = [
    { icon: Briefcase, tone: activeOpeningsCount ? "info" : "neutral", label: t("activeOpeningsLabel"), value: String(activeOpeningsCount) },
    { icon: Users, tone: "violet", label: t("employerTabCandidates"), value: String(totalReferralsCount), hint: totalReferralsCount ? interviewsCount + " " + t("totalInterviewsLabel").toLowerCase() : null },
    { icon: UserCheck, tone: hiresCount ? "success" : "neutral", label: t("totalHiresLabel"), value: String(hiresCount), hint: retentionRate === null ? null : t("retentionRateLabel") + ": " + retentionRate + "%" },
    { icon: CalendarClock, tone: "neutral", label: t("lastMeetingDateLabel"), value: record.lastMeetingDate ? fmtDateLong(record.lastMeetingDate) : t("notSetLabel") }
  ];

  const TAB_COUNTS = {
    jobOpenings: employerOpenings.length, candidates: employerReferrals.length, placements: employerPlacements.length,
    documents: documents.length, activity: activity.length, notes: notes.length
  };
  const tabItems = TAB_KEYS.map((key) => ({ value: key, label: t(TAB_LABEL[key]), count: TAB_COUNTS[key] || null }));

  const addJobAction = <Button size="sm" variant="secondary" onClick={() => setAddingJobOpening(true)}><Plus className="h-4 w-4" aria-hidden="true" />{t("addJobBtn")}</Button>;
  const addActivityAction = <Button size="sm" variant="secondary" onClick={() => setAddingActivity(true)}><Plus className="h-4 w-4" aria-hidden="true" />{t("addActivityBtn")}</Button>;

  return (
    <>
      <EmployerHeader
        record={record} industryName={industryName} facts={headerFacts}
        onBack={() => navigate("/workforce/employers")}
        onAddJob={() => setAddingJobOpening(true)}
        onEditCompany={() => setEditingCompany(true)}
        onEditPartnership={() => setEditingPartnership(true)}
        onAddActivity={() => setAddingActivity(true)}
        onAddNote={() => setAddingNote(true)}
        onUploadDocument={() => setUploadingDocument(true)}
      />

      {/* Summary: where this employer is in the partnership pipeline. */}
      <Card className="mb-6 p-5 sm:p-6">
        <p className="m-0 mb-3 text-meta font-semibold text-muted">{t("partnershipStageLabel")}</p>
        <EmployerPipelineTracker stage={record.partnershipStage} onChange={(s) => updateRecord({ partnershipStage: s })} />
      </Card>

      <Tabs label={t("employerRecordSectionsLabel")} value={tab} onChange={setTab} items={tabItems} idBase={TAB_ID_BASE} className="mb-5" />

      <TabPanel idBase={TAB_ID_BASE} value={tab}>
        {tab === "overview" && (
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,65fr)_minmax(0,35fr)]">
            <div className="flex min-w-0 flex-col gap-6">
              <SectionCard
                title={t("companyInformationLabel")}
                action={<IconButton label={t("editProfileBtn")} onClick={() => setEditingCompany(true)}><Pencil aria-hidden="true" /></IconButton>}
              >
                <dl className="m-0">
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
                </dl>
              </SectionCard>

              <SectionCard title={t("metricsLabel")}>
                <dl className="m-0 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <MetricTile label={t("totalPositionsLabel")} value={totalPositions} />
                  <MetricTile label={t("totalReferralsLabel")} value={totalReferralsCount} />
                  <MetricTile label={t("totalInterviewsLabel")} value={interviewsCount} />
                  <MetricTile label={t("totalHiresLabel")} value={hiresCount} />
                  <MetricTile label={t("retentionRateLabel")} value={retentionRate === null ? "—" : retentionRate + "%"} />
                  <MetricTile label={t("activeOpeningsLabel")} value={activeOpeningsCount} />
                </dl>
              </SectionCard>

              <SectionCard
                title={t("employerTabActivity")}
                action={<Button size="sm" variant="secondary" onClick={() => setTab("activity")}>{t("viewAllBtn")}</Button>}
                flush={activity.length > 0}
              >
                {activity.length === 0 ? <p className="m-0 text-meta text-muted">{t("noActivityYet")}</p> : (
                  <ul className="m-0 list-none p-0">
                    {activity.slice(0, 3).map((a) => (
                      <li key={a.id} className={ROW + " flex items-start justify-between gap-3 py-3"}>
                        <div className="min-w-0">
                          <div className="text-ui font-semibold text-card-foreground">{activityTypeLabel(a.type)}</div>
                          {a.summary ? <div className="mt-0.5 line-clamp-2 break-words text-meta text-muted">{a.summary}</div> : null}
                        </div>
                        <span className="shrink-0 text-meta text-muted tabular-nums">{fmtDateLong(a.date)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </SectionCard>
            </div>

            <div className="flex min-w-0 flex-col gap-6">
              <SectionCard
                title={t("partnershipInformationLabel")}
                action={<IconButton label={t("editPartnershipBtn")} onClick={() => setEditingPartnership(true)}><Pencil aria-hidden="true" /></IconButton>}
              >
                <dl className="m-0">
                  <FieldRow label={t("partnerSinceLabel")} value={fmtDateLong(record.partnerSince)} />
                  <FieldRow label={t("lastMeetingDateLabel")} value={fmtDateLong(record.lastMeetingDate)} />
                  <FieldRow label={t("nextFollowUpDateLabel")} value={fmtDateLong(record.nextFollowUpDate)} />
                  <FieldRow label={t("assignedJobDeveloperLabel")} value={assignedName ? (assignedName.name || assignedName.email) : ""} />
                  <FieldRow label={t("preferredHiringMethodLabel")} value={preferredHiringMethodLabel(record.preferredHiringMethod)} />
                </dl>
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

        {tab === "jobOpenings" && (
          <SectionCard title={t("employerTabJobOpenings")} action={addJobAction} flush>
            {employerOpenings.length === 0 ? (
              <EmptyState
                compact icon={Briefcase} title={t("noJobOpeningsYet")} description={t("employerOpeningsEmptyHint")}
                action={<Button variant="secondary" onClick={() => setAddingJobOpening(true)}><Plus className="h-4 w-4" aria-hidden="true" />{t("addJobBtn")}</Button>}
              />
            ) : (
              <ul className="m-0 list-none p-0">
                {employerOpenings.map((o) => (
                  <li key={o.id} className={ROW_ITEM}>
                    <button type="button" onClick={() => setViewingJobOpening(o)} className={cn(ROW_BUTTON, "flex-wrap")}>
                      <div className="min-w-0">
                        <div className="break-words text-ui font-semibold text-primary">{o.title}</div>
                        <div className="mt-1 text-meta text-muted">
                          {employmentTypeLabel(o.employmentType)}{formatPayRange(o) ? " · " + formatPayRange(o) : ""} · {t("postedDateLabel")} <span className="tabular-nums">{fmtDateLong(o.postedDate)}</span>
                        </div>
                      </div>
                      <StatusBadge domain="opening" status={o.status}>{statusLabel(o.status)}</StatusBadge>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        )}

        {tab === "candidates" && (
          <SectionCard title={t("employerTabCandidates")} flush>
            {employerReferrals.length === 0 ? (
              <EmptyState compact icon={Users} title={t("noReferralsYetLabel")} description={t("employerCandidatesEmptyHint")} />
            ) : (
              <ul className="m-0 list-none p-0">
                {employerReferrals.map((r) => (
                  <li key={r.id} className={ROW + " flex flex-wrap items-center justify-between gap-3"}>
                    <div className="min-w-0">
                      <div className="break-words text-ui font-semibold text-card-foreground">{r.participantName}</div>
                      <div className="mt-0.5 text-meta text-muted">
                        {r.positionTitle} · {t("referralDateLabel")} <span className="tabular-nums">{fmtDateLong(r.referralDate)}</span>
                      </div>
                    </div>
                    <StatusBadge domain="referral" status={r.status}>{referralStageLabel(r.status)}</StatusBadge>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        )}

        {tab === "placements" && (
          <SectionCard title={t("employerTabPlacements")} flush>
            {employerPlacements.length === 0 ? (
              <EmptyState compact icon={UserCheck} title={t("noPlacementsYet")} description={t("employerPlacementsEmptyHint")} />
            ) : (
              <ul className="m-0 list-none p-0">
                {employerPlacements.map((p) => (
                  <li key={p.id} className={ROW_ITEM}>
                    <button type="button" onClick={() => navigate("/workforce/placements/" + p.id)} className={ROW_BUTTON}>
                      <div className="min-w-0">
                        <div className="break-words text-ui font-semibold text-primary">{p.participantName}</div>
                        <div className="mt-0.5 text-meta text-muted">
                          {p.positionTitle} · {t("jobStartDateLabel")} <span className="tabular-nums">{fmtDateLong(p.startDate)}</span>
                        </div>
                      </div>
                      <span className="flex shrink-0 items-center gap-2">
                        <StatusBadge domain="placement" status={p.currentStatus}>{placementStatusLabel(p.currentStatus)}</StatusBadge>
                        <ChevronRight className="h-4 w-4 text-muted" aria-hidden="true" />
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        )}

        {tab === "documents" && (
          <SectionCard
            title={t("clientTabDocuments")}
            action={<Button size="sm" variant="secondary" onClick={() => setUploadingDocument(true)}><UploadCloud className="h-4 w-4" aria-hidden="true" />{t("uploadDocumentBtn")}</Button>}
            flush
          >
            {documents.length === 0 ? (
              <EmptyState compact icon={FileText} title={t("noDocumentsYet")} description={t("employerDocumentsEmptyHint")} />
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

        {tab === "activity" && (
          <SectionCard title={t("employerTabActivity")} action={addActivityAction} flush>
            {activity.length === 0 ? (
              <EmptyState compact icon={CalendarClock} title={t("noActivityYet")} description={t("employerActivityEmptyHint")} />
            ) : (
              <ul className="m-0 list-none p-0">
                {activity.map((a) => (
                  <li key={a.id} className={ROW}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-ui font-semibold text-card-foreground">
                        {activityTypeLabel(a.type)} · <span className="tabular-nums">{fmtDateLong(a.date)}</span>
                      </span>
                      {a.followUpRequired ? <StatusBadge domain="employerActivity" status="followup">{t("followUpRequiredLabel")}</StatusBadge> : null}
                    </div>
                    {a.summary ? <p className="m-0 mt-1.5 max-w-[75ch] whitespace-pre-wrap text-body text-card-foreground">{a.summary}</p> : null}
                    <p className="m-0 mt-1.5 text-meta font-semibold text-muted">— {a.staffName || "—"}</p>
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
      </TabPanel>

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
