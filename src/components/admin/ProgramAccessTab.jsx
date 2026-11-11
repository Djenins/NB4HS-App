// ProgramAccessTab.jsx -- the Program Access tab of a staff account: which
// programs this person can open. It's the first gate of the access model --
// a role's permissions only count inside programs the person can open
// (plans/unified-access-architecture.md §4, rule 4).
//
// Automatic access follows the account type, Workforce access and program
// staff settings and can't be removed here; an admin can give more, and take
// back what an admin gave (admin_grant_program / admin_revoke_program).
//
// Opening a program grants nothing by itself: without a role or a grant in
// it, the person still sees no page. Such a program is marked "no
// permissions yet" with a way to the Detailed Permissions tab.
import { useCallback, useEffect, useState } from "react";
import { useApp, useT } from "../../context/AppContext.jsx";
import { adminErrorKey, fetchProgramAccess, grantProgram, revokeProgram } from "../../lib/adminAccounts.js";
import { fetchUserAccess, programsWithPermissions } from "../../lib/permissionAdmin.js";
import { Alert } from "../ui/alert.jsx";
import { Badge } from "../ui/badge.jsx";
import { Button } from "../ui/button.jsx";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card.jsx";
import { Skeleton } from "../ui/skeleton.jsx";
import { ReasonDialog, fmtWhen } from "./adminShared.jsx";

export default function ProgramAccessTab({ account, isSelf, catalog, onOpenPermissions }) {
  const { can, lang, data, showToast } = useApp();
  const t = useT();
  const [access, setAccess] = useState(null);
  const [held, setHeld] = useState(null); // { programKey: true } -- programs with any permission
  const [pending, setPending] = useState(null); // { program, action: "grant" | "revoke" }

  const load = useCallback(() => Promise.all([
    fetchProgramAccess(account.id).then(setAccess).catch((e) => { setAccess({}); showToast(t(adminErrorKey(e))); }),
    // If this fails, rows just show "Can open" as before.
    fetchUserAccess(account.id).then((a) => setHeld(programsWithPermissions(a.effective))).catch(() => setHeld(null)),
  ]), [account.id, showToast, t]);
  useEffect(() => { load(); }, [load]);

  const editable = can("admin.permissions.assign") && !isSelf;
  const programs = catalog ? catalog.modules.filter((m) => m.kind === "program" && m.active && m.implemented) : null;
  const nameOf = (id) => {
    const p = (data.profiles || []).find((x) => x.id === id);
    return p ? p.name || p.email : "";
  };

  return (
    <>
      <Alert tone="info" title={t("adminProgramsGateTitle")} className="mb-4">{t("adminProgramsGateBody")}</Alert>
      <Card>
        <CardHeader>
          <CardTitle>{t("adminTabPrograms")}</CardTitle>
          <CardDescription>{t("adminProgramsTabDesc")}</CardDescription>
        </CardHeader>
        <CardContent>
          {!programs || !access ? (
            <div className="space-y-2" aria-busy="true">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
          ) : (
            <ul className="m-0 list-none divide-y divide-line-subtle rounded-control border border-border p-0">
              {programs.map((m) => {
                const row = access[m.key];
                const empty = !!row && !!held && !held[m.key];
                return (
                  <li key={m.key} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-ui font-semibold text-card-foreground">{m.name}</span>
                        {!row ? <Badge variant="neutral">{t("adminNoAccess")}</Badge>
                          : empty ? <Badge variant="warning" dot>{t("adminNoPermissionsYet")}</Badge>
                            : <Badge variant="success" dot>{t("adminCanOpen")}</Badge>}
                      </div>
                      {row ? (
                        <div className="mt-0.5 text-meta text-muted">
                          {row.source === "legacy_sync"
                            ? t("adminProgramAutomatic")
                            : t("adminProgramGiven").replace("{date}", fmtWhen(row.grantedAt, lang)).replace("{name}", nameOf(row.grantedBy) || "—")}
                        </div>
                      ) : null}
                      {empty ? (
                        <div className="mt-1 max-w-prose text-meta text-tone-warning-ink">
                          {t("adminNoPermissionsHint").replace(/\{program\}/g, m.name)}
                        </div>
                      ) : null}
                    </div>
                    {empty && onOpenPermissions ? (
                      <Button size="sm" variant="secondary" onClick={onOpenPermissions}>{t("adminGrantPermissionsBtn")}</Button>
                    ) : null}
                    {editable && !row ? (
                      <Button size="sm" variant="secondary" onClick={() => setPending({ program: m, action: "grant" })}>{t("adminGiveAccess")}</Button>
                    ) : null}
                    {editable && row && row.source === "admin" ? (
                      <Button size="sm" variant="ghost" onClick={() => setPending({ program: m, action: "revoke" })}>{t("adminRemove")}</Button>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <ReasonDialog
        open={!!pending}
        onClose={() => setPending(null)}
        required={false}
        danger={pending && pending.action === "revoke"}
        title={pending ? t(pending.action === "grant" ? "adminGiveAccessTitle" : "adminRemoveAccessTitle")
          .replace("{program}", pending.program.name).replace("{name}", account.name || account.email) : ""}
        description={pending ? t(pending.action === "grant" ? "adminGiveAccessDesc" : "adminRemoveAccessDesc") : ""}
        confirmLabel={pending && pending.action === "grant" ? t("adminGiveAccess") : t("adminRemove")}
        onConfirm={async (reason) => {
          try {
            if (pending.action === "grant") await grantProgram(account.id, pending.program.key, reason);
            else await revokeProgram(account.id, pending.program.key, reason);
            showToast(t(pending.action === "grant" ? "adminAccessGiven" : "adminAccessRemoved"));
            load();
            return true;
          } catch (e) { showToast(t(adminErrorKey(e))); return false; }
        }}
      />
    </>
  );
}
