// PlacementFormModal.jsx -- single-step "Add Placement" form. Reachable
// blank from Placements.jsx's "Add Placement" button, or pre-filled via
// `prefill` when handed off from a "hired" referral (ReferralFormModal.jsx's
// "Create Placement" button, through the same router-state pattern
// JobOpenings.jsx uses to hand off to CandidateMatching.jsx). A ui Dialog
// rendered as a <form>, so Enter in a field submits it.
import { useState } from "react";
import { useT } from "../context/AppContext.jsx";
import { clientDisplayName } from "../lib/clients.js";
import { todayStr } from "../lib/utils.js";
import DatePicker from "./DatePicker.jsx";
import { Button } from "./ui/button.jsx";
import { Dialog } from "./ui/dialog.jsx";
import { Field, Input, Select, Textarea } from "./ui/field.jsx";

export default function PlacementFormModal({ prefill, jobClients, employers, jobOpenings, onSave, onCancel }) {
  const t = useT();
  const [fields, setFields] = useState(() => Object.assign({
    jobClientId: "", employerId: "", jobOpeningId: "", referralId: "", positionTitle: "",
    startDate: todayStr(), hourlyWage: "", hoursPerWeek: "", benefits: "", supervisorName: "", supervisorContact: ""
  }, prefill || {}));
  const [errors, setErrors] = useState([]);
  const [saving, setSaving] = useState(false);

  function setField(name, value) { setFields((prev) => Object.assign({}, prev, { [name]: value })); }
  function hasError(name) { return errors.indexOf(name) !== -1; }
  // Props shared by the three required controls: invalid state + error link.
  function requiredProps(name, id) {
    return {
      id, "aria-required": "true",
      "aria-invalid": hasError(name) || undefined,
      "aria-describedby": hasError(name) ? id + "-error" : undefined
    };
  }

  const openingsForEmployer = fields.employerId ? jobOpenings.filter((o) => o.employerId === fields.employerId) : jobOpenings;

  async function submit(e) {
    e.preventDefault();
    const errs = ["jobClientId", "employerId", "positionTitle"].filter((f) => !fields[f] || !String(fields[f]).trim());
    if (errs.length) { setErrors(errs); return; }
    setSaving(true);
    try {
      await onSave(fields);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open
      onClose={onCancel}
      title={t("addPlacementBtn")}
      size="lg"
      closeLabel={t("closeLabel")}
      as="form"
      panelProps={{ onSubmit: submit, noValidate: true }}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onCancel} disabled={saving}>{t("cancelLabel")}</Button>
          <Button type="submit" loading={saving}>{t("saveLabel")}</Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={t("selectParticipantLabel")} htmlFor="placement-participant" required error={hasError("jobClientId") ? t("fieldRequired") : null}>
            <Select {...requiredProps("jobClientId", "placement-participant")} value={fields.jobClientId} onChange={(e) => setField("jobClientId", e.target.value)} disabled={!!prefill && !!prefill.jobClientId}>
              <option value="">{t("pleaseSelect")}</option>
              {jobClients.map((c) => <option key={c.id} value={c.id}>{clientDisplayName(c)}</option>)}
            </Select>
          </Field>
          <Field label={t("selectEmployerLabel")} htmlFor="placement-employer" required error={hasError("employerId") ? t("fieldRequired") : null}>
            <Select {...requiredProps("employerId", "placement-employer")} value={fields.employerId} onChange={(e) => setField("employerId", e.target.value)} disabled={!!prefill && !!prefill.employerId}>
              <option value="">{t("pleaseSelect")}</option>
              {employers.map((e) => <option key={e.id} value={e.id}>{e.businessName}</option>)}
            </Select>
          </Field>
          <Field label={t("selectJobOpeningLabel")} htmlFor="placement-opening">
            <Select id="placement-opening" value={fields.jobOpeningId} onChange={(e) => setField("jobOpeningId", e.target.value)}>
              <option value="">{t("pleaseSelect")}</option>
              {openingsForEmployer.map((o) => <option key={o.id} value={o.id}>{o.title}</option>)}
            </Select>
          </Field>
          <Field label={t("positionLabel")} htmlFor="placement-position" required error={hasError("positionTitle") ? t("fieldRequired") : null}>
            <Input {...requiredProps("positionTitle", "placement-position")} value={fields.positionTitle} onChange={(e) => setField("positionTitle", e.target.value)} placeholder={t("phPositionTitle")} />
          </Field>
          <Field label={t("jobStartDateLabel")} htmlFor="placement-start-date">
            <DatePicker id="placement-start-date" value={fields.startDate} onChange={(v) => setField("startDate", v)} />
          </Field>
          <Field label={t("hourlyWageLabel")} htmlFor="placement-wage">
            <Input id="placement-wage" type="number" step="0.01" inputMode="decimal" className="tabular-nums" value={fields.hourlyWage} onChange={(e) => setField("hourlyWage", e.target.value)} placeholder={t("phHourlyWage")} />
          </Field>
          <Field label={t("hoursPerWeekLabel")} htmlFor="placement-hours">
            <Input id="placement-hours" className="tabular-nums" value={fields.hoursPerWeek} onChange={(e) => setField("hoursPerWeek", e.target.value)} placeholder={t("phHoursPerWeek")} />
          </Field>
          <Field label={t("supervisorNameLabel")} htmlFor="placement-supervisor">
            <Input id="placement-supervisor" value={fields.supervisorName} onChange={(e) => setField("supervisorName", e.target.value)} placeholder={t("phSupervisorName")} />
          </Field>
          <Field label={t("supervisorContactLabel")} htmlFor="placement-supervisor-contact" className="sm:col-span-2">
            <Input id="placement-supervisor-contact" value={fields.supervisorContact} onChange={(e) => setField("supervisorContact", e.target.value)} placeholder={t("phSupervisorContact")} />
          </Field>
        </div>
        <Field label={t("benefitsLabel")} htmlFor="placement-benefits">
          <Textarea id="placement-benefits" rows={2} value={fields.benefits} onChange={(e) => setField("benefits", e.target.value)} placeholder={t("phBenefits")} />
        </Field>
      </div>
    </Dialog>
  );
}
