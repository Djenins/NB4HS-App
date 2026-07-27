// JobOpeningDetailModal.jsx -- read-only "View" modal for a job opening row,
// distinct from JobOpeningWizard.jsx's editable form per the spec's separate
// View/Edit row actions. Same SectionCard/FieldRow idiom as
// EmployerProfile.jsx/JobClientProfile.jsx.
import { useT } from "../context/AppContext.jsx";
import {
  applyMethodLabel, educationLevelLabel, employmentTypeLabel, englishLevelLabel, experienceLevelLabel,
  formatPayRange, sourceLabel, statusBadgeVariant, statusLabel
} from "../lib/jobOpenings.js";
import { fmtDateLong } from "../lib/utils.js";
import { Badge } from "./ui/badge.jsx";
import { Button } from "./ui/button.jsx";

function FieldRow({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-border py-2 text-sm last:border-b-0">
      <span className="shrink-0 text-muted">{label}</span>
      <span className="text-right font-semibold text-card-foreground">{value || "—"}</span>
    </div>
  );
}

export default function JobOpeningDetailModal({ jobOpening, onClose }) {
  const t = useT();
  const o = jobOpening;

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-box max-w-xl" role="dialog" aria-modal="true">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="m-0 text-base font-bold text-card-foreground">{o.title}</p>
            <p className="m-0 text-sm text-muted">{o.employerName}</p>
          </div>
          <Badge variant={statusBadgeVariant(o.status)}>{statusLabel(o.status)}</Badge>
        </div>

        <FieldRow label={t("departmentLabel")} value={o.department} />
        <FieldRow label={t("locationLabel")} value={o.employerCity} />
        <FieldRow label={t("payLabel")} value={formatPayRange(o)} />
        <FieldRow label={t("employmentTypeLabel")} value={employmentTypeLabel(o.employmentType)} />
        <FieldRow label={t("scheduleLabel")} value={o.schedule} />
        <FieldRow label={t("hoursPerWeekLabel")} value={o.hoursPerWeek} />
        <FieldRow label={t("benefitsLabel")} value={o.benefits} />
        <FieldRow label={t("jobStartDateLabel")} value={fmtDateLong(o.startDate)} />
        <FieldRow label={t("openingsCountLabel")} value={o.openingsCount} />
        <FieldRow label={t("applicationDeadlineLabel")} value={fmtDateLong(o.applicationDeadline)} />
        <FieldRow label={t("educationLabel")} value={educationLevelLabel(o.education)} />
        <FieldRow label={t("experienceLabel")} value={experienceLevelLabel(o.experience)} />
        <FieldRow label={t("englishLevelRequiredLabel")} value={englishLevelLabel(o.englishLevelRequired)} />
        <FieldRow label={t("transportationRequiredLabel")} value={o.transportationRequired ? t("yesOption") : t("noOption")} />
        <FieldRow label={t("certificationsLabel")} value={(o.certifications || []).join(", ")} />
        <FieldRow label={t("skillsLabel")} value={(o.skills || []).join(", ")} />
        <FieldRow label={t("languagesLabel")} value={(o.languages || []).join(", ")} />
        <FieldRow label={t("applyMethodLabel")} value={applyMethodLabel(o.applyMethod)} />
        {o.applyWebsite && <FieldRow label={t("applyWebsiteLabel")} value={o.applyWebsite} />}
        {o.applyEmail && <FieldRow label={t("applyEmailLabel")} value={o.applyEmail} />}
        <FieldRow label={t("postedDateLabel")} value={fmtDateLong(o.postedDate)} />
        <FieldRow label={t("sourceFieldLabel")} value={sourceLabel(o.source)} />

        {o.description && (
          <div className="mt-3">
            <p className="mb-1 text-xs font-semibold text-muted">{t("descriptionLabel")}</p>
            <p className="text-sm text-card-foreground">{o.description}</p>
          </div>
        )}
        {o.responsibilities && (
          <div className="mt-3">
            <p className="mb-1 text-xs font-semibold text-muted">{t("responsibilitiesLabel")}</p>
            <p className="text-sm text-card-foreground">{o.responsibilities}</p>
          </div>
        )}
        {o.requirements && (
          <div className="mt-3">
            <p className="mb-1 text-xs font-semibold text-muted">{t("requirementsLabel")}</p>
            <p className="text-sm text-card-foreground">{o.requirements}</p>
          </div>
        )}
        {o.internalNotes && (
          <div className="mt-3">
            <p className="mb-1 text-xs font-semibold text-muted">{t("internalNotesLabel")}</p>
            <p className="text-sm text-card-foreground">{o.internalNotes}</p>
          </div>
        )}

        <div className="pill-row" style={{ justifyContent: "flex-end", marginTop: 16, marginBottom: 0 }}>
          <Button onClick={onClose}>{t("cancelLabel")}</Button>
        </div>
      </div>
    </div>
  );
}
