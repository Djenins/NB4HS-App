// VisitDetailsSection.jsx -- section 03 of the kiosk check-in form. Both
// dropdowns are fed by the same active service/staff lists the form always
// used (Manage Lists drives them), including the "Other" option and its
// follow-up "please specify" input.
import { ClipboardList } from "lucide-react";
import { KIOSK_CONTROL, KioskFieldError, KioskLabel } from "./KioskField.jsx";
import KioskSection from "./KioskSection.jsx";
import KioskSelectField from "./KioskSelectField.jsx";
import { cn } from "../../lib/cn.js";

function OtherInput({ name, t, error }) {
  return (
    <div className="mt-2.5">
      <input
        type="text"
        name={name}
        placeholder={t("otherPleaseSpecify")}
        aria-label={t("otherPleaseSpecify")}
        aria-invalid={error ? "true" : undefined}
        className={cn(KIOSK_CONTROL, "w-full", error && "field-invalid")}
      />
      <KioskFieldError>{error}</KioskFieldError>
    </div>
  );
}

export default function VisitDetailsSection({
  id, sectionRef, t, lang, errors, services, staffList, service, onServiceChange, staff, onStaffChange
}) {
  return (
    <KioskSection id={id} sectionRef={sectionRef} icon={ClipboardList} tone="violet" title={t("sectionVisitDetails")}>
      <div className="grid gap-x-4 gap-y-2.5 lg:grid-cols-2">
        <KioskSelectField
          name="service" id="service-select" label={t("reasonForVisit")} required
          value={service} onChange={onServiceChange} error={errors.service}
          hint={service === "other" ? <OtherInput name="serviceOther" t={t} error={errors.serviceOther} /> : null}
        >
          <option value="">{t("pleaseSelect")}</option>
          {services.map((s) => <option key={s.key} value={s.key}>{s[lang] || s.en}</option>)}
        </KioskSelectField>
        <KioskSelectField
          name="staff" id="staff-select" label={t("staffMember")} required
          value={staff} onChange={onStaffChange} error={errors.staff}
          hint={staff === "other" ? <OtherInput name="staffOther" t={t} error={errors.staffOther} /> : null}
        >
          <option value="">{t("pleaseSelect")}</option>
          {staffList.map((s) => <option key={s.key} value={s.key}>{s[lang] || s.en}</option>)}
        </KioskSelectField>
      </div>
      <div className="mt-2.5">
        <KioskLabel htmlFor="checkin-field-notes">{t("notes")}</KioskLabel>
        <textarea
          name="notes"
          id="checkin-field-notes"
          placeholder={t("phNotes")}
          className={cn(KIOSK_CONTROL, "w-full min-h-[76px] resize-y")}
        />
      </div>
    </KioskSection>
  );
}
