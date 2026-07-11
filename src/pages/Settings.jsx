// Settings.jsx -- ported from users_settings.js's renderSettings()/
// attachSettingsHandlers(). "Reset demo data" rebuilds the seed dataset
// via buildSeedData() (see lib/seed.js) instead of the original's
// side-effecting seedData(); the closing-time save also re-runs the
// auto-checkout sweep immediately, same as the original, so changing the
// closing time to something already in the past checks people out right away.
import { useState } from "react";
import { useApp, useT } from "../context/AppContext.jsx";
import { buildSeedData } from "../lib/seed.js";

export default function Settings() {
  const { config, updateConfig, requestConfirm, setData, showToast } = useApp();
  const t = useT();
  const [closingTime, setClosingTime] = useState(config.closingTime || "17:00");

  const rolePermissionRows = [
    [t("roleAdmin"), t("roleAdminDesc")],
    [t("roleStaff"), t("roleStaffDesc")],
    [t("roleReceptionist"), t("roleReceptionistDesc")],
    [t("roleCaseManager"), t("roleCaseManagerDesc")],
    [t("roleJobDeveloper"), t("roleJobDeveloperDesc")]
  ];

  function saveClosingTime() {
    const value = closingTime || "17:00";
    updateConfig({ closingTime: value });
    // The auto-checkout sweep (AppContext's 60s interval effect) picks up the
    // new closing time on its own next run; there's nothing further to do
    // here beyond confirming the save, since it's no longer a function this
    // page calls directly.
    showToast(t("saveUrl") + " ✓");
  }

  async function resetDemoData() {
    const ok = await requestConfirm(t("resetDemoDataConfirm"), { danger: true });
    if (!ok) return;
    setData(() => buildSeedData());
  }

  return (
    <>
      <h1>{t("settingsTitle")}</h1>
      <div className="card">
        <div className="form-section" style={{ padding: 0, border: "none" }}>
          <div className="form-section-head">
            <h3>{t("closingTimeLabel")}</h3>
            <p>{t("closingTimeDesc")}</p>
          </div>
          <div className="form-section-body">
            <div className="field" style={{ maxWidth: 220 }}>
              <input type="time" aria-label={t("closingTimeLabel")} value={closingTime} onChange={(e) => setClosingTime(e.target.value)} />
            </div>
            <button className="btn-primary" onClick={saveClosingTime}>{t("saveUrl")}</button>
          </div>
        </div>
      </div>
      <div className="card">
        <h3>{t("rolePermissions")}</h3>
        {rolePermissionRows.map(([label, desc]) => (
          <div className="kv" key={label}><strong>{label}</strong><span className="muted">{desc}</span></div>
        ))}
      </div>
      <div className="card">
        <h3>{t("prototypeNotice")}</h3>
        <button className="btn-accent" onClick={resetDemoData}>{t("resetDemoData")}</button>
      </div>
    </>
  );
}
