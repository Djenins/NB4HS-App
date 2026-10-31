// Settings.jsx -- System Settings (/admin/settings), ported from
// users_settings.js's renderSettings()/attachSettingsHandlers(). The
// closing time is the organization's since Phase 5 (app_settings, through
// admin_set_setting), so every staff browser checks people out at the same
// time; until the server has one, each browser keeps its own as before. The
// next auto-checkout sweep picks up a change within a minute.
//
// The original prototype's "Reset Demo Data" button (which rebuilt a local
// seed dataset via buildSeedData()) was removed once the app moved to
// Supabase: visits/students/clients/etc. are now real production data, and
// setData() no longer even touches those Supabase-backed fields, so the
// button had become a silent no-op rather than something safe to wire up to
// an actual data wipe.
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Boxes, Briefcase, Building2, CheckCircle2, Clock, ListChecks, Power, PowerOff, ShieldCheck, UserRound, Users } from "lucide-react";
import { useApp, useT } from "../context/AppContext.jsx";
import { setWorkforceRoleAccess } from "../lib/clientsData.js";
import { saveAppSetting } from "../lib/permissionAdmin.js";
import { effectiveClosingTime } from "../lib/storage.js";
import { useNavItems } from "../lib/useNavItems.js";
import { cn } from "../lib/cn.js";
import { Badge } from "../components/ui/badge.jsx";
import { Button } from "../components/ui/button.jsx";
import { Field, Input } from "../components/ui/field.jsx";
import { PageHeader } from "../components/ui/page-header.jsx";
import { SectionCard } from "../components/ui/section-card.jsx";

// The 4 non-administrator roles the Workforce Development toggle applies to
// -- administrator always has access (see lib/nav.js), so it isn't one of
// these rows, it gets a plain "Always has access" badge instead.
const WORKFORCE_TOGGLE_ROLES = [
  { key: "staff", labelKey: "roleStaff" },
  { key: "receptionist", labelKey: "roleReceptionist" },
  { key: "case_manager", labelKey: "roleCaseManager" },
  { key: "job_developer", labelKey: "roleJobDeveloper" }
];

export default function Settings() {
  const { config, updateConfig, showToast, data, can, orgSettings, refetchOrgSettings } = useApp();
  const t = useT();
  const { items } = useNavItems();
  const savedClosingTime = effectiveClosingTime(orgSettings, config);
  const [closingTime, setClosingTime] = useState(savedClosingTime);
  const [savingClosing, setSavingClosing] = useState(false);
  // The organization's value arrives after the first render.
  useEffect(() => { setClosingTime(savedClosingTime); }, [savedClosingTime]);
  // Optimistic local overrides so a click flips the toggle immediately
  // instead of waiting on the round trip + realtime refetch -- same pattern
  // as ManageListCard.jsx's services/staff/industries toggles.
  const [workforceOverrides, setWorkforceOverrides] = useState({});

  const workforceAccessByRole = {};
  (data.workforceRoleAccess || []).forEach((r) => { workforceAccessByRole[r.role] = r.enabled; });
  function isWorkforceEnabled(role) { return role in workforceOverrides ? workforceOverrides[role] : !!workforceAccessByRole[role]; }

  async function toggleWorkforceAccess(role, nextEnabled) {
    setWorkforceOverrides((prev) => Object.assign({}, prev, { [role]: nextEnabled }));
    try {
      await setWorkforceRoleAccess(role, nextEnabled);
    } catch (err) {
      setWorkforceOverrides((prev) => { const next = Object.assign({}, prev); delete next[role]; return next; });
      showToast(t("manageToggleError"));
      throw err;
    }
  }

  const rolePermissionRows = [
    [t("roleAdmin"), t("roleAdminDesc"), Users, "danger"],
    [t("roleStaff"), t("roleStaffDesc"), UserRound, "violet"],
    [t("roleReceptionist"), t("roleReceptionistDesc"), Building2, "success"],
    [t("roleCaseManager"), t("roleCaseManagerDesc"), Briefcase, "warning"],
    [t("roleJobDeveloper"), t("roleJobDeveloperDesc"), Briefcase, "info"]
  ];

  // Saved for everyone when you may change organization settings; this
  // browser keeps a copy either way, and is all that changes if the server
  // save isn't possible.
  async function saveClosingTime() {
    const value = closingTime || "17:00";
    updateConfig({ closingTime: value });
    if (!can("admin.settings.manage")) { showToast(t("closingTimeSavedDevice")); return; }
    setSavingClosing(true);
    try {
      await saveAppSetting("closing_time", value, null);
      await refetchOrgSettings();
      showToast(t("closingTimeSavedAll"));
    } catch (e) {
      // With an organization value in place, this browser's copy doesn't apply.
      showToast(t(orgSettings && orgSettings.closing_time ? "closingTimeSaveFailed" : "closingTimeSavedDevice"));
    }
    setSavingClosing(false);
  }

  const related = [
    items.indexOf("manage") !== -1 ? { to: "/manage", icon: ListChecks, label: "settingsLinkManage", desc: "settingsLinkManageDesc" } : null,
    can("admin.programs.manage") ? { to: "/admin/programs", icon: Boxes, label: "adminSectionPrograms", desc: "settingsLinkProgramsDesc" } : null,
    can("admin.roles.view") ? { to: "/admin/roles", icon: ShieldCheck, label: "adminSectionRoles", desc: "settingsLinkRolesDesc" } : null
  ].filter(Boolean);

  return (
    <>
      <PageHeader title={t("settingsTitle")} description={t("settingsSubtitle")} />

      <div className="flex flex-col gap-6">
        <SectionCard title={<SectionTitle icon={Clock}>{t("closingTimeLabel")}</SectionTitle>} description={t("closingTimeDesc")}>
          <ul className="m-0 flex list-none flex-col gap-2 p-0 text-ui text-card-foreground">
            {["closingTimeBulletOnLoad", "closingTimeBulletEveryMinute"].map((k) => (
              <li key={k} className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 text-tone-success-ink" aria-hidden="true" />
                <span>{t(k)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-5 flex flex-wrap items-end gap-3">
            <Field label={t("closingTimeLabel")} htmlFor="settings-closing-time" className="w-full max-w-[220px]">
              <Input id="settings-closing-time" type="time" className="tabular-nums" value={closingTime} onChange={(e) => setClosingTime(e.target.value)} />
            </Field>
            <Button onClick={saveClosingTime} loading={savingClosing}>{t("saveUrl")}</Button>
          </div>
          <p className="m-0 mt-3 text-meta text-muted">{t(can("admin.settings.manage") ? "closingTimeForEveryone" : "closingTimeThisDevice")}</p>
        </SectionCard>

        <SectionCard title={<SectionTitle icon={ShieldCheck}>{t("rolePermissions")}</SectionTitle>}>
          <ul className="m-0 list-none divide-y divide-line-subtle p-0">
            {rolePermissionRows.map(([label, desc, RoleIcon, tone]) => (
              <li key={label} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-chip", TONE_DISC[tone])}>
                  <RoleIcon className="h-[18px] w-[18px]" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="m-0 text-ui font-semibold text-card-foreground">{label}</p>
                  <p className="m-0 mt-0.5 text-meta text-muted">{desc}</p>
                </div>
              </li>
            ))}
          </ul>
        </SectionCard>

        <SectionCard title={<SectionTitle icon={Briefcase}>{t("workforceAccessSettingsTitle")}</SectionTitle>} description={t("workforceAccessSettingsDesc")}>
          <ul className="m-0 list-none divide-y divide-line-subtle p-0">
            <li className="flex min-h-[52px] flex-wrap items-center justify-between gap-3 py-2 first:pt-0">
              <span className="text-ui font-semibold text-card-foreground">{t("roleAdmin")}</span>
              <Badge variant="info">{t("alwaysHasAccessLabel")}</Badge>
            </li>
            {WORKFORCE_TOGGLE_ROLES.map(({ key, labelKey }) => {
              const enabled = isWorkforceEnabled(key);
              return (
                <li key={key} className="flex min-h-[52px] flex-wrap items-center justify-between gap-3 py-2 last:pb-0">
                  <span className="text-ui font-semibold text-card-foreground">{t(labelKey)}</span>
                  <div className="flex items-center gap-3">
                    <Badge variant={enabled ? "success" : "neutral"} dot>{enabled ? t("activeLabel") : t("inactiveLabel")}</Badge>
                    <Button
                      size="sm"
                      variant={enabled ? "ghost" : "secondary"}
                      aria-label={t(enabled ? "adminTurnOff" : "adminTurnOn") + " — " + t(labelKey)}
                      onClick={() => toggleWorkforceAccess(key, !enabled).catch(() => {})}
                    >
                      {enabled ? <PowerOff className="h-4 w-4" aria-hidden="true" /> : <Power className="h-4 w-4" aria-hidden="true" />}
                      {t(enabled ? "adminTurnOff" : "adminTurnOn")}
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        </SectionCard>

        {related.length ? (
          <SectionCard title={t("settingsRelatedTitle")}>
            <ul className="m-0 list-none divide-y divide-line-subtle p-0">
              {related.map((r) => (
                <li key={r.to} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                  <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-chip", TONE_DISC.info)}>
                    <r.icon className="h-[18px] w-[18px]" aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <Link to={r.to} className="text-ui font-semibold text-primary hover:underline">{t(r.label)}</Link>
                    <p className="m-0 mt-0.5 text-meta text-muted">{t(r.desc)}</p>
                  </div>
                </li>
              ))}
            </ul>
          </SectionCard>
        ) : null}
      </div>
    </>
  );
}

const TONE_DISC = {
  info: "bg-tone-info-chip text-tone-info-ink",
  success: "bg-tone-success-chip text-tone-success-ink",
  warning: "bg-tone-warning-chip text-tone-warning-ink",
  danger: "bg-tone-danger-chip text-tone-danger-ink",
  violet: "bg-tone-violet-chip text-tone-violet-ink"
};

// A section title with its icon disc, the same 36px disc the role rows use.
function SectionTitle({ icon: SectionIcon, children }) {
  return (
    <span className="flex items-center gap-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-chip bg-primary-tint text-primary">
        <SectionIcon className="h-[18px] w-[18px]" aria-hidden="true" />
      </span>
      {children}
    </span>
  );
}
