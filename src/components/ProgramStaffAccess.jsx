// ProgramStaffAccess.jsx -- the Staff & Access section of a program's menu
// (Case Management, Food Distribution, Adult Education, Workforce; SNAP has
// its own program-role version, components/snap/SnapStaffSettings.jsx).
// Lists active staff and whether each can open this program
// (user_program_access), the same gate as the Program Access tab of a staff
// account (components/admin/ProgramAccessTab.jsx), seen per program instead
// of per person. Give / remove go through admin_grant_program /
// admin_revoke_program, which audit the change; only access an admin gave
// can be removed here.
//
// Shown to whoever can see staff accounts (admin.users.view, the RLS read
// rule); the buttons need admin.permissions.assign. programStaffVisible()
// is the menu's check.
import { useCallback, useEffect, useState } from "react";
import { Users } from "lucide-react";
import { useApp, useT } from "../context/AppContext.jsx";
import { adminErrorKey, fetchProgramMembers, grantProgram, revokeProgram } from "../lib/adminAccounts.js";
import { avatarColorFor } from "../lib/avatarTone.js";
import { roleLabel } from "../lib/utils.js";
import { ReasonDialog, fmtWhen } from "./admin/adminShared.jsx";
import { LoadError } from "./snap/SnapListParts.jsx";
import { Alert } from "./ui/alert.jsx";
import { Avatar, AvatarFallback } from "./ui/avatar.jsx";
import { Badge } from "./ui/badge.jsx";
import { Button } from "./ui/button.jsx";
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
  const [members, setMembers] = useState(null);
  const [loadError, setLoadError] = useState(false);
  const [pending, setPending] = useState(null); // { person, action: "grant" | "revoke" }

  const load = useCallback(() => {
    setLoadError(false);
    return fetchProgramMembers(program)
      .then(setMembers)
      .catch((e) => { console.warn("fetchProgramMembers failed", e); setLoadError(true); });
  }, [program]);
  useEffect(() => { load(); }, [load]);

  const editable = can("admin.permissions.assign");
  const nameOf = (id) => {
    const p = (data.profiles || []).find((x) => x.id === id);
    return p ? p.name || p.email : "";
  };
  const staff = (data.profiles || [])
    .filter((p) => p.active !== false)
    .slice()
    .sort((a, b) => (a.name || a.email || "").localeCompare(b.name || b.email || ""));

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
  const systemRole = (p) => <Badge variant="neutral">{roleLabel(p.role, lang)}</Badge>;
  const accessCell = (p) => {
    const row = members ? members[p.id] : null;
    return (
      <div className="min-w-0">
        {row ? <Badge variant="success" dot>{t("adminCanOpen")}</Badge> : <Badge variant="neutral">{t("adminNoAccess")}</Badge>}
        {row ? (
          <div className="mt-0.5 text-meta text-muted">
            {row.source === "legacy_sync"
              ? t("adminProgramAutomatic")
              : t("adminProgramGiven").replace("{date}", fmtWhen(row.grantedAt, lang)).replace("{name}", nameOf(row.grantedBy) || "—")}
          </div>
        ) : null}
      </div>
    );
  };
  const actionCell = (p) => {
    if (!editable || !members || (session && p.id === session.id)) return null;
    const row = members[p.id];
    if (!row) return <Button size="sm" variant="secondary" onClick={() => setPending({ person: p, action: "grant" })}>{t("adminGiveAccess")}</Button>;
    if (row.source === "admin") return <Button size="sm" variant="ghost" onClick={() => setPending({ person: p, action: "revoke" })}>{t("adminRemove")}</Button>;
    return null;
  };

  const columns = [
    { key: "person", header: t("staffMember"), cell: person },
    { key: "role", header: t("roleColLabel"), cell: systemRole },
    { key: "access", header: t("programStaffAccessCol"), cell: accessCell },
    { key: "action", header: <span className="sr-only">{t("programStaffAccessCol")}</span>, cell: actionCell, className: "w-36 text-right" }
  ];

  let body;
  if (loadError) {
    body = <LoadError title={t("programStaffLoadError")} onRetry={load} />;
  } else {
    body = (
      <DataTable
        caption={t("programStaffTitle")}
        columns={columns}
        rows={members === null ? [] : staff}
        loading={members === null}
        getRowId={(p) => p.id}
        renderCard={(p) => (
          <>
            <div className="flex items-start justify-between gap-3">
              {person(p)}
              <span className="shrink-0">{systemRole(p)}</span>
            </div>
            <div className="mt-3 flex items-center justify-between gap-3">
              {accessCell(p)}
              {actionCell(p)}
            </div>
          </>
        )}
        empty={<EmptyState icon={Users} title={t("snapNoActiveStaff")} />}
      />
    );
  }

  return (
    <>
      {showHeader && <PageHeader title={t("programStaffTitle")} description={t("programStaffDesc").replace("{program}", programName)} />}
      <Alert tone="info" className="mb-6">{t("programStaffHelp")}</Alert>
      <Card className="p-4 sm:p-5">{body}</Card>

      <ReasonDialog
        open={!!pending}
        onClose={() => setPending(null)}
        required={false}
        danger={pending && pending.action === "revoke"}
        title={pending ? t(pending.action === "grant" ? "adminGiveAccessTitle" : "adminRemoveAccessTitle")
          .replace("{program}", programName).replace("{name}", pending.person.name || pending.person.email) : ""}
        description={pending ? t(pending.action === "grant" ? "adminGiveAccessDesc" : "adminRemoveAccessDesc") : ""}
        confirmLabel={pending && pending.action === "grant" ? t("adminGiveAccess") : t("adminRemove")}
        onConfirm={async (reason) => {
          try {
            if (pending.action === "grant") await grantProgram(pending.person.id, program, reason);
            else await revokeProgram(pending.person.id, program, reason);
            showToast(t(pending.action === "grant" ? "adminAccessGiven" : "adminAccessRemoved"));
            load();
            return true;
          } catch (e) { showToast(t(adminErrorKey(e))); return false; }
        }}
      />
    </>
  );
}
