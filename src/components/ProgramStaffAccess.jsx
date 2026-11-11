// ProgramStaffAccess.jsx -- the Staff & Access section of a program's menu
// (Case Management, Food Distribution, Adult Education, Workforce; SNAP has
// its own program-role version, components/snap/SnapStaffSettings.jsx).
// Lists active staff and each one's level in this program -- No access,
// Staff or Manager (lib/accessLevels.js) -- the same choice as the Access tab
// of a staff account, seen per program instead of per person.
//
// Someone on access levels gets a dropdown here; changing it saves their
// levels with only this program changed (admin_set_access_levels). Someone
// whose access still follows their account type shows their level and a link
// to their account, where they can be switched to levels.
//
// Shown to whoever can see staff accounts (admin.users.view, the RLS read
// rule); the dropdowns need admin.permissions.assign. programStaffVisible()
// is the menu's check.
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Users } from "lucide-react";
import { useApp, useT } from "../context/AppContext.jsx";
import { adminErrorKey } from "../lib/adminAccounts.js";
import { LEVEL_LABEL, fetchAccessLevels, saveAccessLevels } from "../lib/accessLevels.js";
import { avatarColorFor } from "../lib/avatarTone.js";
import { roleLabel } from "../lib/utils.js";
import { ReasonDialog } from "./admin/adminShared.jsx";
import { LevelSelect } from "./admin/AccessLevels.jsx";
import { LoadError } from "./snap/SnapListParts.jsx";
import { Alert } from "./ui/alert.jsx";
import { Avatar, AvatarFallback } from "./ui/avatar.jsx";
import { Badge } from "./ui/badge.jsx";
import { Card } from "./ui/card.jsx";
import { DataTable } from "./ui/data-table.jsx";
import { EmptyState } from "./ui/empty-state.jsx";
import { PageHeader } from "./ui/page-header.jsx";

export function programStaffVisible(can) {
  return !!can && can("admin.users.view");
}

function initials(name, email) {
  const parts = ((name || "").trim() || email || "").split(/\s+/).filter(Boolean);
  return (((parts[0] || "")[0] || "") + ((parts[1] || "")[0] || "")).toUpperCase() || "?";
}

// `program`: the app_modules key (case_management, food_distribution,
// students, workforce); `programName`: its display name.
export default function ProgramStaffAccess({ program, programName, showHeader = true }) {
  const { data, lang, session, can, showToast } = useApp();
  const t = useT();
  const [levels, setLevels] = useState(null); // { [userId]: { access, mode } }
  const [loadError, setLoadError] = useState(false);
  const [pending, setPending] = useState(null); // { person, level }

  const load = useCallback(() => {
    setLoadError(false);
    return fetchAccessLevels()
      .then(setLevels)
      .catch((e) => { console.warn("fetchAccessLevels failed", e); setLoadError(true); });
  }, []);
  useEffect(() => { load(); }, [load]);

  const editable = can("admin.permissions.assign");
  const staff = (data.profiles || [])
    .filter((p) => p.active !== false)
    .slice()
    .sort((a, b) => (a.name || a.email || "").localeCompare(b.name || b.email || ""));
  const entry = (p) => (levels ? levels[p.id] : null);
  const levelOf = (p) => { const e = entry(p); return e ? e.access.levels[program] || "none" : "none"; };

  const person = (p) => (
    <div className="flex min-w-0 items-center gap-3">
      <Avatar className="h-9 w-9">
        <AvatarFallback className={avatarColorFor(p.name || p.email)}>{initials(p.name, p.email)}</AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <div className="truncate text-ui font-semibold text-card-foreground">{p.name || "—"}</div>
        <div className="truncate text-meta text-muted">{p.email}</div>
      </div>
    </div>
  );
  const accessCell = (p) => {
    const e = entry(p);
    const level = levelOf(p);
    const self = session && p.id === session.id;
    if (e && e.mode === "levels" && editable && !self) {
      return (
        <LevelSelect id={"level-" + p.id} value={level} label={t("programStaffAccessCol") + ": " + (p.name || p.email)}
          onChange={(next) => { if (next !== level) setPending({ person: p, level: next }); }} />
      );
    }
    return (
      <div className="min-w-0">
        <Badge variant={level === "manager" ? "info" : level === "staff" ? "success" : "neutral"} dot={level !== "none"}>{t(LEVEL_LABEL[level])}</Badge>
        {e && e.mode !== "levels" ? (
          <div className="mt-0.5 text-meta text-muted">
            {t("accessFollowsTypeShort").replace("{type}", roleLabel(p.role, lang))}
            {editable && !self ? <> · <Link to={"/admin/users/" + p.id}>{t("accessChangeOnAccount")}</Link></> : null}
          </div>
        ) : null}
      </div>
    );
  };

  const columns = [
    { key: "person", header: t("staffMember"), cell: person },
    { key: "access", header: t("programStaffAccessCol"), cell: accessCell, className: "w-64" }
  ];

  let body;
  if (loadError) {
    body = <LoadError title={t("programStaffLoadError")} onRetry={load} />;
  } else {
    body = (
      <DataTable
        caption={t("programStaffTitle")}
        columns={columns}
        rows={levels === null ? [] : staff}
        loading={levels === null}
        getRowId={(p) => p.id}
        renderCard={(p) => (
          <div className="flex flex-col gap-3">
            {person(p)}
            {accessCell(p)}
          </div>
        )}
        empty={<EmptyState icon={Users} title={t("snapNoActiveStaff")} />}
      />
    );
  }

  return (
    <>
      {showHeader && <PageHeader title={t("programStaffTitle")} description={t("programStaffDesc").replace("{program}", programName)} />}
      <Alert tone="info" className="mb-6">{t("programStaffLevelsHelp")}</Alert>
      <Card className="p-4 sm:p-5">{body}</Card>

      <ReasonDialog
        open={!!pending}
        onClose={() => setPending(null)}
        required={false}
        danger={pending && pending.level === "none"}
        title={pending ? t("programStaffChangeTitle").replace("{name}", pending.person.name || pending.person.email)
          .replace("{program}", programName).replace("{level}", t(LEVEL_LABEL[pending.level])) : ""}
        description={t("programStaffChangeDesc")}
        confirmLabel={t("accessSave")}
        onConfirm={async (reason) => {
          const e = entry(pending.person);
          try {
            await saveAccessLevels(pending.person.id, { ...e.access, levels: { ...e.access.levels, [program]: pending.level } }, reason);
            showToast(t("accessSaved"));
            load();
            return true;
          } catch (err) { showToast(t(adminErrorKey(err))); return false; }
        }}
      />
    </>
  );
}
