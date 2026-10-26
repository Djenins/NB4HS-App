// SnapTaskList.jsx -- follow-up rows (mark done with optional notes, reopen)
// and the add-follow-up form, shared by the Follow-ups section, the case
// detail view and the dashboard. Edit rights come from taskPermissions(),
// which mirrors the tasks RLS policy.
//
// Rows are a divided list, not cards, so they sit inside a SectionCard or a
// drawer without nesting surfaces. A row's state reads from StatusBadge's
// `task` domain: overdue (open, due before today), dueToday (open, due
// today) and done. An open task due later carries no badge -- its due date
// says enough.
import { useState } from "react";
import { CheckCircle2, RotateCcw } from "lucide-react";
import { useApp, useT } from "../../context/AppContext.jsx";
import { useOutreachProgram } from "../../context/OutreachProgramContext.jsx";
import { TASK_PRIORITIES, TASK_TEXT_MAX, createTask, taskPermissions, taskTitle, updateTask } from "../../lib/snapTasks.js";
import { cn } from "../../lib/cn.js";
import { fmtDateLong, todayStr } from "../../lib/utils.js";
import { Badge } from "../ui/badge.jsx";
import { Button } from "../ui/button.jsx";
import { EmptyState } from "../ui/empty-state.jsx";
import { Field, Input, Select } from "../ui/field.jsx";
import { IconButton } from "../ui/icon-button.jsx";
import { StatusBadge } from "../ui/status-badge.jsx";

// The row's status for the `task` statusTone domain, or null for an open
// task that isn't due yet.
function rowStatus(task, today) {
  if (task.status === "done") return "done";
  if (task.status !== "open" || !task.dueDate) return null;
  if (task.dueDate < today) return "overdue";
  if (task.dueDate === today) return "dueToday";
  return null;
}

const STATUS_LABEL = { done: "done", overdue: "snapBucket_overdue", dueToday: "snapTaskDueToday" };

function TaskRow({ task, onChanged, showClient }) {
  const { data, lang, session, showToast } = useApp();
  const t = useT();
  const { programRole } = useOutreachProgram();
  const perms = taskPermissions(task, programRole, session ? session.id : null);
  const [completing, setCompleting] = useState(false);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const status = rowStatus(task, todayStr());
  const assignee = (data.profiles || []).find((p) => p.id === task.assignedTo);
  const title = taskTitle(task, t);

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
    <li className="py-3 first:pt-0 last:pb-0">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className={cn("text-ui font-semibold leading-snug", task.status === "done" ? "text-muted line-through" : "text-card-foreground")}>{title}</span>
            {status && <StatusBadge domain="task" status={status}>{t(STATUS_LABEL[status])}</StatusBadge>}
            {task.priority !== "normal" && <StatusBadge domain="taskPriority" status={task.priority}>{t("snapPriority_" + task.priority)}</StatusBadge>}
            {task.source === "automation" && <Badge variant="neutral">{t("snapTaskAutomatic")}</Badge>}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-meta text-muted">
            <span className={cn("tabular-nums", status === "overdue" && "font-semibold text-tone-danger-ink")}>
              {task.dueDate ? t("snapTaskDue") + ": " + fmtDateLong(task.dueDate, lang) : t("snapBucket_noDate")}
            </span>
            {showClient && task.clientName && <span>{task.clientName}</span>}
            {assignee && <span>{t("snapAssignedTo")}: {assignee.name || assignee.email}</span>}
          </div>
          {task.description && <p className="m-0 mt-1 text-ui text-card-foreground">{task.description}</p>}
          {task.completionNotes && <p className="m-0 mt-1 text-meta text-muted">{task.completionNotes}</p>}
        </div>
        {perms.canEdit && task.status === "open" && !completing && (
          <IconButton variant="secondary" size="sm" label={t("snapTaskDone") + ": " + title} onClick={() => setCompleting(true)}>
            <CheckCircle2 aria-hidden="true" />
          </IconButton>
        )}
        {perms.canEdit && task.status === "done" && (
          <IconButton size="sm" label={t("snapTaskReopen") + ": " + title} disabled={busy} onClick={() => save({ status: "open" })}>
            <RotateCcw aria-hidden="true" />
          </IconButton>
        )}
      </div>
      {perms.canEdit && completing && (
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <Field className="min-w-[200px] flex-1" label={t("snapTaskCompletionNotes")} htmlFor={"task-notes-" + task.id}>
            <Input id={"task-notes-" + task.id} maxLength={TASK_TEXT_MAX} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
          <Button size="sm" loading={busy} onClick={() => save({ status: "done", completionNotes: notes })}>
            {!busy && <CheckCircle2 className="h-4 w-4" aria-hidden="true" />}{t("snapTaskDone")}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setCompleting(false)}>{t("cancelLabel")}</Button>
        </div>
      )}
    </li>
  );
}

export function SnapTaskRows({ tasks, onChanged, showClient, emptyMessage }) {
  const t = useT();
  if (!tasks.length) return <EmptyState compact title={emptyMessage || t("snapNoTasks")} description={t("snapNoTasksHint")} />;
  return (
    <ol className="m-0 list-none divide-y divide-border p-0">
      {tasks.map((task) => <TaskRow key={task.id} task={task} onChanged={onChanged} showClient={showClient} />)}
    </ol>
  );
}

// Inline add form. `context` pins the task to a case/client when given.
export function SnapTaskForm({ context, onSaved, onCancel }) {
  const { data, session, showToast } = useApp();
  const t = useT();
  const { program, programRole } = useOutreachProgram();
  const userId = session ? session.id : null;
  const lead = programRole === "supervisor" || programRole === "program_admin";
  const [fields, setFields] = useState({ title: "", dueDate: "", priority: "normal", assignedTo: userId });
  const [busy, setBusy] = useState(false);
  const set = (k) => (v) => setFields((f) => Object.assign({}, f, { [k]: v }));

  async function submit(e) {
    e.preventDefault();
    if (!fields.title.trim()) return;
    setBusy(true);
    try {
      await createTask(Object.assign({ program }, fields, context || {}), userId);
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
    <form onSubmit={submit} className="mb-4 grid gap-3 rounded-control border border-border bg-surface-sunken p-4 sm:grid-cols-4">
      <Field className="sm:col-span-4" label={t("snapTaskTitle")} htmlFor="task-title" required>
        <Input id="task-title" autoComplete="off" value={fields.title} onChange={(e) => set("title")(e.target.value)} />
      </Field>
      <Field label={t("snapTaskDue")} htmlFor="task-due">
        <Input id="task-due" type="date" value={fields.dueDate} onChange={(e) => set("dueDate")(e.target.value)} />
      </Field>
      <Field label={t("snapTaskPriority")} htmlFor="task-priority">
        <Select id="task-priority" value={fields.priority} onChange={(e) => set("priority")(e.target.value)}>
          {TASK_PRIORITIES.map((p) => <option key={p} value={p}>{t("snapPriority_" + p)}</option>)}
        </Select>
      </Field>
      {lead ? (
        <Field className="sm:col-span-2" label={t("snapAssignedTo")} htmlFor="task-assignee">
          <Select id="task-assignee" value={fields.assignedTo || ""} onChange={(e) => set("assignedTo")(e.target.value)}>
            {(data.profiles || []).filter((p) => p.active !== false).map((p) => <option key={p.id} value={p.id}>{p.name || p.email}</option>)}
          </Select>
        </Field>
      ) : <div className="hidden sm:col-span-2 sm:block" />}
      <div className="flex justify-end gap-2 sm:col-span-4">
        {onCancel && <Button type="button" variant="ghost" size="sm" onClick={onCancel}>{t("cancelLabel")}</Button>}
        <Button type="submit" size="sm" loading={busy} disabled={!fields.title.trim()}>{t("snapAddTask")}</Button>
      </div>
    </form>
  );
}
