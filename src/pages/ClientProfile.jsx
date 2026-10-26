// ClientProfile.jsx -- the unified "one person, one record" Client Profile
// page, fully on Supabase as of Phase 2 (see plans/wobbly-munching-rose.md).
// Reads/writes the master `clients` table; Case Management/Job Developer/
// Food Distribution program detail stays in their own tables (case_clients/
// job_clients/food_clients), each carrying the master's `nbId` directly
// (no separate join table -- see resolveEnrollmentsForClient() in
// masterClients.js). Services and Activity History tabs aggregate real data
// already fetched elsewhere on this page (no new tables): Services reads
// each enrolled program's own service fields (case_clients.services,
// job_clients.servicesProvided, food_distributions, and check-in visits for
// enrolled students); Activity History merges notes/documents/
// communications/appointments/enrollments into one sorted timeline, same
// "aggregate what's already fetched" idiom as the Workforce Dashboard's
// Recent Employer Activity feed (see plans/wobbly-munching-rose.md).
//
// Layout is the design system's record-page template (plans/ui-design-
// system.md §2.4): back + entity header (ClientHeader) -> Tabs -> one
// TabPanel of SectionCards. Every edit is a ui Dialog form.
import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft, Briefcase, CalendarClock, Download, FileText, GraduationCap, MessageCircle, Paperclip, ShoppingBasket,
  StickyNote, Trash2, UserPlus, UserX, Users
} from "lucide-react";
import { useApp, useT } from "../context/AppContext.jsx";
import { apptStatusLabel, meetingWithLabel } from "../lib/appointments.js";
import { caseServiceLabel, immigrationStatusLabel } from "../lib/clients.js";
import { IMMIGRATION_STATUSES } from "../lib/constants.js";
import { jobServiceLabel } from "../lib/jobProfile.js";
import { serviceDisplay } from "../lib/students.js";
import { findClientByNbId, resolveAppointmentsForClient, resolveEnrollmentsForClient } from "../lib/masterClients.js";
import { createStudent } from "../lib/checkinData.js";
import {
  createCaseClient, createClientDocument, createClientNote, createCommunication, createFoodClient, createJobClient,
  deleteClientDocument, fetchClientDocuments, fetchClientNotes, fetchCommunications, fetchDistributions,
  getFileSignedUrl, updateClientRecord, uploadClientFile
} from "../lib/clientsData.js";
import { fmtDateLong } from "../lib/utils.js";
import ClientHeader from "../components/ClientHeader.jsx";
import DatePicker from "../components/DatePicker.jsx";
import IntakeFormCard from "../components/IntakeFormCard.jsx";
import { Alert } from "../components/ui/alert.jsx";
import { DetailRow } from "../components/ui/drawer.jsx";
import { Badge } from "../components/ui/badge.jsx";
import { Button } from "../components/ui/button.jsx";
import { Card } from "../components/ui/card.jsx";
import { Dialog } from "../components/ui/dialog.jsx";
import { EmptyState } from "../components/ui/empty-state.jsx";
import { Field, Input, Select, Textarea } from "../components/ui/field.jsx";
import { IconButton } from "../components/ui/icon-button.jsx";
import { SectionCard } from "../components/ui/section-card.jsx";
import { StatusBadge } from "../components/ui/status-badge.jsx";
import { TabPanel, Tabs } from "../components/ui/tabs.jsx";
import AddressInput from "../components/AddressInput.jsx";

const TABS = [
  "clientTabOverview", "clientTabPrograms", "clientTabAppointments", "clientTabServices",
  "clientTabNotes", "clientTabDocuments", "clientTabCommunications", "clientTabActivity"
];
const TAB_KEYS = ["overview", "programs", "appointments", "services", "notes", "documents", "communications", "activity"];
const TAB_ID_BASE = "client-profile";
const PROGRAM_META = {
  case: { labelKey: "navCaseManagement", icon: Users, path: "/case-management" },
  job: { labelKey: "navJobDeveloper", icon: Briefcase, path: "/workforce/participants" },
  student: { labelKey: "navAdultEducation", icon: GraduationCap, path: "/students" },
  food: { labelKey: "navFoodDistribution", icon: ShoppingBasket, path: "/food" }
};

// One list row inside a flush SectionCard: hairline between rows, card padding.
const ROW = "border-b border-line-subtle px-5 py-4 last:border-b-0 sm:px-6";

function FieldRow({ label, value }) {
  return <DetailRow label={label}>{value || "—"}</DetailRow>;
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
      {submitLabel ? <Button type="submit" loading={saving} disabled={disabled}>{submitLabel}</Button> : null}
    </>
  );
}

function EditProfileModal({ client, onSave, onCancel }) {
  const t = useT();
  const [saving, run] = useSaving();
  const [fields, setFields] = useState({
    firstName: client.firstName || "", lastName: client.lastName || "", phone: client.phone || "", email: client.email || "",
    dob: client.dob || "", street: client.street || "", city: client.city || "", zip: client.zip || "", intakeDate: client.intakeDate || ""
  });
  function setField(name, value) { setFields((prev) => Object.assign({}, prev, { [name]: value })); }

  return (
    <Dialog
      open
      onClose={onCancel}
      title={t("editProfileBtn")}
      size="lg"
      closeLabel={t("closeLabel")}
      as="form"
      panelProps={{ onSubmit: (e) => { e.preventDefault(); run(() => onSave(fields)); } }}
      footer={<DialogFooter onCancel={onCancel} saving={saving} submitLabel={t("saveLabel")} />}
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label={t("firstName")} htmlFor="edit-first-name">
          <Input id="edit-first-name" value={fields.firstName} onChange={(e) => setField("firstName", e.target.value)} autoComplete="off" data-autofocus />
        </Field>
        <Field label={t("lastName")} htmlFor="edit-last-name">
          <Input id="edit-last-name" value={fields.lastName} onChange={(e) => setField("lastName", e.target.value)} autoComplete="off" />
        </Field>
        <Field label={t("phone")} htmlFor="edit-phone">
          <Input id="edit-phone" type="tel" value={fields.phone} onChange={(e) => setField("phone", e.target.value)} autoComplete="off" />
        </Field>
        <Field label={t("email")} htmlFor="edit-email">
          <Input id="edit-email" type="email" value={fields.email} onChange={(e) => setField("email", e.target.value)} autoComplete="off" />
        </Field>
        <Field label={t("dobLabel")} htmlFor="edit-dob">
          <DatePicker id="edit-dob" value={fields.dob} onChange={(v) => setField("dob", v)} />
        </Field>
        <Field label={t("address")} htmlFor="edit-street">
          <AddressInput as={Input} id="edit-street" value={fields.street} onChange={(e) => setField("street", e.target.value)} onAddressSelect={(a) => setFields((prev) => Object.assign({}, prev, { street: a.street, city: a.city || prev.city, zip: a.zip || prev.zip }))} />
        </Field>
        <Field label={t("city")} htmlFor="edit-city">
          <Input id="edit-city" value={fields.city} onChange={(e) => setField("city", e.target.value)} autoComplete="off" />
        </Field>
        <Field label={t("zip")} htmlFor="edit-zip">
          <Input id="edit-zip" inputMode="numeric" value={fields.zip} onChange={(e) => setField("zip", e.target.value)} autoComplete="off" />
        </Field>
      </div>
    </Dialog>
  );
}

function AddToProgramModal({ existingTypes, onEnroll, onCancel }) {
  const t = useT();
  const [saving, run] = useSaving();
  const choices = Object.keys(PROGRAM_META).filter((k) => existingTypes.indexOf(k) === -1);
  const [programType, setProgramType] = useState(choices[0] || "");
  const [immigrationStatus, setImmigrationStatus] = useState("");
  const [workPermit, setWorkPermit] = useState("no");

  return (
    <Dialog
      open
      onClose={onCancel}
      title={t("addToProgramBtn")}
      size="md"
      closeLabel={t("closeLabel")}
      as="form"
      panelProps={{ onSubmit: (e) => { e.preventDefault(); if (choices.length) run(() => onEnroll(programType, { immigrationStatus, workPermit: workPermit === "yes" })); } }}
      footer={<DialogFooter onCancel={onCancel} saving={saving} submitLabel={choices.length > 0 ? t("confirmLabel") : null} />}
    >
      {choices.length === 0 ? (
        <Alert tone="info">{t("alreadyEnrolledAllPrograms")}</Alert>
      ) : (
        <div className="flex flex-col gap-4">
          <Field label={t("clientTabPrograms")} htmlFor="enroll-program">
            <Select id="enroll-program" value={programType} onChange={(e) => setProgramType(e.target.value)} data-autofocus>
              {choices.map((k) => <option key={k} value={k}>{t(PROGRAM_META[k].labelKey)}</option>)}
            </Select>
          </Field>
          {programType === "case" && (
            <Field label={t("immigrationStatusLabel")} htmlFor="enroll-immigration">
              <Select id="enroll-immigration" value={immigrationStatus} onChange={(e) => setImmigrationStatus(e.target.value)}>
                <option value="">{t("pleaseSelect")}</option>
                {IMMIGRATION_STATUSES.map((s) => <option key={s.key} value={s.key}>{immigrationStatusLabel(s.key)}</option>)}
              </Select>
            </Field>
          )}
          {programType === "job" && (
            <Field label={t("workPermitLabel")} htmlFor="enroll-work-permit">
              <Select id="enroll-work-permit" value={workPermit} onChange={(e) => setWorkPermit(e.target.value)}>
                <option value="no">{t("noOption")}</option>
                <option value="yes">{t("yesOption")}</option>
              </Select>
            </Field>
          )}
        </div>
      )}
    </Dialog>
  );
}

function AddNoteModal({ onSave, onCancel }) {
  const t = useT();
  const [saving, run] = useSaving();
  const [content, setContent] = useState("");
  const [type, setType] = useState("general");
  const [visibility, setVisibility] = useState("all");
  return (
    <Dialog
      open
      onClose={onCancel}
      title={t("addNoteBtn")}
      size="md"
      closeLabel={t("closeLabel")}
      as="form"
      panelProps={{ onSubmit: (e) => { e.preventDefault(); if (content.trim()) run(() => onSave({ content, type, visibility })); } }}
      footer={<DialogFooter onCancel={onCancel} saving={saving} disabled={!content.trim()} submitLabel={t("saveLabel")} />}
    >
      <div className="flex flex-col gap-4">
        <Field label={t("noteContentLabel")} htmlFor="note-content" required>
          <Textarea id="note-content" value={content} onChange={(e) => setContent(e.target.value)} rows={4} placeholder={t("phNoteContent")} data-autofocus />
        </Field>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={t("noteTypeLabel")} htmlFor="note-type">
            <Select id="note-type" value={type} onChange={(e) => setType(e.target.value)}>
              <option value="general">{t("noteTypeGeneral")}</option>
              <option value="followup">{t("noteTypeFollowUp")}</option>
              <option value="incident">{t("noteTypeIncident")}</option>
            </Select>
          </Field>
          <Field label={t("noteVisibilityLabel")} htmlFor="note-visibility">
            <Select id="note-visibility" value={visibility} onChange={(e) => setVisibility(e.target.value)}>
              <option value="all">{t("visibilityAll")}</option>
              <option value="department">{t("visibilityDepartment")}</option>
              <option value="private">{t("visibilityPrivate")}</option>
            </Select>
          </Field>
        </div>
      </div>
    </Dialog>
  );
}

function UploadDocumentModal({ onSave, onCancel }) {
  const t = useT();
  const [saving, run] = useSaving();
  const [category, setCategory] = useState("other");
  const [fileName, setFileName] = useState("");
  const fileRef = useRef(null);

  function submit(e) {
    e.preventDefault();
    const file = fileRef.current && fileRef.current.files && fileRef.current.files[0];
    if (!file) return;
    run(() => onSave({ category: category, fileName: file.name, file }));
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
      <div className="flex flex-col gap-4">
        <Field label={t("documentCategoryLabel")} htmlFor="document-category">
          <Select id="document-category" value={category} onChange={(e) => setCategory(e.target.value)} data-autofocus>
            <option value="identification">{t("documentCategoryIdentification")}</option>
            <option value="resume">{t("documentCategoryResume")}</option>
            <option value="immigration">{t("documentCategoryImmigration")}</option>
            <option value="other">{t("documentCategoryOther")}</option>
          </Select>
        </Field>
        <Field label={t("documentFileLabel")} htmlFor="document-file" required>
          <Input
            id="document-file" ref={fileRef} type="file"
            onChange={(e) => setFileName(e.target.files && e.target.files[0] ? e.target.files[0].name : "")}
            className="h-auto py-1.5 file:mr-3 file:cursor-pointer file:rounded-control file:border-0 file:bg-primary-tint file:px-3 file:py-1.5 file:text-ui file:font-semibold file:text-primary [@media(pointer:coarse)]:h-auto"
          />
        </Field>
      </div>
    </Dialog>
  );
}

function LogCommunicationModal({ onSave, onCancel }) {
  const t = useT();
  const [saving, run] = useSaving();
  const [method, setMethod] = useState("phone");
  const [direction, setDirection] = useState("outbound");
  const [summary, setSummary] = useState("");
  const [followUpRequired, setFollowUpRequired] = useState(false);
  return (
    <Dialog
      open
      onClose={onCancel}
      title={t("logCommunicationBtn")}
      size="md"
      closeLabel={t("closeLabel")}
      as="form"
      panelProps={{ onSubmit: (e) => { e.preventDefault(); if (summary.trim()) run(() => onSave({ method, direction, summary, followUpRequired })); } }}
      footer={<DialogFooter onCancel={onCancel} saving={saving} disabled={!summary.trim()} submitLabel={t("saveLabel")} />}
    >
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={t("communicationMethodLabel")} htmlFor="comm-method">
            <Select id="comm-method" value={method} onChange={(e) => setMethod(e.target.value)} data-autofocus>
              <option value="phone">{t("methodPhone")}</option>
              <option value="email">{t("methodEmail")}</option>
              <option value="sms">{t("methodSms")}</option>
              <option value="inperson">{t("methodInPerson")}</option>
            </Select>
          </Field>
          <Field label={t("communicationDirectionLabel")} htmlFor="comm-direction">
            <Select id="comm-direction" value={direction} onChange={(e) => setDirection(e.target.value)}>
              <option value="outbound">{t("directionOutbound")}</option>
              <option value="inbound">{t("directionInbound")}</option>
            </Select>
          </Field>
        </div>
        <Field label={t("communicationSummaryLabel")} htmlFor="comm-summary" required>
          <Textarea id="comm-summary" value={summary} onChange={(e) => setSummary(e.target.value)} rows={3} placeholder={t("phCommunicationSummary")} />
        </Field>
        <label className="m-0 flex cursor-pointer items-center gap-2.5 text-ui font-medium text-card-foreground">
          <input type="checkbox" checked={followUpRequired} onChange={(e) => setFollowUpRequired(e.target.checked)} className="h-4 w-4 cursor-pointer accent-primary" />
          {t("followUpRequiredLabel")}
        </label>
      </div>
    </Dialog>
  );
}

// Documents now live in Supabase Storage (private bucket), not inline
// base64 -- resolves a short-lived signed URL on click.
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
  return <a href="#" onClick={handleClick} aria-busy={loading || undefined} className={className}>{children}</a>;
}

function AppointmentsTab({ appointments, lang, onSchedule }) {
  const t = useT();
  return (
    <SectionCard title={t("clientTabAppointments")} flush>
      {!appointments.length ? (
        <EmptyState
          compact icon={CalendarClock}
          title={t("noAppointmentsYet")}
          description={t(onSchedule ? "clientAppointmentsEmptyHint" : "scheduleAppointmentDisabledTooltip")}
          action={onSchedule ? <Button variant="secondary" onClick={onSchedule}>{t("scheduleAppointmentBtn")}</Button> : null}
        />
      ) : (
        <ul className="m-0 list-none p-0">
          {appointments.map((a) => (
            <li key={a.id} className={ROW + " flex flex-wrap items-start justify-between gap-3"}>
              <div className="min-w-0">
                <div className="text-ui font-semibold text-card-foreground tabular-nums">{fmtDateLong(a.date)}{a.time ? " · " + a.time : ""}</div>
                <div className="mt-0.5 text-meta text-muted">{t("apptWithLabel")}: {meetingWithLabel(a.meetingWith, lang)}{a.reason ? " — " + a.reason : ""}</div>
              </div>
              <StatusBadge domain="appointment" status={a.status}>{apptStatusLabel(a.status, lang)}</StatusBadge>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}

const NOTE_TYPE_KEY = { general: "noteTypeGeneral", followup: "noteTypeFollowUp", incident: "noteTypeIncident" };
const DOCUMENT_CATEGORY_KEY = { identification: "documentCategoryIdentification", resume: "documentCategoryResume", immigration: "documentCategoryImmigration", other: "documentCategoryOther" };
const COMM_METHOD_KEY = { phone: "methodPhone", email: "methodEmail", sms: "methodSms", inperson: "methodInPerson" };
const COMM_DIRECTION_KEY = { outbound: "directionOutbound", inbound: "directionInbound" };

function NotesTab({ notes, onAdd }) {
  const t = useT();
  return (
    <SectionCard title={t("clientTabNotes")} action={<Button size="sm" variant="secondary" onClick={onAdd}>{t("addNoteBtn")}</Button>} flush>
      {!notes.length ? (
        <EmptyState compact icon={StickyNote} title={t("noNotesYet")} description={t("clientNotesEmptyHint")} />
      ) : (
        <ul className="m-0 list-none p-0">
          {notes.map((n) => (
            <li key={n.id} className={ROW}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-ui font-semibold text-card-foreground">
                  {n.staffName || "—"} · <span className="tabular-nums">{fmtDateLong(n.date)}</span>
                </span>
                <Badge variant="neutral">{t(NOTE_TYPE_KEY[n.type] || "noteTypeGeneral")}</Badge>
              </div>
              <p className="m-0 mt-2 max-w-[75ch] whitespace-pre-wrap text-body text-card-foreground">{n.content}</p>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}

function DocumentsTab({ documents, onDelete, onUpload }) {
  const t = useT();
  return (
    <SectionCard title={t("clientTabDocuments")} action={<Button size="sm" variant="secondary" onClick={onUpload}>{t("uploadDocumentBtn")}</Button>} flush>
      {!documents.length ? (
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
                    {t(DOCUMENT_CATEGORY_KEY[d.category] || "documentCategoryOther")} · {t("uploadedByLabel")}: {d.uploadedBy || "—"} · <span className="tabular-nums">{fmtDateLong(d.uploadedAt)}</span>
                  </div>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <StorageDownloadLink
                  path={d.storagePath} fileName={d.fileName}
                  className="inline-flex h-9 items-center gap-1.5 rounded-control px-3 text-ui font-semibold text-primary no-underline transition-colors duration-fast hover:bg-surface-sunken focus-visible:outline-none focus-visible:ring-2 [@media(pointer:coarse)]:h-11"
                >
                  <Download className="h-4 w-4" aria-hidden="true" /> {t("downloadLabel")}
                </StorageDownloadLink>
                <IconButton label={t("deleteLabel") + " " + d.fileName} variant="danger" onClick={() => onDelete(d)}>
                  <Trash2 aria-hidden="true" />
                </IconButton>
              </div>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}

function CommunicationsTab({ communications, onLog }) {
  const t = useT();
  return (
    <SectionCard title={t("clientTabCommunications")} action={<Button size="sm" variant="secondary" onClick={onLog}>{t("logCommunicationBtn")}</Button>} flush>
      {!communications.length ? (
        <EmptyState compact icon={MessageCircle} title={t("noCommunicationsYet")} description={t("clientCommunicationsEmptyHint")} />
      ) : (
        <ul className="m-0 list-none p-0">
          {communications.map((c) => (
            <li key={c.id} className={ROW}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-ui font-semibold text-card-foreground">
                  {t(COMM_METHOD_KEY[c.method] || "methodPhone")} · <span className="tabular-nums">{fmtDateLong(c.date)}</span>
                </span>
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge variant="neutral">{t("communicationDirectionLabel")}: {t(COMM_DIRECTION_KEY[c.direction] || "directionOutbound")}</Badge>
                  {c.followUpRequired && <StatusBadge domain="communication" status="followup">{t("followUpRequiredLabel")}</StatusBadge>}
                </div>
              </div>
              <p className="m-0 mt-2 max-w-[75ch] whitespace-pre-wrap text-body text-card-foreground">{c.summary}</p>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}

function OverviewTab({ client, onEdit }) {
  const t = useT();
  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
      <SectionCard
        title={t("personalInformationLabel")}
        action={<Button size="sm" variant="secondary" onClick={onEdit}>{t("editProfileBtn")}</Button>}
      >
        <dl className="m-0">
          <FieldRow label={t("dobLabel")} value={<span className="tabular-nums">{fmtDateLong(client.dob)}</span>} />
          <FieldRow label={t("phone")} value={client.phone ? <span className="tabular-nums">{client.phone}</span> : ""} />
          <FieldRow label={t("email")} value={client.email} />
          <FieldRow label={t("address")} value={[client.street, client.city, client.zip].filter(Boolean).join(", ")} />
          <FieldRow label={t("intakeDateLabel")} value={<span className="tabular-nums">{fmtDateLong(client.intakeDate)}</span>} />
        </dl>
      </SectionCard>
    </div>
  );
}

function enrollmentStatusLabel(status, t) {
  if (status === "active") return t("statusActive");
  if (status === "inactive") return t("statusInactive");
  return status;
}

function ProgramsTab({ enrollments, lang, onAdd }) {
  const t = useT();
  const navigate = useNavigate();
  if (!enrollments.length) {
    return (
      <Card>
        <EmptyState
          compact icon={UserPlus}
          title={t("noProgramsYet")}
          description={t("clientProgramsEmptyHint")}
          action={<Button onClick={onAdd}>{t("addToProgramBtn")}</Button>}
        />
      </Card>
    );
  }
  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
      {enrollments.map(({ enrollment, programType, record }) => {
        const meta = PROGRAM_META[programType];
        const Icon = meta.icon;
        return (
          <SectionCard
            key={enrollment.id}
            title={
              <span className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-chip bg-tone-info-bg text-tone-info-ink">
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </span>
                {t(meta.labelKey)}
              </span>
            }
            action={<StatusBadge domain="enrollment" status={enrollment.status}>{enrollmentStatusLabel(enrollment.status, t)}</StatusBadge>}
            footer={<Button size="sm" variant="secondary" onClick={() => navigate(meta.path)}>{t("openProgramRecordBtn")}</Button>}
          >
            <dl className="m-0">
              <FieldRow label={t("intakeDateLabel")} value={<span className="tabular-nums">{fmtDateLong(enrollment.enrolledAt)}</span>} />
              {programType === "case" && <FieldRow label={t("immigrationStatusLabel")} value={immigrationStatusLabel(record.immigrationStatus, lang)} />}
              {programType === "job" && <FieldRow label={t("workPermitLabel")} value={record.workPermit ? t("yesOption") : t("noOption")} />}
              {programType === "student" && <FieldRow label={t("studentIdLabel")} value={record.studentId ? <span className="tabular-nums">{record.studentId}</span> : ""} />}
              {programType === "food" && <FieldRow label={t("householdSizeLabel")} value={record.householdSize ? <span className="tabular-nums">{record.householdSize}</span> : ""} />}
            </dl>
          </SectionCard>
        );
      })}
    </div>
  );
}

function ServicesSection({ title, icon: Icon, children }) {
  return (
    <SectionCard
      title={
        <span className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-chip bg-tone-info-bg text-tone-info-ink">
            <Icon className="h-4 w-4" aria-hidden="true" />
          </span>
          {title}
        </span>
      }
    >
      {children}
    </SectionCard>
  );
}

function ServicesEmptyLine({ children }) {
  return <p className="m-0 text-ui text-muted">{children}</p>;
}

function ServicesTab({ enrollments, visits, customServices, lang, onAddToProgram }) {
  const t = useT();
  const caseEnrollment = enrollments.find((e) => e.programType === "case");
  const jobEnrollment = enrollments.find((e) => e.programType === "job");
  const foodEnrollment = enrollments.find((e) => e.programType === "food");
  const studentEnrollment = enrollments.find((e) => e.programType === "student");
  const foodClientId = foodEnrollment && foodEnrollment.record.id;

  const [distributions, setDistributions] = useState([]);
  useEffect(() => {
    let cancelled = false;
    if (!foodClientId) { setDistributions([]); return undefined; }
    fetchDistributions(foodClientId).then((rows) => { if (!cancelled) setDistributions(rows); });
    return () => { cancelled = true; };
  }, [foodClientId]);

  if (!caseEnrollment && !jobEnrollment && !foodEnrollment && !studentEnrollment) {
    return (
      <Card>
        <EmptyState
          compact icon={Briefcase}
          title={t("noServicesYet")}
          description={t("clientServicesEmptyHint")}
          action={<Button variant="secondary" onClick={onAddToProgram}>{t("addToProgramBtn")}</Button>}
        />
      </Card>
    );
  }

  const studentVisits = studentEnrollment
    ? visits.filter((v) => v.studentId === studentEnrollment.record.id).sort((a, b) => new Date(b.timeIn) - new Date(a.timeIn))
    : [];

  return (
    <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-2">
      {caseEnrollment && (
        <ServicesSection title={t(PROGRAM_META.case.labelKey)} icon={Users}>
          {caseEnrollment.record.services && caseEnrollment.record.services.length ? (
            <div className="flex flex-wrap gap-1.5">
              {caseEnrollment.record.services.map((key) => <Badge key={key} variant="neutral">{caseServiceLabel(key, lang)}</Badge>)}
            </div>
          ) : <ServicesEmptyLine>{t("noCaseServicesRecorded")}</ServicesEmptyLine>}
        </ServicesSection>
      )}
      {jobEnrollment && (
        <ServicesSection title={t(PROGRAM_META.job.labelKey)} icon={Briefcase}>
          {jobEnrollment.record.servicesProvided && jobEnrollment.record.servicesProvided.length ? (
            <div className="flex flex-wrap gap-1.5">
              {jobEnrollment.record.servicesProvided.map((key) => <Badge key={key} variant="neutral">{jobServiceLabel(key)}</Badge>)}
            </div>
          ) : <ServicesEmptyLine>{t("noJobServicesRecorded")}</ServicesEmptyLine>}
        </ServicesSection>
      )}
      {foodEnrollment && (
        <ServicesSection title={t(PROGRAM_META.food.labelKey)} icon={ShoppingBasket}>
          {distributions.length ? (
            <ul className="m-0 list-none p-0">
              {distributions.map((d) => (
                <li key={d.id} className="flex items-start justify-between gap-3 border-b border-line-subtle py-2.5 text-ui last:border-b-0">
                  <span className="shrink-0 font-semibold text-card-foreground tabular-nums">{fmtDateLong(d.date)}</span>
                  <span className="min-w-0 text-right text-muted">{d.items}{d.quantity ? " · " + d.quantity : ""}</span>
                </li>
              ))}
            </ul>
          ) : <ServicesEmptyLine>{t("noDistributionsYet")}</ServicesEmptyLine>}
        </ServicesSection>
      )}
      {studentEnrollment && (
        <ServicesSection title={t(PROGRAM_META.student.labelKey)} icon={GraduationCap}>
          {studentVisits.length ? (
            <ul className="m-0 list-none p-0">
              {studentVisits.map((v) => (
                <li key={v.id} className="flex items-start justify-between gap-3 border-b border-line-subtle py-2.5 text-ui last:border-b-0">
                  <span className="shrink-0 font-semibold text-card-foreground tabular-nums">{fmtDateLong(v.date)}</span>
                  <span className="min-w-0 text-right text-muted">{serviceDisplay(v, customServices, lang)}</span>
                </li>
              ))}
            </ul>
          ) : <ServicesEmptyLine>{t("noClassVisitsYet")}</ServicesEmptyLine>}
        </ServicesSection>
      )}
    </div>
  );
}

function ActivityTab({ enrollments, notes, documents, communications, appointments, lang }) {
  const t = useT();
  const events = []
    .concat(enrollments.map((e) => ({
      key: "enroll-" + e.enrollment.id, date: e.enrollment.enrolledAt, icon: UserPlus,
      label: t("activityEnrolledIn") + " " + t(PROGRAM_META[e.programType].labelKey)
    })))
    .concat(notes.map((n) => ({
      key: "note-" + n.id, date: n.date, icon: StickyNote,
      label: t("activityNoteAdded") + (n.staffName ? " — " + n.staffName : "")
    })))
    .concat(documents.map((d) => ({
      key: "doc-" + d.id, date: d.uploadedAt, icon: FileText,
      label: t("activityDocumentUploaded") + ": " + d.fileName
    })))
    .concat(communications.map((c) => ({
      key: "comm-" + c.id, date: c.date, icon: MessageCircle,
      label: t("activityCommunicationLogged") + " (" + t(COMM_METHOD_KEY[c.method] || "methodPhone") + ")"
    })))
    .concat(appointments.map((a) => ({
      key: "appt-" + a.id, date: a.date, icon: CalendarClock,
      label: t("activityAppointmentLabel") + " — " + apptStatusLabel(a.status, lang)
    })))
    .filter((e) => e.date)
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  return (
    <SectionCard title={t("clientTabActivity")} flush>
      {!events.length ? (
        <EmptyState compact icon={CalendarClock} title={t("noActivityYet")} description={t("clientActivityEmptyHint")} />
      ) : (
        <ol className="m-0 list-none p-0">
          {events.map((e) => {
            const Icon = e.icon;
            return (
              <li key={e.key} className={ROW + " flex items-center gap-3 py-3"}>
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-chip bg-tone-info-bg text-tone-info-ink">
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1 break-words text-ui font-medium text-card-foreground">{e.label}</span>
                <span className="shrink-0 text-meta text-muted tabular-nums">{fmtDateLong(e.date)}</span>
              </li>
            );
          })}
        </ol>
      )}
    </SectionCard>
  );
}

export default function ClientProfile() {
  const { nbId } = useParams();
  const { data, lang, session, refetchStudents, requestConfirm, showToast } = useApp();
  const t = useT();
  const navigate = useNavigate();
  const canUseIntakeForm = !!session && (session.role === "administrator" || session.role === "case_manager");
  const tabKeys = canUseIntakeForm ? TAB_KEYS.concat(["intake"]) : TAB_KEYS;
  const tabLabels = canUseIntakeForm ? TABS.concat(["clientTabIntakeForm"]) : TABS;
  const [tab, setTab] = useState("overview");
  const [editing, setEditing] = useState(false);
  const [addingToProgram, setAddingToProgram] = useState(false);
  const [addingNote, setAddingNote] = useState(false);
  const [uploadingDocument, setUploadingDocument] = useState(false);
  const [loggingCommunication, setLoggingCommunication] = useState(false);
  // Notes/documents/communications are fetched per-client on demand now
  // (their own tables -- see plans/wobbly-munching-rose.md) rather than
  // held in global AppContext state.
  const [notes, setNotes] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [communications, setCommunications] = useState([]);

  const client = findClientByNbId(nbId, data);
  const clientId = client && client.id;

  useEffect(() => {
    let cancelled = false;
    if (!clientId) { setNotes([]); setDocuments([]); setCommunications([]); return; }
    fetchClientNotes(clientId).then((rows) => { if (!cancelled) setNotes(rows); });
    fetchClientDocuments(clientId).then((rows) => { if (!cancelled) setDocuments(rows); });
    fetchCommunications(clientId).then((rows) => { if (!cancelled) setCommunications(rows); });
    return () => { cancelled = true; };
  }, [clientId]);

  // Back to wherever staff opened the profile from (a program list, the
  // duplicate warning, search); a direct link with no in-app history goes home.
  function goBack() {
    if (window.history.state && window.history.state.idx > 0) navigate(-1);
    else navigate("/");
  }

  if (!client) {
    return (
      <Card>
        <EmptyState
          variant="no-results"
          icon={UserX}
          title={t("clientNotFoundTitle")}
          description={t("clientNotFoundMessage")}
          action={<Button variant="secondary" onClick={goBack}><ArrowLeft className="h-4 w-4" aria-hidden="true" />{t("back")}</Button>}
        />
      </Card>
    );
  }

  const enrollments = resolveEnrollmentsForClient(nbId, data);
  const name = (client.firstName + " " + client.lastName).trim();
  const existingTypes = enrollments.map((e) => e.programType);
  const appointments = resolveAppointmentsForClient(nbId, data);
  const schedulingProgram = enrollments.find((e) => e.programType === "case" || e.programType === "job");
  const scheduleAppointment = schedulingProgram
    ? () => navigate(PROGRAM_META[schedulingProgram.programType].path, { state: { openAppointments: true, appointmentClientId: schedulingProgram.record.id } })
    : undefined;

  const TAB_COUNTS = {
    programs: enrollments.length, appointments: appointments.length, notes: notes.length,
    documents: documents.length, communications: communications.length
  };
  const tabItems = tabKeys.map((key, i) => ({ value: key, label: t(tabLabels[i]), count: TAB_COUNTS[key] || null }));

  async function saveProfile(fields) {
    await updateClientRecord(client.id, fields);
    setEditing(false);
  }

  async function toggleStatus() {
    await updateClientRecord(client.id, { status: client.status === "inactive" ? "active" : "inactive" });
  }

  async function enrollInProgram(programType, extra) {
    const base = { firstName: client.firstName, lastName: client.lastName, phone: client.phone, email: client.email, intakeDate: client.intakeDate, street: client.street, city: client.city, zip: client.zip };
    if (programType === "case") {
      await createCaseClient(base, Object.assign({}, base, { immigrationStatus: extra.immigrationStatus || "", dob: client.dob || "" }), client.id);
    } else if (programType === "job") {
      await createJobClient(base, Object.assign({}, base, { workPermit: !!extra.workPermit, hasResume: false }), client.id);
    } else if (programType === "food") {
      await createFoodClient(base, base, client.id);
    } else if (programType === "student") {
      await createStudent(Object.assign({}, base, { clientId: client.id, classKey: null, active: true }));
      refetchStudents();
    }
    setAddingToProgram(false);
  }

  async function addNote(fields) {
    // Unified profile isn't scoped to one program (unlike JobClientProfile's
    // "job"-department notes) -- department defaults to "general" so a note
    // added here shows up regardless of which programs this client is
    // enrolled in.
    const created = await createClientNote(client.id, fields);
    setNotes((prev) => [created].concat(prev));
    setAddingNote(false);
  }

  async function uploadDocument(fields) {
    const path = await uploadClientFile(client.id, fields.file);
    const created = await createClientDocument(client.id, { fileName: fields.fileName, category: fields.category, storagePath: path });
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

  async function logCommunication(fields) {
    const created = await createCommunication(client.id, fields);
    setCommunications((prev) => [created].concat(prev));
    setLoggingCommunication(false);
  }

  return (
    <>
      <ClientHeader
        client={client} name={name}
        onBack={goBack}
        onEditProfile={() => setEditing(true)}
        onAddToProgram={() => setAddingToProgram(true)}
        onScheduleAppointment={scheduleAppointment}
        onAddNote={() => setAddingNote(true)}
        onUploadDocument={() => setUploadingDocument(true)}
        onToggleStatus={toggleStatus}
      />

      <Tabs label={t("clientRecordSectionsLabel")} value={tab} onChange={setTab} items={tabItems} idBase={TAB_ID_BASE} className="mb-5" />

      <TabPanel idBase={TAB_ID_BASE} value={tab}>
        {tab === "overview" && <OverviewTab client={client} onEdit={() => setEditing(true)} />}
        {tab === "programs" && <ProgramsTab enrollments={enrollments} lang={lang} onAdd={() => setAddingToProgram(true)} />}
        {tab === "appointments" && <AppointmentsTab appointments={appointments} lang={lang} onSchedule={scheduleAppointment} />}
        {tab === "notes" && <NotesTab notes={notes} onAdd={() => setAddingNote(true)} />}
        {tab === "documents" && <DocumentsTab documents={documents} onDelete={deleteDocument} onUpload={() => setUploadingDocument(true)} />}
        {tab === "communications" && <CommunicationsTab communications={communications} onLog={() => setLoggingCommunication(true)} />}
        {tab === "intake" && canUseIntakeForm && <IntakeFormCard bare client={client} />}
        {tab === "services" && (
          <ServicesTab
            enrollments={enrollments} visits={data.visits || []} customServices={data.customServices} lang={lang}
            onAddToProgram={() => setAddingToProgram(true)}
          />
        )}
        {tab === "activity" && (
          <ActivityTab
            enrollments={enrollments} notes={notes} documents={documents}
            communications={communications} appointments={appointments} lang={lang}
          />
        )}
      </TabPanel>

      {editing && <EditProfileModal client={client} onSave={saveProfile} onCancel={() => setEditing(false)} />}
      {addingToProgram && <AddToProgramModal existingTypes={existingTypes} onEnroll={enrollInProgram} onCancel={() => setAddingToProgram(false)} />}
      {addingNote && <AddNoteModal onSave={addNote} onCancel={() => setAddingNote(false)} />}
      {uploadingDocument && <UploadDocumentModal onSave={uploadDocument} onCancel={() => setUploadingDocument(false)} />}
      {loggingCommunication && <LogCommunicationModal onSave={logCommunication} onCancel={() => setLoggingCommunication(false)} />}
    </>
  );
}
