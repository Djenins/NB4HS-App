// VisitorInformationSection.jsx -- section 01 of the kiosk check-in form.
// Date and Time In keep the original behaviour exactly: read-only, filled in
// automatically for display only (the submitted record still stamps its own
// date/timeIn at submit time in CheckInVisitor.jsx).
import { Calendar, Clock, Mail, Phone, UserRound } from "lucide-react";
import KioskField from "./KioskField.jsx";
import KioskSection from "./KioskSection.jsx";

export default function VisitorInformationSection({ id, sectionRef, t, errors, dateValue, timeValue }) {
  return (
    <KioskSection id={id} sectionRef={sectionRef} icon={UserRound} tone="primary" title={t("sectionVisitorInfo")}>
      <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 xl:grid-cols-[1.2fr_0.8fr_1fr_1fr]">
        <KioskField name="date" label={t("date")} icon={Calendar} value={dateValue} disabled readOnly />
        <KioskField name="timeIn" label={t("timeIn")} icon={Clock} value={timeValue} disabled readOnly />
        <KioskField
          name="firstName" label={t("firstName")} required placeholder={t("phFirstName")}
          error={errors.firstName} className="col-span-2 sm:col-span-1"
        />
        <KioskField
          name="lastName" label={t("lastName")} required placeholder={t("phLastName")}
          error={errors.lastName} className="col-span-2 sm:col-span-1"
        />
      </div>
      <div className="mt-2.5 grid gap-x-4 gap-y-2.5 sm:grid-cols-2">
        <KioskField
          name="phone" label={t("phone")} type="tel" required icon={Phone}
          placeholder={t("phPhone")} error={errors.phone}
        />
        <KioskField
          name="email" label={t("email")} type="email" icon={Mail}
          placeholder={t("phEmail")} error={errors.email}
        />
      </div>
    </KioskSection>
  );
}
