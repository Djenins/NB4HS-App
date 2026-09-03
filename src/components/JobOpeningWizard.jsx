// JobOpeningWizard.jsx -- 4-step Create/Edit Job Opportunity modal (Employer
// -> Job Details -> Employment -> Application), per the Job Openings module
// spec. One component handles both create (blank, or pre-locked to an
// employer when launched from EmployerProfile.jsx) and edit (pre-filled from
// an existing row) -- same idiom as this app's other single-form
// create/edit reuse (e.g. AddApplicationModal). New job openings default to
// source "direct_employer" (a job developer entering what a partner
// employer told them) -- there's no UI for picking a source since the other
// values (public_job_board/government_source) are reserved for future feed
// integrations that don't exist yet.
import { useState } from "react";
import { X } from "lucide-react";
import { useApp, useT } from "../context/AppContext.jsx";
import {
  APPLY_METHODS, EDUCATION_LEVELS, EMPLOYMENT_TYPES, ENGLISH_LEVEL_REQUIREMENTS, EXPERIENCE_LEVELS, PAY_TYPES
} from "../lib/jobOpenings.js";
import { formatAddress, formatPhone } from "../lib/utils.js";
import DatePicker from "./DatePicker.jsx";
import { Button } from "./ui/button.jsx";

const STEP_KEYS = ["employer", "jobDetails", "employment", "application"];
const STEP_LABEL_KEY = { employer: "stepEmployerLabel", jobDetails: "stepJobDetailsLabel", employment: "stepEmploymentLabel", application: "stepApplicationLabel" };

const inputClass = "h-11 min-h-0 w-full rounded-lg border border-border bg-background px-3 text-sm text-card-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15";
const textareaClass = "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-card-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15";

function Field({ label, required, children }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold text-card-foreground">
        {label}{required ? <span className="text-accent"> *</span> : null}
      </label>
      {children}
    </div>
  );
}

function ChipInput({ values, onAdd, onRemove, placeholder }) {
  const [input, setInput] = useState("");
  function add() {
    const v = input.trim();
    if (!v || values.indexOf(v) !== -1) return;
    onAdd(v);
    setInput("");
  }
  return (
    <div>
      {values.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {values.map((v) => (
            <span key={v} className="flex items-center gap-1 rounded-full bg-tint-neutral px-3 py-1 text-xs font-semibold text-card-foreground">
              {v}
              <button type="button" onClick={() => onRemove(v)} className="border-0 bg-transparent p-0 text-muted hover:text-accent"><X className="h-3 w-3" /></button>
            </span>
          ))}
        </div>
      )}
      <input
        value={input} onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
        placeholder={placeholder} className={inputClass}
      />
    </div>
  );
}

function emptyFields(lockEmployerId) {
  return {
    employerId: lockEmployerId || "", title: "", department: "", description: "", responsibilities: "", requirements: "",
    education: "", experience: "", certifications: [], skills: [], languages: [],
    payType: "hourly", payMin: "", payMax: "", employmentType: "", schedule: "", hoursPerWeek: "", benefits: "",
    startDate: "", openingsCount: 1, applicationDeadline: "", transportationRequired: false, englishLevelRequired: "",
    applyMethod: "website", applyWebsite: "", applyEmail: "", internalNotes: "", source: "direct_employer"
  };
}

export default function JobOpeningWizard({ jobOpening, lockEmployerId, employers, onSave, onCancel }) {
  const { showToast } = useApp();
  const t = useT();
  const [step, setStep] = useState(0);
  const [fields, setFields] = useState(() => jobOpening ? Object.assign(emptyFields(), jobOpening) : emptyFields(lockEmployerId));
  const [errors, setErrors] = useState([]);
  const [saving, setSaving] = useState(false);

  function setField(name, value) { setFields((prev) => Object.assign({}, prev, { [name]: value })); }
  function addChip(field, value) { setField(field, fields[field].concat([value])); }
  function removeChip(field, value) { setField(field, fields[field].filter((v) => v !== value)); }

  const selectedEmployer = employers.find((e) => e.id === fields.employerId);
  const employerLocked = !!lockEmployerId;
  // Both sides are optional (a posting might only quote one), so this only
  // fires once both are actually filled in.
  const payRangeInvalid = fields.payMin !== "" && fields.payMax !== "" && Number(fields.payMin) > Number(fields.payMax);

  function goNext() {
    if (step === 0 && !fields.employerId) { setErrors(["employerId"]); return; }
    if (step === 1 && !fields.title.trim()) { setErrors(["title"]); return; }
    if (step === 2 && payRangeInvalid) { setErrors(["payMax"]); showToast(t("invalidPayRangeError")); return; }
    setErrors([]);
    setStep((s) => Math.min(s + 1, STEP_KEYS.length - 1));
  }
  function goBack() { setStep((s) => Math.max(s - 1, 0)); }

  async function submit(status) {
    if (!fields.employerId || !fields.title.trim()) { setErrors(["employerId", "title"].filter((f) => !fields[f] || (typeof fields[f] === "string" && !fields[f].trim()))); return; }
    if (payRangeInvalid) { setStep(2); setErrors(["payMax"]); showToast(t("invalidPayRangeError")); return; }
    setSaving(true);
    try {
      await onSave(fields, status);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="modal-box max-w-2xl" role="dialog" aria-modal="true">
        <div className="mb-4 flex flex-wrap gap-1">
          {STEP_KEYS.map((key, i) => (
            <span
              key={key}
              className={
                "rounded-full px-3 py-1 text-xs font-semibold " +
                (i === step ? "bg-primary text-white" : i < step ? "bg-primary-tint text-primary" : "bg-tint-neutral text-muted")
              }
            >
              {i + 1}. {t(STEP_LABEL_KEY[key])}
            </span>
          ))}
        </div>

        {step === 0 && (
          <div className="space-y-3">
            <Field label={t("selectEmployerLabel")} required>
              {employerLocked ? (
                <div className="rounded-lg border border-border bg-background px-3 py-2 text-sm font-semibold text-card-foreground">
                  {selectedEmployer ? selectedEmployer.businessName : ""}
                </div>
              ) : (
                <select
                  className={inputClass + (errors.indexOf("employerId") !== -1 ? " border-accent" : "")}
                  value={fields.employerId} onChange={(e) => setField("employerId", e.target.value)}
                >
                  <option value="">{t("pleaseSelect")}</option>
                  {employers.map((e) => <option key={e.id} value={e.id}>{e.businessName}</option>)}
                </select>
              )}
            </Field>
            {selectedEmployer && (
              <div className="rounded-lg border border-border p-3 text-sm text-muted">
                <div>{selectedEmployer.contactName}</div>
                <div>{formatPhone(selectedEmployer.contactPhone)}</div>
                <div>{formatAddress(selectedEmployer)}</div>
              </div>
            )}
          </div>
        )}

        {step === 1 && (
          <div className="space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label={t("positionLabel")} required>
                <input className={inputClass + (errors.indexOf("title") !== -1 ? " border-accent" : "")} value={fields.title} onChange={(e) => setField("title", e.target.value)} placeholder={t("phPositionTitle")} />
              </Field>
              <Field label={t("departmentLabel")}>
                <input className={inputClass} value={fields.department} onChange={(e) => setField("department", e.target.value)} placeholder={t("phDepartment")} />
              </Field>
            </div>
            <Field label={t("descriptionLabel")}><textarea rows={3} className={textareaClass} value={fields.description} onChange={(e) => setField("description", e.target.value)} placeholder={t("phJobDescription")} /></Field>
            <Field label={t("responsibilitiesLabel")}><textarea rows={3} className={textareaClass} value={fields.responsibilities} onChange={(e) => setField("responsibilities", e.target.value)} placeholder={t("phResponsibilities")} /></Field>
            <Field label={t("requirementsLabel")}><textarea rows={3} className={textareaClass} value={fields.requirements} onChange={(e) => setField("requirements", e.target.value)} placeholder={t("phRequirements")} /></Field>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label={t("educationLabel")}>
                <select className={inputClass} value={fields.education} onChange={(e) => setField("education", e.target.value)}>
                  <option value="">{t("pleaseSelect")}</option>
                  {EDUCATION_LEVELS.map((l) => <option key={l.key} value={l.key}>{l.en}</option>)}
                </select>
              </Field>
              <Field label={t("experienceLabel")}>
                <select className={inputClass} value={fields.experience} onChange={(e) => setField("experience", e.target.value)}>
                  <option value="">{t("pleaseSelect")}</option>
                  {EXPERIENCE_LEVELS.map((l) => <option key={l.key} value={l.key}>{l.en}</option>)}
                </select>
              </Field>
            </div>
            <Field label={t("certificationsLabel")}><ChipInput values={fields.certifications} onAdd={(v) => addChip("certifications", v)} onRemove={(v) => removeChip("certifications", v)} placeholder={t("addCertificationPlaceholder")} /></Field>
            <Field label={t("skillsLabel")}><ChipInput values={fields.skills} onAdd={(v) => addChip("skills", v)} onRemove={(v) => removeChip("skills", v)} placeholder={t("addSkillPlaceholder")} /></Field>
            <Field label={t("languagesLabel")}><ChipInput values={fields.languages} onAdd={(v) => addChip("languages", v)} onRemove={(v) => removeChip("languages", v)} placeholder={t("addLanguagePlaceholder")} /></Field>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Field label={t("payTypeLabel")}>
                <select className={inputClass} value={fields.payType} onChange={(e) => setField("payType", e.target.value)}>
                  {PAY_TYPES.map((p) => <option key={p.key} value={p.key}>{p.en}</option>)}
                </select>
              </Field>
              <Field label={t("payMinLabel")}><input type="number" className={inputClass} value={fields.payMin} onChange={(e) => setField("payMin", e.target.value)} placeholder={t("phPayMin")} /></Field>
              <Field label={t("payMaxLabel")}><input type="number" className={inputClass + (errors.indexOf("payMax") !== -1 ? " border-accent" : "")} value={fields.payMax} onChange={(e) => setField("payMax", e.target.value)} placeholder={t("phPayMax")} /></Field>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label={t("employmentTypeLabel")}>
                <select className={inputClass} value={fields.employmentType} onChange={(e) => setField("employmentType", e.target.value)}>
                  <option value="">{t("pleaseSelect")}</option>
                  {EMPLOYMENT_TYPES.map((et) => <option key={et.key} value={et.key}>{et.en}</option>)}
                </select>
              </Field>
              <Field label={t("scheduleLabel")}><input className={inputClass} value={fields.schedule} onChange={(e) => setField("schedule", e.target.value)} placeholder={t("phSchedule")} /></Field>
              <Field label={t("hoursPerWeekLabel")}><input className={inputClass} value={fields.hoursPerWeek} onChange={(e) => setField("hoursPerWeek", e.target.value)} placeholder={t("phHoursPerWeek")} /></Field>
              <Field label={t("openingsCountLabel")}><input type="number" min="1" className={inputClass} value={fields.openingsCount} onChange={(e) => setField("openingsCount", Number(e.target.value) || 1)} placeholder={t("phOpeningsCount")} /></Field>
            </div>
            <Field label={t("benefitsLabel")}><textarea rows={2} className={textareaClass} value={fields.benefits} onChange={(e) => setField("benefits", e.target.value)} placeholder={t("phBenefits")} /></Field>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label={t("jobStartDateLabel")}><DatePicker id="job-opening-start-date" value={fields.startDate} onChange={(v) => setField("startDate", v)} /></Field>
              <Field label={t("applicationDeadlineLabel")}><DatePicker id="job-opening-deadline" value={fields.applicationDeadline} onChange={(v) => setField("applicationDeadline", v)} /></Field>
            </div>
            <Field label={t("englishLevelRequiredLabel")}>
              <select className={inputClass} value={fields.englishLevelRequired} onChange={(e) => setField("englishLevelRequired", e.target.value)}>
                <option value="">{t("pleaseSelect")}</option>
                {ENGLISH_LEVEL_REQUIREMENTS.map((l) => <option key={l.key} value={l.key}>{l.en}</option>)}
              </select>
            </Field>
            <label className="flex items-center gap-2 text-sm text-card-foreground">
              <input type="checkbox" checked={fields.transportationRequired} onChange={(e) => setField("transportationRequired", e.target.checked)} />
              {t("transportationRequiredLabel")}
            </label>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-3">
            <Field label={t("applyMethodLabel")}>
              <select className={inputClass} value={fields.applyMethod} onChange={(e) => setField("applyMethod", e.target.value)}>
                {APPLY_METHODS.map((m) => <option key={m.key} value={m.key}>{m.en}</option>)}
              </select>
            </Field>
            {fields.applyMethod === "website" && (
              <Field label={t("applyWebsiteLabel")}><input className={inputClass} value={fields.applyWebsite} onChange={(e) => setField("applyWebsite", e.target.value)} placeholder="https://" /></Field>
            )}
            {fields.applyMethod === "email" && (
              <Field label={t("applyEmailLabel")}><input className={inputClass} value={fields.applyEmail} onChange={(e) => setField("applyEmail", e.target.value)} placeholder={t("phApplyEmail")} /></Field>
            )}
            <Field label={t("internalNotesLabel")}><textarea rows={3} className={textareaClass} value={fields.internalNotes} onChange={(e) => setField("internalNotes", e.target.value)} placeholder={t("phInternalNotes")} /></Field>
          </div>
        )}

        <div className="pill-row" style={{ justifyContent: "space-between", marginTop: 20, marginBottom: 0 }}>
          <div className="pill-row" style={{ margin: 0 }}>
            <button type="button" className="btn-secondary" onClick={onCancel}>{t("cancelLabel")}</button>
            {step > 0 && <button type="button" className="btn-secondary" onClick={goBack}>{t("wizardBackBtn")}</button>}
          </div>
          <div className="pill-row" style={{ margin: 0 }}>
            {step < STEP_KEYS.length - 1 ? (
              <Button onClick={goNext}>{t("wizardNextBtn")}</Button>
            ) : (
              <>
                <Button variant="secondary" disabled={saving} onClick={() => submit("draft")}>{t("saveDraftBtn")}</Button>
                <Button disabled={saving} onClick={() => submit("active")}>{t("publishBtn")}</Button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
