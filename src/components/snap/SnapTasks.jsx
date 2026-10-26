// SnapTasks.jsx -- an outreach program's "Follow-ups" section: open follow-ups
// grouped into overdue / next 7 days / later / no date, plus done. Workers
// see their own (RLS); supervisors and program admins can switch to the
// whole team. `intent` ("new") comes from the dashboard's quick actions.
import { useEffect, useState } from "react";
import { ListPlus } from "lucide-react";
import { useApp, useT } from "../../context/AppContext.jsx";
import { useOutreachProgram } from "../../context/OutreachProgramContext.jsx";
import { fetchTasks, taskBuckets } from "../../lib/snapTasks.js";
import { todayStr } from "../../lib/utils.js";
import EmptyState from "../EmptyState.jsx";
import { SectionCard } from "../SectionCard.jsx";
import { Button } from "../ui/button.jsx";
import { SnapTaskForm, SnapTaskRows } from "./SnapTaskList.jsx";

const BUCKETS = ["overdue", "dueSoon", "later", "noDate", "done"];

export default function SnapTasks({ intent }) {
  const { session } = useApp();
  const t = useT();
  const { program, programRole } = useOutreachProgram();
  const userId = session ? session.id : null;
  const lead = programRole === "supervisor" || programRole === "program_admin";
  const [scope, setScope] = useState("mine");
  const [tasks, setTasks] = useState(null);
  const [loadError, setLoadError] = useState(false);
  const [adding, setAdding] = useState(intent === "new");

  function load() {
    return fetchTasks(scope === "mine" ? { program, assignedTo: userId } : { program })
      .then((rows) => { setTasks(rows); setLoadError(false); })
      .catch((err) => { console.warn("fetchTasks failed", err); setLoadError(true); });
  }
  useEffect(() => { load(); }, [scope]);

  const buckets = taskBuckets(tasks || [], todayStr());

  return (
    <SectionCard
      title={t("snapSectionTasks")}
      action={
        <div className="flex flex-wrap items-center gap-2">
          {lead && (
            <div role="group" aria-label={t("snapSectionTasks")} className="flex rounded-lg border border-border p-0.5">
              {["mine", "team"].map((s) => (
                <button key={s} type="button" aria-pressed={scope === s} onClick={() => setScope(s)}
                  className={"min-h-0 rounded-md border-0 px-3 py-1.5 text-sm font-semibold transform-none " + (scope === s ? "bg-primary-tint text-primary" : "bg-transparent text-muted")}>
                  {t(s === "mine" ? "snapMyTasks" : "snapAllTeam")}
                </button>
              ))}
            </div>
          )}
          {!adding && <Button className="gap-1.5" onClick={() => setAdding(true)}><ListPlus className="h-4 w-4" aria-hidden="true" /> {t("snapAddTask")}</Button>}
        </div>
      }
    >
      {adding && <SnapTaskForm onCancel={() => setAdding(false)} onSaved={() => { setAdding(false); load(); }} />}
      {loadError ? <EmptyState icon="inbox" message={t("snapTasksLoadError")} />
        : tasks === null ? null
        : !tasks.length ? <EmptyState icon="inbox" message={t("snapNoTasks")} />
        : (
          <div className="grid gap-5">
            {BUCKETS.filter((b) => buckets[b].length).map((b) => (
              <section key={b} aria-labelledby={"bucket-" + b}>
                <h3 id={"bucket-" + b} className={"m-0 mb-2 text-sm font-bold " + (b === "overdue" ? "text-accent" : "text-card-foreground")}>
                  {t("snapBucket_" + b)} <span className="font-normal text-muted">({buckets[b].length})</span>
                </h3>
                <SnapTaskRows tasks={buckets[b]} onChanged={load} showClient />
              </section>
            ))}
          </div>
        )}
    </SectionCard>
  );
}
