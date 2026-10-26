// JobOpeningDetailModal.jsx -- read-only "View" panel for a job opening,
// distinct from JobOpeningWizard.jsx's editable form per the spec's separate
// View/Edit row actions. Looking at a record doesn't need protected focus,
// so this is a right-hand Drawer that keeps the list in view. The name and
// props ({ jobOpening, onClose }) are unchanged, so JobOpenings.jsx and
// EmployerProfile.jsx keep mounting it the same way (render to open,
// unmount to close).
import { Briefcase } from "lucide-react";
import { useT } from "../context/AppContext.jsx";
import {
  applyMethodLabel, educationLevelLabel, employmentTypeLabel, englishLevelLabel, experienceLevelLabel,
  formatPayRange, sourceLabel, statusLabel
} from "../lib/jobOpenings.js";
import { fmtDateLong } from "../lib/utils.js";
import { Button } from "./ui/button.jsx";
import { DetailRow, Drawer } from "./ui/drawer.jsx";
import { StatusBadge } from "./ui/status-badge.jsx";

function Row({ label, value }) {
  return <DetailRow label={label}>{value || value === 0 ? value : "—"}</DetailRow>;
}

function LongText({ label, children }) {
  if (!children) return null;
  return (
    <div className="mt-5">
      <h3 className="m-0 mb-1 text-meta font-semibold text-muted">{label}</h3>
      <p className="m-0 whitespace-pre-line text-body text-card-foreground">{children}</p>
    </div>
  );
}

export default function JobOpeningDetailModal({ jobOpening, onClose }) {
  const t = useT();
  const o = jobOpening;

  return (
    <Drawer
      open
      onClose={onClose}
      title={o.title}
      subtitle={o.employerName}
      icon={<Briefcase />}
      closeLabel={t("closeLabel")}
      footer={<Button variant="secondary" onClick={onClose}>{t("closeLabel")}</Button>}
    >
      <div className="mb-3">
        <StatusBadge domain="opening" status={o.status}>{statusLabel(o.status)}</StatusBadge>
      </div>

      <dl className="m-0">
        <Row label={t("departmentLabel")} value={o.department} />
        <Row label={t("locationLabel")} value={o.employerCity} />
        <Row label={t("payLabel")} value={formatPayRange(o)} />
        <Row label={t("employmentTypeLabel")} value={employmentTypeLabel(o.employmentType)} />
        <Row label={t("scheduleLabel")} value={o.schedule} />
        <Row label={t("hoursPerWeekLabel")} value={o.hoursPerWeek} />
        <Row label={t("benefitsLabel")} value={o.benefits} />
        <Row label={t("jobStartDateLabel")} value={fmtDateLong(o.startDate)} />
        <Row label={t("openingsCountLabel")} value={o.openingsCount} />
        <Row label={t("applicationDeadlineLabel")} value={fmtDateLong(o.applicationDeadline)} />
        <Row label={t("educationLabel")} value={educationLevelLabel(o.education)} />
        <Row label={t("experienceLabel")} value={experienceLevelLabel(o.experience)} />
        <Row label={t("englishLevelRequiredLabel")} value={englishLevelLabel(o.englishLevelRequired)} />
        <Row label={t("transportationRequiredLabel")} value={o.transportationRequired ? t("yesOption") : t("noOption")} />
        <Row label={t("certificationsLabel")} value={(o.certifications || []).join(", ")} />
        <Row label={t("skillsLabel")} value={(o.skills || []).join(", ")} />
        <Row label={t("languagesLabel")} value={(o.languages || []).join(", ")} />
        <Row label={t("applyMethodLabel")} value={applyMethodLabel(o.applyMethod)} />
        {o.applyWebsite && <Row label={t("applyWebsiteLabel")} value={o.applyWebsite} />}
        {o.applyEmail && <Row label={t("applyEmailLabel")} value={o.applyEmail} />}
        <Row label={t("postedDateLabel")} value={fmtDateLong(o.postedDate)} />
        <Row label={t("sourceFieldLabel")} value={sourceLabel(o.source)} />
      </dl>

      <LongText label={t("descriptionLabel")}>{o.description}</LongText>
      <LongText label={t("responsibilitiesLabel")}>{o.responsibilities}</LongText>
      <LongText label={t("requirementsLabel")}>{o.requirements}</LongText>
      <LongText label={t("internalNotesLabel")}>{o.internalNotes}</LongText>
    </Drawer>
  );
}
