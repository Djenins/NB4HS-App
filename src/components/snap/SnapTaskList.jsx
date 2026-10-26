// SnapTaskList.jsx -- follow-up rows (mark done with optional notes, reopen)
// and the add-follow-up form, shared by the Follow-ups section, the case
// detail view and the dashboard. Edit rights come from taskPermissions(),
// which mirrors the tasks RLS policy.
import { useState } from "react";
import { CheckCircle2, RotateCcw } from "lucide-react";
import { useApp, useT } from "../../context/AppContext.jsx";
import { TASK_PRIORITIES, TASK_TEXT_MAX, createTask, taskPermissions, taskTitle, updateTask } from "../../lib/snapTasks.js";
import { fmtDateLong, todayStr } from "../../lib/utils.js";
import { Badge } from "../ui/badge.jsx";
import { Button } from "../ui/button.jsx";
import { SNAP_CONTROL, SnapInput, SnapSelect } from "./SnapField.jsx";

const PRIORITY_VARIANT = { low: "neutral", normal: "default", high: "accent" };

function TaskRow({ task, onChanged, showClient }) {
  const { data, lang, session, showToast } = useApp();
  const t = useT();
  const perms = taskPermissions(task, (data.programRoles || {}).snap || null, session ? session.id : null);
  const [completing, setCompleting] = useState(false);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const overdue = task.status === "open" && task.dueDate && task.dueDate < todayStr();
  const assignee = (data.profiles || []).find((p) => p.id === task.assignedTo);

  async function save(patch) {
    setBusy(true);
    try {
      await updateTask(task.id, patch);
      showToast(t("snapTaskSaved"));
      setCompleting(false);
      onChanged();
    } catch (err) {
      console.warn("updateTask failed", err);
      showToast(t("snapTaskSaveError"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="rounded-lg border border-border p-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className={"font-semibold " + (task.status === "done" ? "text-muted line-through" : "text-card-foreground")}>{taskTitle(task, t)}</span>
        {task.priority !== "normal" && <Badge variant={PRIORITY_VARIANT[task.priority]}>{t("snapPriority_" + task.priority)}</Badge>}
        {task.source === "automation" && <Badge variant="neutral">{t("snapTaskAutomatic")}</Badge>}
        <span className={"ml-auto text-xs " + (overdue ? "font-semibold text-accent" : "text-muted")}>
          {task.dueDate ? t("snapTaskDue") + ": " + fmtDateLong(task.dueDate, lang) : t("snapBucket_noDate")}
        </span>
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
        {showClient && task.clientName && <span>{task.clientName}</span>}
        {assignee && <span>{t("snapAssignedTo")}: {assignee.name || assignee.email}</span>}
        {task.description && <span className="basis-full text-card-foreground">{task.description}</span>}
        {task.completionNotes && <span className="basis-full">{task.completionNotes}</span>}
      </div>
      {perms.canEdit && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {task.status === "open" && !completing && (
            <Button size="sm" variant="secondary" className="gap-1.5" onClick={() => setCompleting(true)}>
              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" /> {t("snapTaskDone")}
            </Button>
          )}
          {task.status === "done" && (
            <Button size="sm" variant="ghost" className="gap-1.5" disabled={busy} onClick={() => save({ status: "open" })}>
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" /> {t("snapTaskReopen")}
            </Button>
          )}
          {completing && (
            <div className="flex w-full flex-wrap items-end gap-2">
              <div className="grid min-w-[200px] flex-1 gap-1">
                <label htmlFor={"task-notes-" + task.id} className="text-xs font-semibold text-muted">{t("snapTaskCompletionNotes")}</label>
                <input id={"task-notes-" + task.id} className={SNAP_CONTROL} maxLength={TASK_TEXT_MAX} value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>
              <Button size="sm" disabled={busy} onClick={() => save({ status: "done", completionNotes: notes })}>{t("snapTaskDone")}</Button>
              <Button size="sm" variant="ghost" onClick={() => setCompleting(false)}>{t("cancelLabel")}</Button>
            </div>
          )}
        </div>
      )}
    </li>
  );
}

export function SnapTaskRows({ tasks, onChanged, showClient, emptyMessage }) {
  const t = useT();
  if (!tasks.length) return <p className="!mb-0 py-3 text-center !text-sm text-muted">{emptyMessage || t("snapNoTasks")}</p>;
  return (
    <ol className="m-0 list-none space-y-2 p-0">
      {tasks.map((task) => <TaskRow key={task.id} task={task} onChanged={onChanged} showClient={showClient} />)}
    </ol>
  );
}

// Inline add form. `context` pins the task to a case/client when given.
export function SnapTaskForm({ context, onSaved, onCancel }) {
  const { data, session, showToast } = useApp();
  const t = useT();
  const userId = session ? session.id : null;
  const lead = ["supervisor", "program_admin"].indexOf((data.programRoles || {}).snap) !== -1;
  const [fields, setFields] = useState({ title: "", dueDate: "", priority: "normal", assignedTo: userId });
  const [busy, setBusy] = useState(false);
  const set = (k) => (v) => setFields((f) => Object.assign({}, f, { [k]: v }));

  async function submit(e) {
    e.preventDefault();
    if (!fields.title.trim()) return;
    setBusy(true);
    try {
      await createTask(Object.assign({}, fields, context || {}), userId);
      showToast(t("snapTaskSaved"));
      onSaved();
    } catch (err) {
      console.warn("createTask failed", err);
      showToast(t("snapTaskSaveError"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mb-3 grid gap-3 rounded-xl border border-border p-3 sm:grid-cols-4">
      <div className="sm:col-span-4"><SnapInput id="task-title" label={t("snapTaskTitle")} value={fields.title} onChange={set("title")} required /></div>
      <SnapInput id="task-due" type="date" label={t("snapTaskDue")} value={fields.dueDate} onChange={set("dueDate")} />
      <SnapSelect id="task-priority" t={t} label={t("snapTaskPriority")} value={fields.priority} options={TASK_PRIORITIES} labelPrefix="snapPriority_" onChange={set("priority")} />
      {lead ? (
        <div className="grid gap-1.5 sm:col-span-2">
          <label htmlFor="task-assignee" className="text-xs font-semibold text-muted">{t("snapAssignedTo")}</label>
          <select id="task-assignee" className={SNAP_CONTROL} value={fields.assignedTo || ""} onChange={(e) => set("assignedTo")(e.target.value)}>
            {(data.profiles || []).filter((p) => p.active !== false).map((p) => <option key={p.id} value={p.id}>{p.name || p.email}</option>)}
          </select>
        </div>
      ) : <div className="sm:col-span-2" />}
      <div className="flex justify-end gap-2 sm:col-span-4">
        {onCancel && <Button type="button" variant="ghost" size="sm" onClick={onCancel}>{t("cancelLabel")}</Button>}
        <Button type="submit" size="sm" disabled={busy || !fields.title.trim()}>{t("snapAddTask")}</Button>
      </div>
    </form>
  );
}
