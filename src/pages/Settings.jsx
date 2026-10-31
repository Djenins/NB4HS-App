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
//
// On the NB4HS Operate design system (plans/ui-design-system.md, batch 3e):
// PageHeader, SectionCards of divided rows, and ActiveToggle switches. The
// save and toggle calls are the same as before.
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Boxes, Briefcase, Building2, CheckCircle2, ChevronRight, ListChecks, ShieldCheck, UserRound, Users } from "lucide-react";
import { useApp, useT } from "../context/AppContext.jsx";
import { setWorkforceRoleAccess } from "../lib/clientsData.js";
import { saveAppSetting } from "../lib/permissionAdmin.js";
import { effectiveClosingTime } from "../lib/storage.js";
import { useNavItems } from "../lib/useNavItems.js";
import { cn } from "../lib/cn.js";
import { ActiveToggle } from "../components/ManageListCard.jsx";
import { Badge } from "../components/ui/badge.jsx";
import { Button } from "../components/ui/button.jsx";
import { Input } from "../components/ui/field.jsx";
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

// Icon discs for the role list: one tone per role, as a visual anchor only
// (each row names its role). Never red: red means something is wrong.
const DISC = {
  info: "bg-tone-info-chip text-tone-info-ink",
  violet: "bg-tone-violet-chip text-tone-violet-ink",
  success: "bg-tone-success-chip text-tone-success-ink",
  warning: "bg-tone-warning-chip text-tone-warning-ink",
  neutral: "bg-tone-neutral-chip text-tone-neutral-ink"
};

// A divided-list row: icon disc, title, one line under it.
function IconRow({ icon: Icon, tone = "info", title, children }) {
  return (
    <li className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
      <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-chip", DISC[tone])}>
        <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
      </span>
      <div className="min-w-0 pt-0.5">
        <div className="text-ui font-semibold text-card-foreground">{title}</div>
        <p className="m-0 mt-0.5 text-meta text-muted">{children}</p>
      </div>
    </li>
  );
}

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
    [t("roleAdmin"), t("roleAdminDesc"), Users, "info"],
    [t("roleStaff"), t("roleStaffDesc"), UserRound, "violet"],
    [t("roleReceptionist"), t("roleReceptionistDesc"), Building2, "success"],
    [t("roleCaseManager"), t("roleCaseManagerDesc"), Briefcase, "warning"],
    [t("roleJobDeveloper"), t("roleJobDeveloperDesc"), Briefcase, "neutral"]
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

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-2">
        <SectionCard title={t("closingTimeLabel")} description={t("closingTimeDesc")}>
          <ul className="m-0 list-none space-y-2 p-0">
            {["closingTimeBulletOnLoad", "closingTimeBulletEveryMinute"].map((k) => (
              <li key={k} className="flex items-start gap-2 text-ui text-card-foreground">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-tone-success-ink" aria-hidden="true" />
                <span>{t(k)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <Input type="time" aria-label={t("closingTimeLabel")} aria-describedby="closing-time-scope" value={closingTime} onChange={(e) => setClosingTime(e.target.value)} className="w-40 tabular-nums" />
            <Button onClick={saveClosingTime} loading={savingClosing}>{t("saveUrl")}</Button>
          </div>
          <p id="closing-time-scope" className="m-0 mt-2 text-meta text-muted">{t(can("admin.settings.manage") ? "closingTimeForEveryone" : "closingTimeThisDevice")}</p>
        </SectionCard>

        <SectionCard title={t("workforceAccessSettingsTitle")} description={t("workforceAccessSettingsDesc")}>
          <ul className="m-0 list-none divide-y divide-line-subtle p-0">
            <li className="flex min-h-11 items-center justify-between gap-3 py-2 first:pt-0">
              <span className="text-ui text-card-foreground">{t("roleAdmin")}</span>
              <Badge variant="info">{t("alwaysHasAccessLabel")}</Badge>
            </li>
            {WORKFORCE_TOGGLE_ROLES.map(({ key, labelKey }) => {
              const enabled = isWorkforceEnabled(key);
              return (
                <li key={key} className="flex min-h-11 items-center justify-between gap-3 py-2 last:pb-0">
                  <span className="text-ui text-card-foreground">{t(labelKey)}</span>
                  <ActiveToggle name={t(labelKey)} active={enabled} onToggle={() => toggleWorkforceAccess(key, !enabled)} />
                </li>
              );
            })}
          </ul>
        </SectionCard>

        <SectionCard title={t("rolePermissions")}>
          <ul className="m-0 list-none divide-y divide-line-subtle p-0">
            {rolePermissionRows.map(([label, desc, icon, tone]) => (
              <IconRow key={label} icon={icon} tone={tone} title={label}>{desc}</IconRow>
            ))}
          </ul>
        </SectionCard>

        {related.length ? (
          <SectionCard title={t("settingsRelatedTitle")}>
            <ul className="m-0 list-none divide-y divide-line-subtle p-0">
              {related.map((r) => (
                <li key={r.to} className="py-1 first:pt-0 last:pb-0">
                  <Link
                    to={r.to}
                    className="group -mx-2 flex items-center gap-3 rounded-control px-2 py-2 no-underline transition-colors duration-fast hover:bg-surface-sunken focus-visible:outline-none focus-visible:ring-2"
                  >
                    <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-chip", DISC.info)}>
                      <r.icon className="h-[18px] w-[18px]" aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-ui font-semibold text-card-foreground group-hover:text-primary">{t(r.label)}</span>
                      <span className="mt-0.5 block text-meta text-muted">{t(r.desc)}</span>
                    </span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
          </SectionCard>
        ) : null}
      </div>
    </>
  );
}
