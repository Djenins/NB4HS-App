// SnapTasks.jsx -- an outreach program's "Follow-ups" section: open follow-ups
// grouped into overdue / next 7 days / later / no date, plus done. Workers
// see their own (RLS); supervisors and program admins can switch to the
// whole team. `intent` ("new") comes from the dashboard's quick actions.
//
// PageHeader (with the Mine / Whole team switch for leads), then one card:
// the add form when open, and a titled group per bucket. Rows come from
// SnapTaskList.jsx, shared with the dashboard and the case detail.
import { useEffect, useState } from "react";
import { ListPlus } from "lucide-react";
import { useApp, useT } from "../../context/AppContext.jsx";
import { useOutreachProgram } from "../../context/OutreachProgramContext.jsx";
import { fetchTasks, taskBuckets } from "../../lib/snapTasks.js";
import { cn } from "../../lib/cn.js";
import { todayStr } from "../../lib/utils.js";
import { Button } from "../ui/button.jsx";
import { Card } from "../ui/card.jsx";
import { EmptyState } from "../ui/empty-state.jsx";
import { PageHeader } from "../ui/page-header.jsx";
import { SegmentedControl } from "../ui/segmented-control.jsx";
import { Skeleton } from "../ui/skeleton.jsx";
import { LoadError } from "./SnapListParts.jsx";
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

  let body;
  if (loadError) {
    body = <LoadError title={t("snapTasksLoadError")} onRetry={load} />;
  } else if (tasks === null) {
    body = (
      <div className="grid gap-3" aria-busy="true">
        <Skeleton className="h-5 w-40" />
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
      </div>
    );
  } else if (!tasks.length) {
    body = <EmptyState title={t("snapNoTasks")} description={t("snapNoTasksHint")} />;
  } else {
    body = (
      <div className="grid gap-6">
        {BUCKETS.filter((b) => buckets[b].length).map((b) => (
          <section key={b} aria-labelledby={"bucket-" + b}>
            <h2 id={"bucket-" + b} className={cn("m-0 mb-3 flex items-baseline gap-2 border-b border-line-subtle pb-2 text-section font-semibold", b === "overdue" ? "text-tone-danger-ink" : "text-card-foreground")}>
              {t("snapBucket_" + b)}
              <span className="text-meta font-medium tabular-nums text-muted">{buckets[b].length}</span>
            </h2>
            <SnapTaskRows tasks={buckets[b]} onChanged={load} showClient />
          </section>
        ))}
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title={t("snapSectionTasks")}
        description={t(lead ? "snapTasksDescLead" : "snapTasksDesc")}
        actions={
          <>
            {lead && (
              <SegmentedControl
                label={t("snapTasksScopeLabel")}
                value={scope}
                onChange={setScope}
                options={[{ value: "mine", label: t("snapMyTasks") }, { value: "team", label: t("snapAllTeam") }]}
              />
            )}
            {!adding && <Button onClick={() => setAdding(true)}><ListPlus className="h-4 w-4" aria-hidden="true" /> {t("snapAddTask")}</Button>}
          </>
        }
      />
      <Card className="p-4 sm:p-6">
        {adding && <SnapTaskForm onCancel={() => setAdding(false)} onSaved={() => { setAdding(false); load(); }} />}
        {body}
      </Card>
    </>
  );
}
