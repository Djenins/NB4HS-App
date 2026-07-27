// ReferralFormModal.jsx -- one form for both "Add Referral" (participant +
// job opening pickers editable) and "Edit Referral" (those two locked, only
// status/interview date/assigned developer/notes editable) -- same
// create/edit-reuse idiom as JobOpeningWizard.jsx.
import { useState } from "react";
import { useT } from "../context/AppContext.jsx";
import { clientDisplayName } from "../lib/clients.js";
import { REFERRAL_STAGES } from "../lib/referrals.js";
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

  function setField(name, value) { setFields((prev) => Object.assign({}, prev, { [name]: value })); }

  function submit() {
    if (!fields.jobClientId || !fields.jobOpeningId) {
      setErrors(["jobClientId", "jobOpeningId"].filter((f) => !fields[f]));
      return;
    }
    const opening = jobOpenings.find((o) => o.id === fields.jobOpeningId);
    onSave(Object.assign({}, fields, { employerId: opening ? opening.employerId : referral.employerId }));
  }

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="modal-box max-w-lg" role="dialog" aria-modal="true">
        <p className="mb-4 text-base font-bold text-card-foreground">{editing ? t("editLabel") : t("addReferralBtn")}</p>

        {editing ? (
          <div className="mb-3 rounded-lg border border-border p-3 text-sm">
            <div className="font-semibold text-card-foreground">{referral.participantName}</div>
            <div className="text-muted">{referral.positionTitle} · {referral.employerName}</div>
            {canCreatePlacement && (
              <div className="mt-2">
                {hasPlacement ? (
                  <span className="text-xs font-semibold text-muted">{t("placementAlreadyExistsLabel")}</span>
                ) : (
                  <Button size="sm" variant="secondary" onClick={onCreatePlacement}>{t("createPlacementBtn")}</Button>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label={t("selectParticipantLabel")} required>
              <select className={inputClass + (errors.indexOf("jobClientId") !== -1 ? " border-accent" : "")} value={fields.jobClientId} onChange={(e) => setField("jobClientId", e.target.value)}>
                <option value="">{t("pleaseSelect")}</option>
                {jobClients.map((c) => <option key={c.id} value={c.id}>{clientDisplayName(c)}</option>)}
              </select>
            </Field>
            <Field label={t("selectJobOpeningLabel")} required>
              <select className={inputClass + (errors.indexOf("jobOpeningId") !== -1 ? " border-accent" : "")} value={fields.jobOpeningId} onChange={(e) => setField("jobOpeningId", e.target.value)}>
                <option value="">{t("pleaseSelect")}</option>
                {jobOpenings.map((o) => <option key={o.id} value={o.id}>{o.title} ({o.employerName})</option>)}
              </select>
            </Field>
          </div>
        )}

        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label={t("statusLabel")}>
            <select className={inputClass} value={fields.status} onChange={(e) => setField("status", e.target.value)}>
              {REFERRAL_STAGES.map((s) => <option key={s.key} value={s.key}>{s.en}</option>)}
            </select>
          </Field>
          <Field label={t("referralDateLabel")}><DatePicker id="referral-date" value={fields.referralDate} onChange={(v) => setField("referralDate", v)} /></Field>
          <Field label={t("interviewDateLabel")}><DatePicker id="referral-interview-date" value={fields.interviewDate} onChange={(v) => setField("interviewDate", v)} /></Field>
          <Field label={t("assignedJobDeveloperLabel")}>
            <select className={inputClass} value={fields.assignedJobDeveloperEmail} onChange={(e) => setField("assignedJobDeveloperEmail", e.target.value)}>
              <option value="">{t("pleaseSelect")}</option>
              {jobDevelopers.map((u) => <option key={u.id} value={u.email}>{u.name || u.email}</option>)}
            </select>
          </Field>
        </div>
        <div className="mt-3">
          <label className="mb-1 block text-xs font-semibold text-card-foreground">{t("noteContentLabel")}</label>
          <textarea rows={3} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-card-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15" value={fields.notes} onChange={(e) => setField("notes", e.target.value)} />
        </div>

        <div className="pill-row" style={{ justifyContent: "space-between", marginTop: 16, marginBottom: 0 }}>
          {editing && onDelete ? <Button variant="destructive" onClick={onDelete}>{t("deleteLabel")}</Button> : <span />}
          <div className="pill-row" style={{ margin: 0 }}>
            <button type="button" className="btn-secondary" onClick={onCancel}>{t("cancelLabel")}</button>
            <Button onClick={submit}>{t("saveLabel")}</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
