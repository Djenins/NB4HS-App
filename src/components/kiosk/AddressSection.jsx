// AddressSection.jsx -- section 02 of the kiosk check-in form. The State
// select keeps its original US_STATES options and its "RI" default.
import { MapPin } from "lucide-react";
import KioskField from "./KioskField.jsx";
import KioskSection from "./KioskSection.jsx";
import KioskSelectField from "./KioskSelectField.jsx";
import { US_STATES } from "../../lib/constants.js";

export default function AddressSection({ id, sectionRef, t, errors }) {
  return (
    <KioskSection id={id} sectionRef={sectionRef} icon={MapPin} tone="soft" title={t("sectionAddress")}>
      <KioskField name="address" label={t("address")} required placeholder={t("phAddress")} error={errors.address} />
      <div className="mt-2.5 grid grid-cols-2 gap-x-4 gap-y-2.5 xl:grid-cols-[1.4fr_0.7fr_0.9fr]">
        <KioskField
          name="city" label={t("city")} required placeholder={t("phCity")}
          error={errors.city} className="col-span-2 xl:col-span-1"
        />
        <KioskSelectField name="state" id="checkin-field-state" label={t("state")} required defaultValue="RI">
          {US_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
        </KioskSelectField>
        <KioskField name="zip" label={t("zip")} required placeholder={t("phZip")} error={errors.zip} />
      </div>
    </KioskSection>
  );
}
