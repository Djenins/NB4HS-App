// VisitorInformationSection.jsx -- section 1 of the kiosk check-in form:
// name, phone and email. Date and time aren't asked here: the kiosk's top
// bar shows them and the visit record stamps its own on submit.
import { UserRound } from "lucide-react";
import KioskField from "./KioskField.jsx";
import KioskSection from "./KioskSection.jsx";

export default function VisitorInformationSection({ id, sectionRef, t, errors }) {
  return (
    <KioskSection id={id} sectionRef={sectionRef} icon={UserRound} tone="primary" title={t("sectionVisitorInfo")}>
      <div className="grid gap-x-4 gap-y-3 [@container(min-width:28rem)]:grid-cols-2">
        <KioskField name="firstName" label={t("firstName")} required placeholder={t("phFirstName")} error={errors.firstName} />
        <KioskField name="lastName" label={t("lastName")} required placeholder={t("phLastName")} error={errors.lastName} />
        <KioskField name="phone" label={t("phone")} type="tel" required placeholder={t("phPhone")} error={errors.phone} />
        <KioskField name="email" label={t("email")} type="email" placeholder={t("phEmail")} error={errors.email} />
      </div>
    </KioskSection>
  );
}
