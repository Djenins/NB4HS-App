// AdminPrograms.jsx -- Programs & Modules (/admin/programs; plans/unified-
// access-architecture.md §6): the module tree with each module's on/off
// switch, which have no screens yet, and how many people can open each
// program. Switching a module off takes its permissions from everyone until
// it's back on, so it needs a reason and a confirmation
// (admin_set_module_active). Administration itself can't be switched off.
import { useCallback, useEffect, useState } from "react";
import { Power, PowerOff } from "lucide-react";
import { useApp, useT } from "../../context/AppContext.jsx";
import { adminErrorKey, fetchAccessCatalog } from "../../lib/adminAccounts.js";
import { fetchProgramMemberCounts, setModuleActive } from "../../lib/permissionAdmin.js";
import { Alert } from "../ui/alert.jsx";
import { Badge } from "../ui/badge.jsx";
import { Button } from "../ui/button.jsx";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card.jsx";
import { PageHeader } from "../ui/page-header.jsx";
import { Skeleton } from "../ui/skeleton.jsx";
import { ReasonDialog, countLabel } from "./adminShared.jsx";

const KIND_LABEL = { program: "adminKindProgram", shared: "adminKindShared", admin: "adminKindAdmin" };

function ModuleRow({ m, parentOff, editable, onToggle }) {
  const t = useT();
  const locked = m.kind === "admin" || m.key.indexOf("admin.") === 0;
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-ui font-medium text-card-foreground">{m.name}</span>
          {!m.implemented ? <Badge variant="neutral">{t("adminNoScreensYet")}</Badge>
            : m.active && !parentOff ? <Badge variant="success" dot>{t("adminModuleOn")}</Badge>
              : <Badge variant="danger" dot>{t(parentOff && m.active ? "adminModuleOffByParent" : "adminModuleOff")}</Badge>}
        </div>
        {m.description ? <p className="m-0 mt-0.5 text-meta text-muted">{m.description}</p> : null}
      </div>
      {editable && !locked && m.implemented ? (
        <Button size="sm" variant={m.active ? "ghost" : "secondary"} onClick={() => onToggle(m)}>
          {m.active ? <PowerOff className="h-4 w-4" aria-hidden="true" /> : <Power className="h-4 w-4" aria-hidden="true" />}
          {t(m.active ? "adminTurnOff" : "adminTurnOn")}
        </Button>
      ) : null}
    </li>
  );
}

export default function AdminPrograms() {
  const { can, showToast } = useApp();
  const t = useT();
  const [catalog, setCatalog] = useState(null);
  const [counts, setCounts] = useState({});
  const [failed, setFailed] = useState(false);
  const [pending, setPending] = useState(null);

  const load = useCallback(() => {
    setFailed(false);
    return fetchAccessCatalog().then(setCatalog).catch(() => setFailed(true));
  }, []);
  const canSeePeople = can("admin.users.view");
  useEffect(() => {
    load();
    if (canSeePeople) fetchProgramMemberCounts().then(setCounts).catch(() => setCounts({}));
  }, [load, canSeePeople]);

  const editable = can("admin.programs.manage");
  const header = <PageHeader title={t("adminProgramsTitle")} description={t("adminProgramsDesc")} />;
  if (failed) return <>{header}<Alert tone="danger" title={t("adminLoadFailed")} action={<Button size="sm" variant="secondary" onClick={load}>{t("retryLabel")}</Button>} /></>;
  if (!catalog) return <>{header}<div className="space-y-3" aria-busy="true">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-32 w-full" />)}</div></>;

  const roots = catalog.modules.filter((m) => !m.parentKey);
  const childrenOf = (key) => catalog.modules.filter((m) => m.parentKey === key);

  return (
    <>
      {header}
      <Alert tone="info" className="mb-4" title={t("adminProgramsNoteTitle")}>{t("adminProgramsNoteBody")}</Alert>
      <div className="grid gap-4">
        {roots.map((root) => {
          const kids = childrenOf(root.key);
          return (
            <Card key={root.key}>
              <CardHeader>
                <CardTitle className="flex flex-wrap items-center gap-2">
                  {root.name}
                  <Badge variant="neutral">{t(KIND_LABEL[root.kind] || "adminKindShared")}</Badge>
                </CardTitle>
                {root.kind === "program" && counts[root.key] != null ? (
                  <CardDescription>{countLabel(t, counts[root.key], "adminProgramOnePerson", "adminProgramPeople")}</CardDescription>
                ) : null}
              </CardHeader>
              <CardContent>
                <ul className="m-0 list-none divide-y divide-line-subtle rounded-control border border-border p-0">
                  <ModuleRow m={root} editable={editable} onToggle={(m) => setPending(m)} />
                  {kids.map((k) => <ModuleRow key={k.key} m={k} parentOff={!root.active} editable={editable} onToggle={(m) => setPending(m)} />)}
                </ul>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <ReasonDialog
        open={!!pending}
        onClose={() => setPending(null)}
        danger={pending && pending.active}
        title={pending ? t(pending.active ? "adminTurnOffTitle" : "adminTurnOnTitle").replace("{name}", pending.name) : ""}
        description={pending ? t(pending.active ? "adminTurnOffDesc" : "adminTurnOnDesc") : ""}
        confirmLabel={pending ? t(pending.active ? "adminTurnOff" : "adminTurnOn") : ""}
        onConfirm={async (reason) => {
          try {
            await setModuleActive(pending.key, !pending.active, reason);
            showToast(t(pending.active ? "adminModuleTurnedOff" : "adminModuleTurnedOn"));
            load();
            return true;
          } catch (e) { showToast(t(adminErrorKey(e))); return false; }
        }}
      />
    </>
  );
}
