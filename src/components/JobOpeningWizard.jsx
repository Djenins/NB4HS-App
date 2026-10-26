// JobOpeningWizard.jsx -- 4-step Create/Edit Job Opportunity dialog (Employer
// -> Job Details -> Employment -> Application), per the Job Openings module
// spec. One component handles both create (blank, or pre-locked to an
// employer when launched from EmployerProfile.jsx) and edit (pre-filled from
// an existing row) -- same idiom as this app's other single-form
// create/edit reuse (e.g. AddApplicationModal). New job openings default to
// source "direct_employer" (a job developer entering what a partner
// employer told them) -- there's no UI for picking a source since the other
// values (public_job_board/government_source) are reserved for future feed
// integrations that don't exist yet.
//
// The whole dialog is a form: Enter (or Next) advances a step after that
// step's check; on the last step Publish and Save draft are explicit clicks.
// The step row is numbered, so the current step never relies on colour.
// ui Button has no default type, so every non-submit footer button sets
// type="button" explicitly.
import { useState } from "react";
import { Check, X } from "lucide-react";
import { useApp, useT } from "../context/AppContext.jsx";
import { cn } from "../lib/cn.js";
import {
  APPLY_METHODS, EDUCATION_LEVELS, EMPLOYMENT_TYPES, ENGLISH_LEVEL_REQUIREMENTS, EXPERIENCE_LEVELS, PAY_TYPES
} from "../lib/jobOpenings.js";
import { formatAddress, formatPhone } from "../lib/utils.js";
import DatePicker from "./DatePicker.jsx";
import { Button } from "./ui/button.jsx";
import { Dialog } from "./ui/dialog.jsx";
import { Field, Input, Select, Textarea } from "./ui/field.jsx";
import { IconButton } from "./ui/icon-button.jsx";

const STEP_KEYS = ["employer", "jobDetails", "employment", "application"];
const STEP_LABEL_KEY = { employer: "stepEmployerLabel", jobDetails: "stepJobDetailsLabel", employment: "stepEmploymentLabel", application: "stepApplicationLabel" };
const ID = "job-opening-wizard";

// Numbered step row. Below sm only the current step keeps its label (four
// labels in Kreyòl/French don't fit a phone row); the numbers always show.
function StepIndicator({ step, label, t }) {
  return (
    <ol aria-label={label} className="m-0 mb-5 flex list-none flex-wrap items-center gap-x-4 gap-y-2 p-0">
      {STEP_KEYS.map(function (key, i) {
        const current = i === step;
        const done = i < step;
        return (
          <li key={key} aria-current={current ? "step" : undefined} className="flex items-center gap-2">
            <span
              className={cn(
                "flex h-7 w-7 shrink-0 items-center justify-center rounded-chip text-meta font-semibold tabular-nums",
                current ? "bg-primary text-primary-foreground" : done ? "bg-tone-info-chip text-tone-info-ink" : "bg-tone-neutral-bg text-tone-neutral-ink"
              )}
            >
              {done ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : i + 1}
              {done ? <span className="sr-only">{i + 1}</span> : null}
            </span>
            <span className={cn("text-meta", current ? "font-semibold text-card-foreground" : "hidden text-muted sm:inline")}>
              {t(STEP_LABEL_KEY[key])}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function ChipInput({ id, values, onAdd, onRemove, placeholder, removeLabel }) {
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
        <ul className="m-0 mb-2 flex list-none flex-wrap gap-2 p-0">
          {values.map((v) => (
            <li key={v} className="inline-flex items-center gap-0.5 rounded-badge bg-tone-neutral-bg py-0.5 pl-2.5 pr-0.5 text-meta font-semibold text-tone-neutral-ink">
              {v}
              <IconButton label={removeLabel.replace("{value}", v)} size="sm" className="h-7 w-7" onClick={() => onRemove(v)}>
                <X aria-hidden="true" />
              </IconButton>
            </li>
          ))}
        </ul>
      )}
      {/* Enter adds the chip here instead of advancing the wizard's form. */}
      <Input
        id={id}
        value={input} onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
        placeholder={placeholder}
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
  // null, or the status being saved ("draft" / "active"), so only the
  // pressed button shows the spinner while both stay disabled.
  const [saving, setSaving] = useState(null);

  function setField(name, value) { setFields((prev) => Object.assign({}, prev, { [name]: value })); }
  function addChip(field, value) { setField(field, fields[field].concat([value])); }
  function removeChip(field, value) { setField(field, fields[field].filter((v) => v !== value)); }
  function hasError(name) { return errors.indexOf(name) !== -1; }

  const selectedEmployer = employers.find((e) => e.id === fields.employerId);
  const employerLocked = !!lockEmployerId;
  const lastStep = STEP_KEYS.length - 1;
  // Both sides are optional (a posting might only quote one), so this only
  // fires once both are actually filled in.
  const payRangeInvalid = fields.payMin !== "" && fields.payMax !== "" && Number(fields.payMin) > Number(fields.payMax);

  function goNext() {
    if (step === 0 && !fields.employerId) { setErrors(["employerId"]); return; }
    if (step === 1 && !fields.title.trim()) { setErrors(["title"]); return; }
    if (step === 2 && payRangeInvalid) { setErrors(["payMax"]); showToast(t("invalidPayRangeError")); return; }
    setErrors([]);
    setStep((s) => Math.min(s + 1, lastStep));
  }
  function goBack() { setStep((s) => Math.max(s - 1, 0)); }

  async function submit(status) {
    if (saving) return;
    if (!fields.employerId || !fields.title.trim()) { setErrors(["employerId", "title"].filter((f) => !fields[f] || (typeof fields[f] === "string" && !fields[f].trim()))); return; }
    if (payRangeInvalid) { setStep(2); setErrors(["payMax"]); showToast(t("invalidPayRangeError")); return; }
    setSaving(status);
    try {
      await onSave(fields, status);
    } finally {
      setSaving(null);
    }
  }

  // Enter moves through the steps, but never publishes: on the last step
  // the form's submit does nothing, and Publish/Save draft are explicit
  // clicks, so a stray Enter in a text box can't make an opening live.
  function onSubmit(e) {
    e.preventDefault();
    if (step < lastStep) goNext();
  }

  const footer = (
    <>
      <Button type="button" variant="ghost" className="mr-auto" onClick={onCancel} disabled={!!saving}>{t("cancelLabel")}</Button>
      {step > 0 && <Button type="button" variant="secondary" onClick={goBack} disabled={!!saving}>{t("wizardBackBtn")}</Button>}
      {step < lastStep ? (
        <Button type="submit">{t("wizardNextBtn")}</Button>
      ) : (
        <>
          <Button type="button" variant="secondary" loading={saving === "draft"} disabled={!!saving} onClick={() => submit("draft")}>{t("saveDraftBtn")}</Button>
          <Button type="button" loading={saving === "active"} disabled={!!saving} onClick={() => submit("active")}>{t("publishBtn")}</Button>
        </>
      )}
    </>
  );

  return (
    <Dialog
      open
      onClose={onCancel}
      title={jobOpening ? t("editJobOpeningTitle") : t("addJobOpeningTitle")}
      size="lg"
      closeLabel={t("closeLabel")}
      as="form"
      panelProps={{ onSubmit, noValidate: true }}
      footer={footer}
    >
      <StepIndicator step={step} label={t("wizardStepsLabel")} t={t} />

      {step === 0 && (
        <div className="flex flex-col gap-4">
          <Field label={t("selectEmployerLabel")} htmlFor={ID + "-employer"} required error={hasError("employerId") ? t("fieldRequired") : null}>
            {employerLocked ? (
              <Input id={ID + "-employer"} value={selectedEmployer ? selectedEmployer.businessName : ""} disabled readOnly />
            ) : (
              <Select
                id={ID + "-employer"} aria-invalid={hasError("employerId") || undefined}
                value={fields.employerId} onChange={(e) => setField("employerId", e.target.value)}
              >
                <option value="">{t("pleaseSelect")}</option>
                {employers.map((e) => <option key={e.id} value={e.id}>{e.businessName}</option>)}
              </Select>
            )}
          </Field>
          {selectedEmployer && (
            <div className="rounded-control border border-line-subtle bg-surface-sunken p-3 text-ui text-muted">
              <div className="font-semibold text-card-foreground">{selectedEmployer.contactName}</div>
              <div className="tabular-nums">{formatPhone(selectedEmployer.contactPhone)}</div>
              <div>{formatAddress(selectedEmployer)}</div>
            </div>
          )}
        </div>
      )}

      {step === 1 && (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label={t("positionLabel")} htmlFor={ID + "-title"} required error={hasError("title") ? t("fieldRequired") : null}>
              <Input id={ID + "-title"} aria-invalid={hasError("title") || undefined} value={fields.title} onChange={(e) => setField("title", e.target.value)} placeholder={t("phPositionTitle")} />
            </Field>
            <Field label={t("departmentLabel")} htmlFor={ID + "-department"}>
              <Input id={ID + "-department"} value={fields.department} onChange={(e) => setField("department", e.target.value)} placeholder={t("phDepartment")} />
            </Field>
          </div>
          <Field label={t("descriptionLabel")} htmlFor={ID + "-description"}>
            <Textarea id={ID + "-description"} rows={3} value={fields.description} onChange={(e) => setField("description", e.target.value)} placeholder={t("phJobDescription")} />
          </Field>
          <Field label={t("responsibilitiesLabel")} htmlFor={ID + "-responsibilities"}>
            <Textarea id={ID + "-responsibilities"} rows={3} value={fields.responsibilities} onChange={(e) => setField("responsibilities", e.target.value)} placeholder={t("phResponsibilities")} />
          </Field>
          <Field label={t("requirementsLabel")} htmlFor={ID + "-requirements"}>
            <Textarea id={ID + "-requirements"} rows={3} value={fields.requirements} onChange={(e) => setField("requirements", e.target.value)} placeholder={t("phRequirements")} />
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label={t("educationLabel")} htmlFor={ID + "-education"}>
              <Select id={ID + "-education"} value={fields.education} onChange={(e) => setField("education", e.target.value)}>
                <option value="">{t("pleaseSelect")}</option>
                {EDUCATION_LEVELS.map((l) => <option key={l.key} value={l.key}>{l.en}</option>)}
              </Select>
            </Field>
            <Field label={t("experienceLabel")} htmlFor={ID + "-experience"}>
              <Select id={ID + "-experience"} value={fields.experience} onChange={(e) => setField("experience", e.target.value)}>
                <option value="">{t("pleaseSelect")}</option>
                {EXPERIENCE_LEVELS.map((l) => <option key={l.key} value={l.key}>{l.en}</option>)}
              </Select>
            </Field>
          </div>
          <Field label={t("certificationsLabel")} htmlFor={ID + "-certifications"}>
            <ChipInput id={ID + "-certifications"} values={fields.certifications} onAdd={(v) => addChip("certifications", v)} onRemove={(v) => removeChip("certifications", v)} placeholder={t("addCertificationPlaceholder")} removeLabel={t("removeValueLabel")} />
          </Field>
          <Field label={t("skillsLabel")} htmlFor={ID + "-skills"}>
            <ChipInput id={ID + "-skills"} values={fields.skills} onAdd={(v) => addChip("skills", v)} onRemove={(v) => removeChip("skills", v)} placeholder={t("addSkillPlaceholder")} removeLabel={t("removeValueLabel")} />
          </Field>
          <Field label={t("languagesLabel")} htmlFor={ID + "-languages"}>
            <ChipInput id={ID + "-languages"} values={fields.languages} onAdd={(v) => addChip("languages", v)} onRemove={(v) => removeChip("languages", v)} placeholder={t("addLanguagePlaceholder")} removeLabel={t("removeValueLabel")} />
          </Field>
        </div>
      )}

      {step === 2 && (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label={t("payTypeLabel")} htmlFor={ID + "-pay-type"}>
              <Select id={ID + "-pay-type"} value={fields.payType} onChange={(e) => setField("payType", e.target.value)}>
                {PAY_TYPES.map((p) => <option key={p.key} value={p.key}>{p.en}</option>)}
              </Select>
            </Field>
            <Field label={t("payMinLabel")} htmlFor={ID + "-pay-min"}>
              <Input id={ID + "-pay-min"} type="number" inputMode="decimal" className="tabular-nums" value={fields.payMin} onChange={(e) => setField("payMin", e.target.value)} placeholder={t("phPayMin")} />
            </Field>
            <Field label={t("payMaxLabel")} htmlFor={ID + "-pay-max"} error={hasError("payMax") ? t("invalidPayRangeError") : null}>
              <Input id={ID + "-pay-max"} type="number" inputMode="decimal" className="tabular-nums" aria-invalid={hasError("payMax") || undefined} value={fields.payMax} onChange={(e) => setField("payMax", e.target.value)} placeholder={t("phPayMax")} />
            </Field>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label={t("employmentTypeLabel")} htmlFor={ID + "-employment-type"}>
              <Select id={ID + "-employment-type"} value={fields.employmentType} onChange={(e) => setField("employmentType", e.target.value)}>
                <option value="">{t("pleaseSelect")}</option>
                {EMPLOYMENT_TYPES.map((et) => <option key={et.key} value={et.key}>{et.en}</option>)}
              </Select>
            </Field>
            <Field label={t("scheduleLabel")} htmlFor={ID + "-schedule"}>
              <Input id={ID + "-schedule"} value={fields.schedule} onChange={(e) => setField("schedule", e.target.value)} placeholder={t("phSchedule")} />
            </Field>
            <Field label={t("hoursPerWeekLabel")} htmlFor={ID + "-hours"}>
              <Input id={ID + "-hours"} className="tabular-nums" value={fields.hoursPerWeek} onChange={(e) => setField("hoursPerWeek", e.target.value)} placeholder={t("phHoursPerWeek")} />
            </Field>
            <Field label={t("openingsCountLabel")} htmlFor={ID + "-openings"}>
              <Input id={ID + "-openings"} type="number" min="1" className="tabular-nums" value={fields.openingsCount} onChange={(e) => setField("openingsCount", Number(e.target.value) || 1)} placeholder={t("phOpeningsCount")} />
            </Field>
          </div>
          <Field label={t("benefitsLabel")} htmlFor={ID + "-benefits"}>
            <Textarea id={ID + "-benefits"} rows={2} value={fields.benefits} onChange={(e) => setField("benefits", e.target.value)} placeholder={t("phBenefits")} />
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label={t("jobStartDateLabel")} htmlFor="job-opening-start-date">
              <div className="ds-control"><DatePicker id="job-opening-start-date" value={fields.startDate} onChange={(v) => setField("startDate", v)} /></div>
            </Field>
            <Field label={t("applicationDeadlineLabel")} htmlFor="job-opening-deadline">
              <div className="ds-control"><DatePicker id="job-opening-deadline" value={fields.applicationDeadline} onChange={(v) => setField("applicationDeadline", v)} /></div>
            </Field>
          </div>
          <Field label={t("englishLevelRequiredLabel")} htmlFor={ID + "-english"}>
            <Select id={ID + "-english"} value={fields.englishLevelRequired} onChange={(e) => setField("englishLevelRequired", e.target.value)}>
              <option value="">{t("pleaseSelect")}</option>
              {ENGLISH_LEVEL_REQUIREMENTS.map((l) => <option key={l.key} value={l.key}>{l.en}</option>)}
            </Select>
          </Field>
          <label className="m-0 flex min-h-10 cursor-pointer items-center gap-3 text-ui font-medium text-card-foreground">
            <input
              type="checkbox" className="h-4 w-4 shrink-0 cursor-pointer accent-primary"
              checked={fields.transportationRequired} onChange={(e) => setField("transportationRequired", e.target.checked)}
            />
            {t("transportationRequiredLabel")}
          </label>
        </div>
      )}

      {step === 3 && (
        <div className="flex flex-col gap-4">
          <Field label={t("applyMethodLabel")} htmlFor={ID + "-apply-method"}>
            <Select id={ID + "-apply-method"} value={fields.applyMethod} onChange={(e) => setField("applyMethod", e.target.value)}>
              {APPLY_METHODS.map((m) => <option key={m.key} value={m.key}>{m.en}</option>)}
            </Select>
          </Field>
          {fields.applyMethod === "website" && (
            <Field label={t("applyWebsiteLabel")} htmlFor={ID + "-apply-website"}>
              <Input id={ID + "-apply-website"} type="url" inputMode="url" value={fields.applyWebsite} onChange={(e) => setField("applyWebsite", e.target.value)} placeholder="https://" />
            </Field>
          )}
          {fields.applyMethod === "email" && (
            <Field label={t("applyEmailLabel")} htmlFor={ID + "-apply-email"}>
              <Input id={ID + "-apply-email"} type="email" inputMode="email" value={fields.applyEmail} onChange={(e) => setField("applyEmail", e.target.value)} placeholder={t("phApplyEmail")} />
            </Field>
          )}
          <Field label={t("internalNotesLabel")} htmlFor={ID + "-notes"}>
            <Textarea id={ID + "-notes"} rows={3} value={fields.internalNotes} onChange={(e) => setField("internalNotes", e.target.value)} placeholder={t("phInternalNotes")} />
          </Field>
        </div>
      )}
    </Dialog>
  );
}
