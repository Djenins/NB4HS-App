// MileageRateCard.jsx -- System Settings: the organization's mileage
// reimbursement rate (app_settings 'mileage_rate', saved through
// admin_set_setting; m1_mileage_log). My Mileage and the printed mileage sheet
// multiply each month's miles by it. Administrators only; staff-only, so English.
import { useEffect, useState } from "react";
import { Car } from "lucide-react";
import { useApp } from "../context/AppContext.jsx";
import { fmtMoney, orgMileageRate } from "../lib/mileage.js";
import { saveAppSetting } from "../lib/permissionAdmin.js";
import { Button } from "./ui/button.jsx";
import { Field, Input } from "./ui/field.jsx";
import { SectionCard } from "./ui/section-card.jsx";

export default function MileageRateCard({ title }) {
  const { orgSettings, refetchOrgSettings, showToast } = useApp();
  const saved = orgMileageRate(orgSettings);
  const [value, setValue] = useState(saved === null ? "" : String(saved));
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => { setValue(saved === null ? "" : String(saved)); }, [saved]);

  async function save(e) {
    e.preventDefault();
    const n = Number(value);
    if (value.trim() === "" || !Number.isFinite(n) || n < 0 || n > 5 || Math.round(n * 1000) !== n * 1000) {
      setError("Enter dollars per mile between 0 and 5, like 0.70.");
      return;
    }
    setError("");
    setSaving(true);
    try {
      await saveAppSetting("mileage_rate", n, null);
      await refetchOrgSettings();
      showToast("Mileage rate saved.");
    } catch (err) {
      console.warn("save mileage_rate failed", err);
      showToast("Couldn't save the mileage rate. Try again.");
    }
    setSaving(false);
  }

  return (
    <SectionCard
      title={title || <span className="flex items-center gap-2"><Car className="h-5 w-5" aria-hidden="true" />Mileage reimbursement rate</span>}
      description="What NB4HS pays per mile when staff drive their own car for work. My Mileage and the printed mileage sheets use it."
    >
      <form className="flex flex-wrap items-end gap-3" onSubmit={save} noValidate>
        <Field label="Dollars per mile" htmlFor="settings-mileage-rate" error={error} className="w-full max-w-[220px]">
          <Input id="settings-mileage-rate" type="number" inputMode="decimal" step="0.001" min="0" max="5" className="tabular-nums"
            value={value} onChange={(e) => setValue(e.target.value)} aria-invalid={!!error} placeholder="0.70" />
        </Field>
        <Button type="submit" loading={saving}>Save</Button>
      </form>
      <p className="m-0 mt-3 text-meta text-muted">
        {saved === null ? "No rate set yet: mileage sheets print with the rate and amount left blank." : "Now " + fmtMoney(saved) + " a mile."}
      </p>
    </SectionCard>
  );
}
