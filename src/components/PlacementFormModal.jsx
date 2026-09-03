// PlacementFormModal.jsx -- single-step "Add Placement" form. Reachable
// blank from Placements.jsx's "Add Placement" button, or pre-filled via
// `prefill` when handed off from a "hired" referral (ReferralFormModal.jsx's
// "Create Placement" button, through the same router-state pattern
// JobOpenings.jsx uses to hand off to CandidateMatching.jsx).
import { useState } from "react";
import { useT } from "../context/AppContext.jsx";
import { clientDisplayName } from "../lib/clients.js";
import { todayStr } from "../lib/utils.js";
import DatePicker from "./DatePicker.jsx";
import { Button } from "./ui/button.jsx";

const inputClass = "h-11 min-h-0 w-full rounded-lg border border-border bg-background px-3 text-sm text-card-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15";

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

export default function PlacementFormModal({ prefill, jobClients, employers, jobOpenings, onSave, onCancel }) {
  const t = useT();
  const [fields, setFields] = useState(() => Object.assign({
    jobClientId: "", employerId: "", jobOpeningId: "", referralId: "", positionTitle: "",
    startDate: todayStr(), hourlyWage: "", hoursPerWeek: "", benefits: "", supervisorName: "", supervisorContact: ""
  }, prefill || {}));
  const [errors, setErrors] = useState([]);

  function setField(name, value) { setFields((prev) => Object.assign({}, prev, { [name]: value })); }

  const openingsForEmployer = fields.employerId ? jobOpenings.filter((o) => o.employerId === fields.employerId) : jobOpenings;

  function submit() {
    const errs = ["jobClientId", "employerId", "positionTitle"].filter((f) => !fields[f] || !String(fields[f]).trim());
    if (errs.length) { setErrors(errs); return; }
    onSave(fields);
  }

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="modal-box max-w-lg" role="dialog" aria-modal="true">
        <p className="mb-4 text-base font-bold text-card-foreground">{t("addPlacementBtn")}</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label={t("selectParticipantLabel")} required>
            <select className={inputClass + (errors.indexOf("jobClientId") !== -1 ? " border-accent" : "")} value={fields.jobClientId} onChange={(e) => setField("jobClientId", e.target.value)} disabled={!!prefill && !!prefill.jobClientId}>
              <option value="">{t("pleaseSelect")}</option>
              {jobClients.map((c) => <option key={c.id} value={c.id}>{clientDisplayName(c)}</option>)}
            </select>
          </Field>
          <Field label={t("selectEmployerLabel")} required>
            <select className={inputClass + (errors.indexOf("employerId") !== -1 ? " border-accent" : "")} value={fields.employerId} onChange={(e) => setField("employerId", e.target.value)} disabled={!!prefill && !!prefill.employerId}>
              <option value="">{t("pleaseSelect")}</option>
              {employers.map((e) => <option key={e.id} value={e.id}>{e.businessName}</option>)}
            </select>
          </Field>
          <Field label={t("selectJobOpeningLabel")}>
            <select className={inputClass} value={fields.jobOpeningId} onChange={(e) => setField("jobOpeningId", e.target.value)}>
              <option value="">{t("pleaseSelect")}</option>
              {openingsForEmployer.map((o) => <option key={o.id} value={o.id}>{o.title}</option>)}
            </select>
          </Field>
          <Field label={t("positionLabel")} required>
            <input className={inputClass + (errors.indexOf("positionTitle") !== -1 ? " border-accent" : "")} value={fields.positionTitle} onChange={(e) => setField("positionTitle", e.target.value)} placeholder={t("phPositionTitle")} />
          </Field>
          <Field label={t("jobStartDateLabel")}><DatePicker id="placement-start-date" value={fields.startDate} onChange={(v) => setField("startDate", v)} /></Field>
          <Field label={t("hourlyWageLabel")}><input type="number" step="0.01" className={inputClass} value={fields.hourlyWage} onChange={(e) => setField("hourlyWage", e.target.value)} placeholder={t("phHourlyWage")} /></Field>
          <Field label={t("hoursPerWeekLabel")}><input className={inputClass} value={fields.hoursPerWeek} onChange={(e) => setField("hoursPerWeek", e.target.value)} placeholder={t("phHoursPerWeek")} /></Field>
          <Field label={t("supervisorNameLabel")}><input className={inputClass} value={fields.supervisorName} onChange={(e) => setField("supervisorName", e.target.value)} placeholder={t("phSupervisorName")} /></Field>
          <Field label={t("supervisorContactLabel")}><input className={inputClass} value={fields.supervisorContact} onChange={(e) => setField("supervisorContact", e.target.value)} placeholder={t("phSupervisorContact")} /></Field>
        </div>
        <div className="mt-3">
          <label className="mb-1 block text-xs font-semibold text-card-foreground">{t("benefitsLabel")}</label>
          <textarea rows={2} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-card-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15" value={fields.benefits} onChange={(e) => setField("benefits", e.target.value)} placeholder={t("phBenefits")} />
        </div>
        <div className="pill-row" style={{ justifyContent: "flex-end", marginTop: 16, marginBottom: 0 }}>
          <button type="button" className="btn-secondary" onClick={onCancel}>{t("cancelLabel")}</button>
          <Button onClick={submit}>{t("saveLabel")}</Button>
        </div>
      </div>
    </div>
  );
}
