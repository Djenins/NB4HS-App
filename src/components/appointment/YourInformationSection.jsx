// YourInformationSection.jsx -- left card of the "Request an Appointment"
// kiosk: how NB4HS can reach the visitor about this request. Four fields, the
// same four the form always submitted (firstName / lastName / phone / email),
// laid out 2x2 on the kiosk so a landscape screen doesn't stack them into a
// tall column, and stacking on their own once the screen is narrow.
import { Mail, Phone, UserRound } from "lucide-react";
import ApptRequestCard from "./ApptRequestCard.jsx";
import { ApptField } from "./ApptRequestField.jsx";

export default function YourInformationSection({ t, errors, open, onToggle }) {
  return (
    <ApptRequestCard
      id="appt-req-your-info"
      icon={UserRound}
      title={t("sectionApptYourInfo")}
      description={t("sectionApptYourInfoDesc")}
      open={open}
      onToggle={onToggle}
    >
      <div className="appt-fields grid gap-x-4 gap-y-3 sm:grid-cols-2 sm:gap-x-5 sm:gap-y-4">
        <ApptField
          name="firstName" label={t("firstName")} required icon={UserRound}
          autoComplete="given-name" placeholder={t("phFirstName")} error={errors.firstName}
        />
        <ApptField
          name="lastName" label={t("lastName")} required icon={UserRound}
          autoComplete="family-name" placeholder={t("phLastName")} error={errors.lastName}
        />
        <ApptField
          name="phone" label={t("phone")} type="tel" required icon={Phone}
          autoComplete="tel" placeholder={t("phPhone")} error={errors.phone}
        />
        <ApptField
          name="email" label={t("email")} type="email" icon={Mail}
          autoComplete="email" placeholder={t("phEmail")}
        />
      </div>
    </ApptRequestCard>
  );
}
