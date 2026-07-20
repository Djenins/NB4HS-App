// Settings.jsx -- ported from users_settings.js's renderSettings()/
// attachSettingsHandlers(). The closing-time save re-runs the auto-checkout
// sweep immediately, same as the original, so changing the closing time to
// something already in the past checks people out right away.
//
// The original prototype's "Reset Demo Data" button (which rebuilt a local
// seed dataset via buildSeedData()) was removed once the app moved to
// Supabase: visits/students/clients/etc. are now real production data, and
// setData() no longer even touches those Supabase-backed fields, so the
// button had become a silent no-op rather than something safe to wire up to
// an actual data wipe.
import { useState } from "react";
import { Briefcase, Building2, CheckCircle2, Clock, Info, ShieldCheck, UserRound, Users } from "lucide-react";
import { useApp, useT } from "../context/AppContext.jsx";

export default function Settings() {
  const { config, updateConfig, showToast } = useApp();
  const t = useT();
  const [closingTime, setClosingTime] = useState(config.closingTime || "17:00");

  const rolePermissionRows = [
    [t("roleAdmin"), t("roleAdminDesc"), <Users className="icon" />, "accent"],
    [t("roleStaff"), t("roleStaffDesc"), <UserRound className="icon" />, "violet"],
    [t("roleReceptionist"), t("roleReceptionistDesc"), <Building2 className="icon" />, "success"],
    [t("roleCaseManager"), t("roleCaseManagerDesc"), <Briefcase className="icon" />, "warn"],
    [t("roleJobDeveloper"), t("roleJobDeveloperDesc"), <Briefcase className="icon" />, ""]
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

  return (
    <>
      <div>
        <h1>{t("settingsTitle")}</h1>
        <p className="muted" style={{ marginTop: -8 }}>{t("settingsSubtitle")}</p>
      </div>

      <div className="card">
        <div className="form-section" style={{ padding: 0, border: "none" }}>
          <div className="form-section-head-row">
            <div className="icon-badge"><Clock className="icon" /></div>
            <div className="form-section-head">
              <h3>{t("closingTimeLabel")}</h3>
              <p>{t("closingTimeDesc")}</p>
            </div>
          </div>
          <div className="form-section-body">
            <div className="tip-row"><CheckCircle2 className="icon" /> <span>{t("closingTimeBulletOnLoad")}</span></div>
            <div className="tip-row"><CheckCircle2 className="icon" /> <span>{t("closingTimeBulletEveryMinute")}</span></div>
            <div className="field" style={{ maxWidth: 220, marginTop: 16 }}>
              <input type="time" aria-label={t("closingTimeLabel")} value={closingTime} onChange={(e) => setClosingTime(e.target.value)} />
            </div>
            <button className="btn-primary" onClick={saveClosingTime}>{t("saveUrl")}</button>
            <p className="muted" style={{ fontSize: ".82rem", marginTop: 10 }}>{t("closingTimeSavedAuto")}</p>
          </div>
        </div>
      </div>

      <div className="card">
        <div style={{ display: "flex", gap: 14, alignItems: "center", marginBottom: 8 }}>
          <div className="icon-badge"><ShieldCheck className="icon" /></div>
          <div>
            <h3 style={{ margin: 0 }}>{t("rolePermissions")}</h3>
          </div>
        </div>
        {rolePermissionRows.map(([label, desc, icon, variant]) => (
          <div className="role-row" key={label}>
            <div className={"icon-badge round" + (variant ? " " + variant : "")}>{icon}</div>
            <div className="role-row-body">
              <strong>{label}</strong>
              <p>{desc}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="info-callout">
        <Info className="icon" />
        <div>
          <strong>{t("aboutPrototypeTitle")}</strong>
          <p>{t("aboutPrototypeDesc")}</p>
        </div>
      </div>
    </>
  );
}
