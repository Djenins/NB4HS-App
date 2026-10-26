// ReferralFormModal.jsx -- one form for both "Add Referral" (participant +
// job opening pickers editable) and "Edit Referral" (those two locked, only
// status/interview date/assigned developer/notes editable) -- same
// create/edit-reuse idiom as JobOpeningWizard.jsx. A ui Dialog rendered as
// a <form>, so Enter in a field submits it; every non-submit button carries
// type="button" for the same reason.
import { useState } from "react";
import { useT } from "../context/AppContext.jsx";
import { clientDisplayName } from "../lib/clients.js";
import { REFERRAL_STAGES } from "../lib/referrals.js";
import { todayStr } from "../lib/utils.js";
import DatePicker from "./DatePicker.jsx";
import { Button } from "./ui/button.jsx";
import { Dialog } from "./ui/dialog.jsx";
import { Field, Select, Textarea } from "./ui/field.jsx";

export default function ReferralFormModal({ referral, jobClients, jobOpenings, jobDevelopers, placements, onSave, onCancel, onDelete, onCreatePlacement }) {
  const t = useT();
  const editing = !!referral;
  const hasPlacement = editing && (placements || []).some((p) => p.referralId === referral.id);
  const canCreatePlacement = editing && referral.status === "hired" && onCreatePlacement;
  const [fields, setFields] = useState(() => referral ? {
    jobClientId: referral.jobClientId, jobOpeningId: referral.jobOpeningId, status: referral.status,
    referralDate: referral.referralDate || todayStr(), interviewDate: referral.interviewDate || "",
    assignedJobDeveloperEmail: referral.assignedJobDeveloperEmail || "", notes: referral.notes || ""
  } : {
    jobClientId: "", jobOpeningId: "", status: "ready", referralDate: todayStr(), interviewDate: "",
    assignedJobDeveloperEmail: "", notes: ""
  });
  const [errors, setErrors] = useState([]);
  const [saving, setSaving] = useState(false);

  function setField(name, value) { setFields((prev) => Object.assign({}, prev, { [name]: value })); }
  function hasError(name) { return errors.indexOf(name) !== -1; }

  async function submit(e) {
    e.preventDefault();
    if (!fields.jobClientId || !fields.jobOpeningId) {
      setErrors(["jobClientId", "jobOpeningId"].filter((f) => !fields[f]));
      return;
    }
    const opening = jobOpenings.find((o) => o.id === fields.jobOpeningId);
    setSaving(true);
    try {
      await onSave(Object.assign({}, fields, { employerId: opening ? opening.employerId : referral.employerId }));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open
      onClose={onCancel}
      title={editing ? t("editLabel") : t("addReferralBtn")}
      description={editing ? [referral.participantName, referral.positionTitle].filter(Boolean).join(" · ") : null}
      size="lg"
      closeLabel={t("closeLabel")}
      as="form"
      panelProps={{ onSubmit: submit, noValidate: true }}
      footer={
        <>
          {editing && onDelete ? (
            <Button type="button" variant="danger" className="mr-auto" onClick={onDelete} disabled={saving}>{t("deleteLabel")}</Button>
          ) : null}
          <Button type="button" variant="secondary" onClick={onCancel} disabled={saving}>{t("cancelLabel")}</Button>
          <Button type="submit" loading={saving}>{t("saveLabel")}</Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {editing ? (
          <div className="rounded-control border border-border bg-surface-sunken px-4 py-3">
            <div className="text-ui font-semibold text-card-foreground">{referral.participantName}</div>
            <div className="text-meta text-muted">{[referral.positionTitle, referral.employerName].filter(Boolean).join(" · ")}</div>
            {canCreatePlacement && (
              <div className="mt-3">
                {hasPlacement ? (
                  <p className="m-0 text-meta font-semibold text-muted">{t("placementAlreadyExistsLabel")}</p>
                ) : (
                  <Button type="button" size="sm" variant="secondary" onClick={onCreatePlacement}>{t("createPlacementBtn")}</Button>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label={t("selectParticipantLabel")} htmlFor="referral-participant" required error={hasError("jobClientId") ? t("fieldRequired") : null}>
              <Select
                id="referral-participant" value={fields.jobClientId} onChange={(e) => setField("jobClientId", e.target.value)}
                aria-invalid={hasError("jobClientId") || undefined} aria-required="true"
                aria-describedby={hasError("jobClientId") ? "referral-participant-error" : undefined}
              >
                <option value="">{t("pleaseSelect")}</option>
                {jobClients.map((c) => <option key={c.id} value={c.id}>{clientDisplayName(c)}</option>)}
              </Select>
            </Field>
            <Field label={t("selectJobOpeningLabel")} htmlFor="referral-opening" required error={hasError("jobOpeningId") ? t("fieldRequired") : null}>
              <Select
                id="referral-opening" value={fields.jobOpeningId} onChange={(e) => setField("jobOpeningId", e.target.value)}
                aria-invalid={hasError("jobOpeningId") || undefined} aria-required="true"
                aria-describedby={hasError("jobOpeningId") ? "referral-opening-error" : undefined}
              >
                <option value="">{t("pleaseSelect")}</option>
                {jobOpenings.map((o) => <option key={o.id} value={o.id}>{o.title} ({o.employerName})</option>)}
              </Select>
            </Field>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={t("statusLabel")} htmlFor="referral-status">
            <Select id="referral-status" value={fields.status} onChange={(e) => setField("status", e.target.value)}>
              {REFERRAL_STAGES.map((s) => <option key={s.key} value={s.key}>{s.en}</option>)}
            </Select>
          </Field>
          <Field label={t("referralDateLabel")} htmlFor="referral-date">
            <DatePicker id="referral-date" value={fields.referralDate} onChange={(v) => setField("referralDate", v)} />
          </Field>
          <Field label={t("interviewDateLabel")} htmlFor="referral-interview-date">
            <DatePicker id="referral-interview-date" value={fields.interviewDate} onChange={(v) => setField("interviewDate", v)} />
          </Field>
          <Field label={t("assignedJobDeveloperLabel")} htmlFor="referral-developer">
            <Select id="referral-developer" value={fields.assignedJobDeveloperEmail} onChange={(e) => setField("assignedJobDeveloperEmail", e.target.value)}>
              <option value="">{t("pleaseSelect")}</option>
              {jobDevelopers.map((u) => <option key={u.id} value={u.email}>{u.name || u.email}</option>)}
            </Select>
          </Field>
        </div>

        <Field label={t("noteContentLabel")} htmlFor="referral-notes">
          <Textarea id="referral-notes" rows={3} value={fields.notes} onChange={(e) => setField("notes", e.target.value)} placeholder={t("phReferralNotes")} />
        </Field>
      </div>
    </Dialog>
  );
}
