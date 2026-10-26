// SnapStaffSettings.jsx -- grant, change or revoke roles in the current
// outreach program. Shown to system administrators and that program's
// program admins (outreachSectionsFor() in lib/outreachPrograms.js); the
// program_staff RLS policies enforce the same rule
// server-side. Lists active staff profiles only -- an inactive account
// can't use a role anyway (has_program_role() requires an active profile).
// Every change lands in audit_events via the table's trigger.
import { useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { useApp, useT } from "../../context/AppContext.jsx";
import { useOutreachProgram } from "../../context/OutreachProgramContext.jsx";
import { PROGRAM_ROLES, fetchProgramStaff, setProgramRole } from "../../lib/programStaff.js";
import { roleLabel } from "../../lib/utils.js";
import { avatarColorFor } from "../StudentCard.jsx";
import EmptyState from "../EmptyState.jsx";
import { SectionCard } from "../SectionCard.jsx";
import { Avatar, AvatarFallback } from "../ui/avatar.jsx";
import { Badge } from "../ui/badge.jsx";
import { snapRoleLabelKey } from "./snapRoleLabel.js";

const TH = "bg-card px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted shadow-[0_1px_0_var(--border)]";
// py-0: main.css gives every select 12px top/bottom padding, which leaves no
// room for the text in a 36px box; pr-9 keeps it clear of the chevron.
const SELECT = "h-9 min-h-0 rounded-lg border border-border bg-background py-0 pl-2.5 pr-9 text-sm text-card-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15 disabled:opacity-50";

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

  return (
    <SectionCard title={t("snapStaffTitle")}>
      <div className="info-callout mb-4">
        <ShieldCheck className="icon h-5 w-5" aria-hidden="true" />
        <p>{t("snapStaffHelp")}</p>
      </div>

      {loadError ? (
        <EmptyState icon="users" message={t("snapStaffLoadError")} />
      ) : !staff.length ? (
        <EmptyState icon="users" message={t("snapNoActiveStaff")} />
      ) : (
        <div className="overflow-auto rounded-xl border border-border">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className={TH}>{t("staffMember")}</th>
                <th className={TH}>{t("roleColLabel")}</th>
                <th className={TH}>{t("snapRoleCol")}</th>
              </tr>
            </thead>
            <tbody>
              {staff.map((p) => {
                const membership = members ? members[p.id] : null;
                const current = membership && membership.active ? membership.role : "";
                return (
                  <tr key={p.id} className="border-t border-border transition-colors hover:bg-background">
                    <td className="px-4 py-3.5 align-middle">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9">
                          <AvatarFallback className={avatarColorFor(p.name || p.email)}>{initials(p.name, p.email)}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <div className="truncate font-semibold text-card-foreground">{p.name || "—"}</div>
                          <div className="truncate text-xs text-muted">{p.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 align-middle"><Badge variant="neutral">{roleLabel(p.role, lang)}</Badge></td>
                    <td className="px-4 py-3.5 align-middle">
                      <select
                        className={SELECT}
                        aria-label={t("snapRoleCol") + ": " + (p.name || p.email)}
                        value={current}
                        disabled={members === null || savingId !== null}
                        onChange={(e) => changeRole(p, e.target.value)}
                      >
                        <option value="">{t("snapRoleNone")}</option>
                        {PROGRAM_ROLES.map((r) => <option key={r} value={r}>{t(snapRoleLabelKey(r))}</option>)}
                      </select>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </SectionCard>
  );
}
