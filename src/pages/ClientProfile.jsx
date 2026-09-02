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
import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Briefcase, CalendarClock, Download, FileText, GraduationCap, MessageCircle, Paperclip, ShoppingBasket,
  StickyNote, Trash2, UserPlus, Users
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
import { Badge } from "../components/ui/badge.jsx";
import { Button } from "../components/ui/button.jsx";
import { Card, CardContent } from "../components/ui/card.jsx";

const TABS = [
  "clientTabOverview", "clientTabPrograms", "clientTabAppointments", "clientTabServices",
  "clientTabNotes", "clientTabDocuments", "clientTabCommunications", "clientTabActivity"
];
const TAB_KEYS = ["overview", "programs", "appointments", "services", "notes", "documents", "communications", "activity"];
const PROGRAM_META = {
  case: { labelKey: "navCaseManagement", icon: Users, path: "/casemanagement" },
  job: { labelKey: "navJobDeveloper", icon: Briefcase, path: "/jobdeveloper" },
  student: { labelKey: "navStudents", icon: GraduationCap, path: "/students" },
  food: { labelKey: "navFoodDistribution", icon: ShoppingBasket, path: "/fooddistribution" }
};

function FieldRow({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border py-2 text-sm last:border-b-0">
      <span className="text-muted">{label}</span>
      <span className="font-semibold text-card-foreground">{value || "—"}</span>
    </div>
  );
}

function TextField({ id, label, value, onChange, placeholder, type }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-xs font-semibold text-card-foreground">{label}</label>
      <input
        id={id} type={type || "text"} value={value} onChange={onChange} placeholder={placeholder}
        className="h-11 min-h-0 w-full rounded-lg border border-border bg-background px-3 text-sm text-card-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
      />
    </div>
  );
}

function EditProfileModal({ client, onSave, onCancel }) {
  const t = useT();
  const [fields, setFields] = useState({
    firstName: client.firstName || "", lastName: client.lastName || "", phone: client.phone || "", email: client.email || "",
    dob: client.dob || "", street: client.street || "", city: client.city || "", zip: client.zip || "", intakeDate: client.intakeDate || ""
  });
  function setField(name, value) { setFields((prev) => Object.assign({}, prev, { [name]: value })); }

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="modal-box max-w-xl" role="dialog" aria-modal="true">
        <p className="mb-4 text-base font-bold text-card-foreground">{t("editProfileBtn")}</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <TextField id="edit-first-name" label={t("firstName")} value={fields.firstName} onChange={(e) => setField("firstName", e.target.value)} />
          <TextField id="edit-last-name" label={t("lastName")} value={fields.lastName} onChange={(e) => setField("lastName", e.target.value)} />
          <TextField id="edit-phone" label={t("phone")} value={fields.phone} onChange={(e) => setField("phone", e.target.value)} />
          <TextField id="edit-email" label={t("email")} value={fields.email} onChange={(e) => setField("email", e.target.value)} />
          <div>
            <label htmlFor="edit-dob" className="mb-1 block text-xs font-semibold text-card-foreground">{t("dobLabel")}</label>
            <DatePicker id="edit-dob" value={fields.dob} onChange={(v) => setField("dob", v)} />
          </div>
          <TextField id="edit-street" label={t("address")} value={fields.street} onChange={(e) => setField("street", e.target.value)} />
          <TextField id="edit-city" label={t("city")} value={fields.city} onChange={(e) => setField("city", e.target.value)} />
          <TextField id="edit-zip" label={t("zip")} value={fields.zip} onChange={(e) => setField("zip", e.target.value)} />
        </div>
        <div className="flex justify-end gap-2" style={{ marginTop: 16 }}>
          <Button type="button" variant="secondary" onClick={onCancel}>{t("cancelLabel")}</Button>
          <Button onClick={() => onSave(fields)}>{t("saveLabel")}</Button>
        </div>
      </div>
    </div>
  );
}

function AddToProgramModal({ existingTypes, onEnroll, onCancel }) {
  const t = useT();
  const choices = Object.keys(PROGRAM_META).filter((k) => existingTypes.indexOf(k) === -1);
  const [programType, setProgramType] = useState(choices[0] || "");
  const [immigrationStatus, setImmigrationStatus] = useState("");
  const [workPermit, setWorkPermit] = useState("no");

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="modal-box max-w-lg" role="dialog" aria-modal="true">
        <p className="mb-4 text-base font-bold text-card-foreground">{t("addToProgramBtn")}</p>
        {choices.length === 0 ? (
          <p className="text-sm text-muted">{t("alreadyEnrolledAllPrograms")}</p>
        ) : (
          <>
            <div className="mb-4">
              <label className="mb-1 block text-xs font-semibold text-card-foreground">{t("clientTabPrograms")}</label>
              <select
                value={programType}
                onChange={(e) => setProgramType(e.target.value)}
                className="h-11 min-h-0 w-full rounded-lg border border-border bg-background px-3 text-sm text-card-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
              >
                {choices.map((k) => <option key={k} value={k}>{t(PROGRAM_META[k].labelKey)}</option>)}
              </select>
            </div>
            {programType === "case" && (
              <div className="mb-4">
                <label className="mb-1 block text-xs font-semibold text-card-foreground">{t("immigrationStatusLabel")}</label>
                <select
                  value={immigrationStatus}
                  onChange={(e) => setImmigrationStatus(e.target.value)}
                  className="h-11 min-h-0 w-full rounded-lg border border-border bg-background px-3 text-sm text-card-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
                >
                  <option value="">{t("pleaseSelect")}</option>
                  {IMMIGRATION_STATUSES.map((s) => <option key={s.key} value={s.key}>{immigrationStatusLabel(s.key)}</option>)}
                </select>
              </div>
            )}
            {programType === "job" && (
              <div className="mb-4">
                <label className="mb-1 block text-xs font-semibold text-card-foreground">{t("workPermitLabel")}</label>
                <select
                  value={workPermit}
                  onChange={(e) => setWorkPermit(e.target.value)}
                  className="h-11 min-h-0 w-full rounded-lg border border-border bg-background px-3 text-sm text-card-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
                >
                  <option value="no">{t("noOption")}</option>
                  <option value="yes">{t("yesOption")}</option>
                </select>
              </div>
            )}
          </>
        )}
        <div className="pill-row" style={{ justifyContent: "flex-end", marginTop: 16, marginBottom: 0 }}>
          <button type="button" className="btn-secondary" onClick={onCancel}>{t("cancelLabel")}</button>
          {choices.length > 0 && (
            <Button onClick={() => onEnroll(programType, { immigrationStatus, workPermit: workPermit === "yes" })}>{t("confirmLabel")}</Button>
          )}
        </div>
      </div>
    </div>
  );
}

function AddNoteModal({ onSave, onCancel }) {
  const t = useT();
  const [content, setContent] = useState("");
  const [type, setType] = useState("general");
  const [visibility, setVisibility] = useState("all");
  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="modal-box max-w-lg" role="dialog" aria-modal="true">
        <p className="mb-4 text-base font-bold text-card-foreground">{t("addNoteBtn")}</p>
        <div className="mb-3">
          <label className="mb-1 block text-xs font-semibold text-card-foreground">{t("noteContentLabel")}</label>
          <textarea
            value={content} onChange={(e) => setContent(e.target.value)} rows={4}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-card-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
          />
        </div>
        <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-semibold text-card-foreground">{t("noteTypeLabel")}</label>
            <select value={type} onChange={(e) => setType(e.target.value)} className="h-11 min-h-0 w-full rounded-lg border border-border bg-background px-3 text-sm text-card-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15">
              <option value="general">{t("noteTypeGeneral")}</option>
              <option value="followup">{t("noteTypeFollowUp")}</option>
              <option value="incident">{t("noteTypeIncident")}</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-card-foreground">{t("noteVisibilityLabel")}</label>
            <select value={visibility} onChange={(e) => setVisibility(e.target.value)} className="h-11 min-h-0 w-full rounded-lg border border-border bg-background px-3 text-sm text-card-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15">
              <option value="all">{t("visibilityAll")}</option>
              <option value="department">{t("visibilityDepartment")}</option>
              <option value="private">{t("visibilityPrivate")}</option>
            </select>
          </div>
        </div>
        <div className="pill-row" style={{ justifyContent: "flex-end", marginTop: 8, marginBottom: 0 }}>
          <button type="button" className="btn-secondary" onClick={onCancel}>{t("cancelLabel")}</button>
          <Button disabled={!content.trim()} onClick={() => onSave({ content, type, visibility })}>{t("saveLabel")}</Button>
        </div>
      </div>
    </div>
  );
}

function UploadDocumentModal({ onSave, onCancel }) {
  const t = useT();
  const [category, setCategory] = useState("other");
  const [fileName, setFileName] = useState("");
  const fileRef = useRef(null);

  function submit() {
    const file = fileRef.current && fileRef.current.files && fileRef.current.files[0];
    if (!file) return;
    onSave({ category: category, fileName: file.name, file });
  }

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="modal-box max-w-lg" role="dialog" aria-modal="true">
        <p className="mb-4 text-base font-bold text-card-foreground">{t("uploadDocumentBtn")}</p>
        <div className="mb-3">
          <label className="mb-1 block text-xs font-semibold text-card-foreground">{t("documentCategoryLabel")}</label>
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="h-11 min-h-0 w-full rounded-lg border border-border bg-background px-3 text-sm text-card-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15">
            <option value="identification">{t("documentCategoryIdentification")}</option>
            <option value="resume">{t("documentCategoryResume")}</option>
            <option value="immigration">{t("documentCategoryImmigration")}</option>
            <option value="other">{t("documentCategoryOther")}</option>
          </select>
        </div>
        <div className="mb-3">
          <label className="mb-1 block text-xs font-semibold text-card-foreground">{t("documentFileLabel")}</label>
          <input
            ref={fileRef} type="file" onChange={(e) => setFileName(e.target.files && e.target.files[0] ? e.target.files[0].name : "")}
            className="block w-full text-sm text-card-foreground file:mr-3 file:rounded-lg file:border-0 file:bg-primary-tint file:px-3 file:py-2 file:text-sm file:font-semibold file:text-primary"
          />
        </div>
        <div className="pill-row" style={{ justifyContent: "flex-end", marginTop: 8, marginBottom: 0 }}>
          <button type="button" className="btn-secondary" onClick={onCancel}>{t("cancelLabel")}</button>
          <Button disabled={!fileName} onClick={submit}>{t("saveLabel")}</Button>
        </div>
      </div>
    </div>
  );
}

function LogCommunicationModal({ onSave, onCancel }) {
  const t = useT();
  const [method, setMethod] = useState("phone");
  const [direction, setDirection] = useState("outbound");
  const [summary, setSummary] = useState("");
  const [followUpRequired, setFollowUpRequired] = useState(false);
  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="modal-box max-w-lg" role="dialog" aria-modal="true">
        <p className="mb-4 text-base font-bold text-card-foreground">{t("logCommunicationBtn")}</p>
        <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-semibold text-card-foreground">{t("communicationMethodLabel")}</label>
            <select value={method} onChange={(e) => setMethod(e.target.value)} className="h-11 min-h-0 w-full rounded-lg border border-border bg-background px-3 text-sm text-card-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15">
              <option value="phone">{t("methodPhone")}</option>
              <option value="email">{t("methodEmail")}</option>
              <option value="sms">{t("methodSms")}</option>
              <option value="inperson">{t("methodInPerson")}</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-card-foreground">{t("communicationDirectionLabel")}</label>
            <select value={direction} onChange={(e) => setDirection(e.target.value)} className="h-11 min-h-0 w-full rounded-lg border border-border bg-background px-3 text-sm text-card-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15">
              <option value="outbound">{t("directionOutbound")}</option>
              <option value="inbound">{t("directionInbound")}</option>
            </select>
          </div>
        </div>
        <div className="mb-3">
          <label className="mb-1 block text-xs font-semibold text-card-foreground">{t("communicationSummaryLabel")}</label>
          <textarea
            value={summary} onChange={(e) => setSummary(e.target.value)} rows={3}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-card-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
          />
        </div>
        <label className="mb-3 flex items-center gap-2 text-sm font-medium text-card-foreground">
          <input type="checkbox" checked={followUpRequired} onChange={(e) => setFollowUpRequired(e.target.checked)} className="h-4 w-4" />
          {t("followUpRequiredLabel")}
        </label>
        <div className="pill-row" style={{ justifyContent: "flex-end", marginTop: 8, marginBottom: 0 }}>
          <button type="button" className="btn-secondary" onClick={onCancel}>{t("cancelLabel")}</button>
          <Button disabled={!summary.trim()} onClick={() => onSave({ method, direction, summary, followUpRequired })}>{t("saveLabel")}</Button>
        </div>
      </div>
    </div>
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
  return <a href="#" onClick={handleClick} className={className}>{children}</a>;
}

function AppointmentsTab({ appointments, lang }) {
  const t = useT();
  if (!appointments.length) return <p className="py-8 text-center text-sm text-muted">{t("noAppointmentsYet")}</p>;
  return (
    <div className="space-y-2">
      {appointments.map((a) => (
        <Card key={a.id}><CardContent className="flex flex-wrap items-center justify-between gap-2 p-4">
          <div>
            <div className="text-sm font-bold text-card-foreground">{fmtDateLong(a.date)} {a.time ? "· " + a.time : ""}</div>
            <div className="mt-0.5 text-sm text-muted">{t("apptWithLabel")}: {meetingWithLabel(a.meetingWith, lang)}{a.reason ? " — " + a.reason : ""}</div>
          </div>
          <Badge variant={a.status === "cancelled" ? "neutral" : a.status === "completed" ? "success" : "default"}>{apptStatusLabel(a.status, lang)}</Badge>
        </CardContent></Card>
      ))}
    </div>
  );
}

const NOTE_TYPE_KEY = { general: "noteTypeGeneral", followup: "noteTypeFollowUp", incident: "noteTypeIncident" };
const DOCUMENT_CATEGORY_KEY = { identification: "documentCategoryIdentification", resume: "documentCategoryResume", immigration: "documentCategoryImmigration", other: "documentCategoryOther" };
const COMM_METHOD_KEY = { phone: "methodPhone", email: "methodEmail", sms: "methodSms", inperson: "methodInPerson" };
const COMM_DIRECTION_KEY = { outbound: "directionOutbound", inbound: "directionInbound" };

function NotesTab({ notes }) {
  const t = useT();
  if (!notes.length) return <p className="py-8 text-center text-sm text-muted">{t("noNotesYet")}</p>;
  return (
    <div className="space-y-2">
      {notes.map((n) => (
        <Card key={n.id}><CardContent className="p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-bold text-card-foreground">{n.staffName || "—"} · {fmtDateLong(n.date)}</span>
            <Badge variant="neutral">{t(NOTE_TYPE_KEY[n.type] || "noteTypeGeneral")}</Badge>
          </div>
          <p className="mt-2 text-sm text-card-foreground">{n.content}</p>
        </CardContent></Card>
      ))}
    </div>
  );
}

function DocumentsTab({ documents, onDelete }) {
  const t = useT();
  if (!documents.length) return <p className="py-8 text-center text-sm text-muted">{t("noDocumentsYet")}</p>;
  return (
    <div className="space-y-2">
      {documents.map((d) => (
        <Card key={d.id}><CardContent className="flex flex-wrap items-center justify-between gap-2 p-4">
          <div className="flex items-center gap-2">
            <Paperclip className="h-4 w-4 text-primary" />
            <div>
              <div className="text-sm font-bold text-card-foreground">{d.fileName}</div>
              <div className="text-xs text-muted">{t(DOCUMENT_CATEGORY_KEY[d.category] || "documentCategoryOther")} · {t("uploadedByLabel")}: {d.uploadedBy || "—"} · {fmtDateLong(d.uploadedAt)}</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <StorageDownloadLink path={d.storagePath} fileName={d.fileName} className="flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
              <Download className="h-3.5 w-3.5" /> {t("downloadLabel")}
            </StorageDownloadLink>
            <button
              type="button"
              title={t("deleteLabel")}
              onClick={() => onDelete(d)}
              className="flex h-8 w-8 min-h-0 items-center justify-center rounded-lg border-0 bg-transparent p-0 text-muted hover:bg-background hover:text-accent"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </CardContent></Card>
      ))}
    </div>
  );
}

function CommunicationsTab({ communications, onLog }) {
  const t = useT();
  return (
    <div>
      <div className="mb-3 flex justify-end">
        <Button size="sm" onClick={onLog}>{t("logCommunicationBtn")}</Button>
      </div>
      {!communications.length ? (
        <p className="py-8 text-center text-sm text-muted">{t("noCommunicationsYet")}</p>
      ) : (
        <div className="space-y-2">
          {communications.map((c) => (
            <Card key={c.id}><CardContent className="p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-bold text-card-foreground">{t(COMM_METHOD_KEY[c.method] || "methodPhone")} · {fmtDateLong(c.date)}</span>
                <div className="flex items-center gap-1.5">
                  <Badge variant="neutral">{t("communicationDirectionLabel")}: {t(COMM_DIRECTION_KEY[c.direction] || "directionOutbound")}</Badge>
                  {c.followUpRequired && <Badge variant="warn">{t("followUpRequiredLabel")}</Badge>}
                </div>
              </div>
              <p className="mt-2 text-sm text-card-foreground">{c.summary}</p>
            </CardContent></Card>
          ))}
        </div>
      )}
    </div>
  );
}

function OverviewTab({ client }) {
  const t = useT();
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <Card><CardContent className="p-4">
        <FieldRow label={t("dobLabel")} value={fmtDateLong(client.dob)} />
        <FieldRow label={t("phone")} value={client.phone} />
        <FieldRow label={t("email")} value={client.email} />
        <FieldRow label={t("address")} value={[client.street, client.city, client.zip].filter(Boolean).join(", ")} />
        <FieldRow label={t("intakeDateLabel")} value={fmtDateLong(client.intakeDate)} />
      </CardContent></Card>
    </div>
  );
}

function ProgramsTab({ enrollments, lang }) {
  const t = useT();
  const navigate = useNavigate();
  if (!enrollments.length) return <p className="py-8 text-center text-sm text-muted">{t("noProgramsYet")}</p>;
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {enrollments.map(({ enrollment, programType, record }) => {
        const meta = PROGRAM_META[programType];
        const Icon = meta.icon;
        return (
          <Card key={enrollment.id}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-sm font-bold text-card-foreground">
                  <Icon className="h-4 w-4 text-primary" /> {t(meta.labelKey)}
                </span>
                <Badge variant={enrollment.status === "active" ? "success" : "neutral"}>{enrollment.status}</Badge>
              </div>
              <FieldRow label={t("intakeDateLabel")} value={fmtDateLong(enrollment.enrolledAt)} />
              {programType === "case" && <FieldRow label={t("immigrationStatusLabel")} value={immigrationStatusLabel(record.immigrationStatus, lang)} />}
              {programType === "job" && <FieldRow label={t("workPermitLabel")} value={record.workPermit ? t("yesOption") : t("noOption")} />}
              {programType === "student" && <FieldRow label={t("studentIdLabel")} value={record.studentId} />}
              {programType === "food" && <FieldRow label={t("householdSizeLabel")} value={record.householdSize} />}
              <Button size="sm" variant="secondary" className="mt-3" onClick={() => navigate(meta.path)}>{t("openProgramRecordBtn")}</Button>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function ServicesSection({ title, icon: Icon, children }) {
  return (
    <div>
      <h4 className="mb-2 flex items-center gap-2 text-sm font-bold text-card-foreground">
        <Icon className="h-4 w-4 text-primary" /> {title}
      </h4>
      {children}
    </div>
  );
}

function ServicesTab({ enrollments, visits, customServices, lang }) {
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
    return <p className="py-8 text-center text-sm text-muted">{t("noServicesYet")}</p>;
  }

  const studentVisits = studentEnrollment
    ? visits.filter((v) => v.studentId === studentEnrollment.record.id).sort((a, b) => new Date(b.timeIn) - new Date(a.timeIn))
    : [];

  return (
    <div className="space-y-6">
      {caseEnrollment && (
        <ServicesSection title={t(PROGRAM_META.case.labelKey)} icon={Users}>
          {caseEnrollment.record.services && caseEnrollment.record.services.length ? (
            <div className="flex flex-wrap gap-1.5">
              {caseEnrollment.record.services.map((key) => <Badge key={key} variant="neutral">{caseServiceLabel(key, lang)}</Badge>)}
            </div>
          ) : <p className="text-sm text-muted">{t("noCaseServicesRecorded")}</p>}
        </ServicesSection>
      )}
      {jobEnrollment && (
        <ServicesSection title={t(PROGRAM_META.job.labelKey)} icon={Briefcase}>
          {jobEnrollment.record.servicesProvided && jobEnrollment.record.servicesProvided.length ? (
            <div className="flex flex-wrap gap-1.5">
              {jobEnrollment.record.servicesProvided.map((key) => <Badge key={key} variant="neutral">{jobServiceLabel(key)}</Badge>)}
            </div>
          ) : <p className="text-sm text-muted">{t("noJobServicesRecorded")}</p>}
        </ServicesSection>
      )}
      {foodEnrollment && (
        <ServicesSection title={t(PROGRAM_META.food.labelKey)} icon={ShoppingBasket}>
          {distributions.length ? (
            <div className="space-y-1.5">
              {distributions.map((d) => (
                <div key={d.id} className="flex items-center justify-between gap-3 border-b border-border pb-1.5 text-sm last:border-b-0">
                  <span className="font-semibold text-card-foreground">{fmtDateLong(d.date)}</span>
                  <span className="text-muted">{d.items}{d.quantity ? " · " + d.quantity : ""}</span>
                </div>
              ))}
            </div>
          ) : <p className="text-sm text-muted">{t("noDistributionsYet")}</p>}
        </ServicesSection>
      )}
      {studentEnrollment && (
        <ServicesSection title={t(PROGRAM_META.student.labelKey)} icon={GraduationCap}>
          {studentVisits.length ? (
            <div className="space-y-1.5">
              {studentVisits.map((v) => (
                <div key={v.id} className="flex items-center justify-between gap-3 border-b border-border pb-1.5 text-sm last:border-b-0">
                  <span className="font-semibold text-card-foreground">{fmtDateLong(v.date)}</span>
                  <span className="text-muted">{serviceDisplay(v, customServices, lang)}</span>
                </div>
              ))}
            </div>
          ) : <p className="text-sm text-muted">{t("noClassVisitsYet")}</p>}
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

  if (!events.length) return <p className="py-8 text-center text-sm text-muted">{t("noActivityYet")}</p>;

  return (
    <div className="space-y-2">
      {events.map((e) => {
        const Icon = e.icon;
        return (
          <div key={e.key} className="flex items-center gap-3 border-b border-border py-2 text-sm last:border-b-0">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-tint text-primary"><Icon className="h-4 w-4" /></span>
            <span className="flex-1 font-medium text-card-foreground">{e.label}</span>
            <span className="shrink-0 text-xs text-muted">{fmtDateLong(e.date)}</span>
          </div>
        );
      })}
    </div>
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

  if (!client) {
    return (
      <Card><CardContent className="p-10 text-center text-sm text-muted">{t("clientNotFoundMessage")}</CardContent></Card>
    );
  }

  const enrollments = resolveEnrollmentsForClient(nbId, data);
  const name = (client.firstName + " " + client.lastName).trim();
  const existingTypes = enrollments.map((e) => e.programType);
  const appointments = resolveAppointmentsForClient(nbId, data);
  const schedulingProgram = enrollments.find((e) => e.programType === "case" || e.programType === "job");

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
        onEditProfile={() => setEditing(true)}
        onAddToProgram={() => setAddingToProgram(true)}
        onScheduleAppointment={schedulingProgram ? () => navigate(PROGRAM_META[schedulingProgram.programType].path, { state: { openAppointments: true, appointmentClientId: schedulingProgram.record.id } }) : undefined}
        onAddNote={() => setAddingNote(true)}
        onUploadDocument={() => setUploadingDocument(true)}
        onToggleStatus={toggleStatus}
      />

      <Card className="mt-5">
        <div className="flex flex-wrap gap-1 overflow-x-auto border-b border-border px-3 pt-2">
          {tabKeys.map((key, i) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={
                "shrink-0 rounded-t-lg px-3 py-2 text-sm font-semibold transition-colors " +
                (tab === key ? "border-b-2 border-primary text-primary" : "text-muted hover:text-card-foreground")
              }
            >
              {t(tabLabels[i])}
            </button>
          ))}
        </div>
        <CardContent className="p-5">
          {tab === "overview" && <OverviewTab client={client} />}
          {tab === "programs" && <ProgramsTab enrollments={enrollments} lang={lang} />}
          {tab === "appointments" && <AppointmentsTab appointments={appointments} lang={lang} />}
          {tab === "notes" && <NotesTab notes={notes} />}
          {tab === "documents" && <DocumentsTab documents={documents} onDelete={deleteDocument} />}
          {tab === "communications" && <CommunicationsTab communications={communications} onLog={() => setLoggingCommunication(true)} />}
          {tab === "intake" && canUseIntakeForm && <IntakeFormCard bare client={client} />}
          {tab === "services" && <ServicesTab enrollments={enrollments} visits={data.visits || []} customServices={data.customServices} lang={lang} />}
          {tab === "activity" && (
            <ActivityTab
              enrollments={enrollments} notes={notes} documents={documents}
              communications={communications} appointments={appointments} lang={lang}
            />
          )}
        </CardContent>
      </Card>

      {editing && <EditProfileModal client={client} onSave={saveProfile} onCancel={() => setEditing(false)} />}
      {addingToProgram && <AddToProgramModal existingTypes={existingTypes} onEnroll={enrollInProgram} onCancel={() => setAddingToProgram(false)} />}
      {addingNote && <AddNoteModal onSave={addNote} onCancel={() => setAddingNote(false)} />}
      {uploadingDocument && <UploadDocumentModal onSave={uploadDocument} onCancel={() => setUploadingDocument(false)} />}
      {loggingCommunication && <LogCommunicationModal onSave={logCommunication} onCancel={() => setLoggingCommunication(false)} />}
    </>
  );
}
