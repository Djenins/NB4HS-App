// SnapStaffSettings.jsx -- grant, change or revoke roles in the current
// outreach program. Shown to system administrators and that program's
// program admins (outreachSectionsFor() in lib/outreachPrograms.js); the
// program_staff RLS policies enforce the same rule
// server-side. Lists active staff profiles only -- an inactive account
// can't use a role anyway (has_program_role() requires an active profile).
// Every change lands in audit_events via the table's trigger.
//
// PageHeader, the "how roles work" note, then a DataTable (stacked rows
// below lg) with one role select per person.
import { useEffect, useState } from "react";
import { Users } from "lucide-react";
import { useApp, useT } from "../../context/AppContext.jsx";
import { useOutreachProgram } from "../../context/OutreachProgramContext.jsx";
import { PROGRAM_ROLES, fetchProgramStaff, setProgramRole } from "../../lib/programStaff.js";
import { avatarColorFor } from "../../lib/avatarTone.js";
import { roleLabel } from "../../lib/utils.js";
import { Alert } from "../ui/alert.jsx";
import { Avatar, AvatarFallback } from "../ui/avatar.jsx";
import { Badge } from "../ui/badge.jsx";
import { Card } from "../ui/card.jsx";
import { DataTable } from "../ui/data-table.jsx";
import { EmptyState } from "../ui/empty-state.jsx";
import { Select } from "../ui/field.jsx";
import { PageHeader } from "../ui/page-header.jsx";
import { LoadError } from "./SnapListParts.jsx";
import { snapRoleLabelKey } from "./snapRoleLabel.js";

function initials(name, email) {
  const parts = ((name || "").trim() || email || "").split(/\s+/).filter(Boolean);
  return (((parts[0] || "")[0] || "") + ((parts[1] || "")[0] || "")).toUpperCase() || "?";
}

export default function SnapStaffSettings() {
  const { data, lang, session, showToast, refetchProgramRoles } = useApp();
  const t = useT();
  const { program } = useOutreachProgram();
  const [members, setMembers] = useState(null);
  const [loadError, setLoadError] = useState(false);
  const [savingId, setSavingId] = useState(null);

  function load() {
    return fetchProgramStaff(program)
      .then((rows) => { setMembers(rows); setLoadError(false); })
      .catch(() => setLoadError(true));
  }
  useEffect(() => { load(); }, []);

  async function changeRole(profile, value) {
    setSavingId(profile.id);
    try {
      await setProgramRole(profile.id, program, value || null, session && session.id);
      await load();
      if (session && profile.id === session.id) await refetchProgramRoles();
      showToast(t("snapRoleSaved"));
    } catch (err) {
      console.warn("setProgramRole failed", err);
      showToast(t("snapRoleSaveError"));
    } finally {
      setSavingId(null);
    }
  }

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
  function roleSelect(p, className) {
    const membership = members ? members[p.id] : null;
    const current = membership && membership.active ? membership.role : "";
    return (
      <Select
        className={className}
        aria-label={t("snapRoleCol") + ": " + (p.name || p.email)}
        value={current}
        disabled={members === null || savingId !== null}
        onChange={(e) => changeRole(p, e.target.value)}
      >
        <option value="">{t("snapRoleNone")}</option>
        {PROGRAM_ROLES.map((r) => <option key={r} value={r}>{t(snapRoleLabelKey(r))}</option>)}
      </Select>
    );
  }

  const columns = [
    { key: "person", header: t("staffMember"), cell: person },
    { key: "role", header: t("roleColLabel"), cell: systemRole },
    { key: "programRole", header: t("snapRoleCol"), cell: (p) => roleSelect(p, "w-56"), className: "w-64" }
  ];

  let body;
  if (loadError) {
    body = <LoadError title={t("snapStaffLoadError")} onRetry={load} />;
  } else {
    body = (
      <DataTable
        caption={t("snapStaffTitle")}
        columns={columns}
        rows={staff}
        getRowId={(p) => p.id}
        renderCard={(p) => (
          <>
            <div className="flex items-start justify-between gap-3">
              {person(p)}
              <span className="shrink-0">{systemRole(p)}</span>
            </div>
            <div className="mt-3">{roleSelect(p)}</div>
          </>
        )}
        empty={<EmptyState icon={Users} title={t("snapNoActiveStaff")} />}
      />
    );
  }

  return (
    <>
      <PageHeader title={t("snapStaffTitle")} description={t("snapStaffDesc")} />
      <Alert tone="info" className="mb-6">{t("snapStaffHelp")}</Alert>
      <Card className="p-4 sm:p-5">{body}</Card>
    </>
  );
}
