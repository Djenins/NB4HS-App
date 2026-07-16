// Settings.jsx -- ported from users_settings.js's renderSettings()/
// attachSettingsHandlers(). "Reset demo data" rebuilds the seed dataset
// via buildSeedData() (see lib/seed.js) instead of the original's
// side-effecting seedData(); the closing-time save also re-runs the
// auto-checkout sweep immediately, same as the original, so changing the
// closing time to something already in the past checks people out right away.
import { useState } from "react";
import { AlertTriangle, Briefcase, Building2, CheckCircle2, ChevronDown, Clock, Info, ShieldCheck, Trash2, UserRound, Users } from "lucide-react";
import { useApp, useT } from "../context/AppContext.jsx";
import { buildSeedData } from "../lib/seed.js";

export default function Settings() {
  const { config, updateConfig, requestConfirm, setData, showToast } = useApp();
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

  async function resetDemoData() {
    const ok = await requestConfirm(t("resetDemoDataConfirm"), { danger: true });
    if (!ok) return;
    setData(() => buildSeedData());
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
              <label>{t("closingTimeLabel")}</label>
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
          <details className="role-row" key={label}>
            <summary>
              <div className={"icon-badge round" + (variant ? " " + variant : "")}>{icon}</div>
              <strong>{label}</strong>
              <ChevronDown className="icon icon-chevron" />
            </summary>
            <p>{desc}</p>
          </details>
        ))}
      </div>

      <div className="card card-danger">
        <div className="flex-between" style={{ alignItems: "flex-start", gap: 20 }}>
          <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
            <div className="icon-badge accent"><AlertTriangle className="icon" /></div>
            <div>
              <h3 style={{ margin: 0, color: "var(--accent-dark)" }}>{t("developmentModeTitle")}</h3>
              <p className="muted" style={{ margin: "4px 0 0", fontSize: ".9rem", maxWidth: 480 }}>{t("prototypeNotice")}</p>
            </div>
          </div>
          <div style={{ textAlign: "right", flex: "0 0 auto" }}>
            <button className="btn-outline-danger" onClick={resetDemoData}>
              <Trash2 className="icon" style={{ marginRight: 6 }} /> {t("resetDemoData")}
            </button>
            <p className="muted" style={{ fontSize: ".8rem", marginTop: 8 }}>{t("resetDemoDataDesc")}</p>
          </div>
        </div>
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
