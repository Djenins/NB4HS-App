// snapTasks.js -- SNAP follow-up tasks (the `tasks` table, stage2b
// migration) and the dashboard aggregate. Workers see tasks assigned to or
// created by them; supervisors and program admins see the program's. A new
// case gets an "Initial follow-up" task automatically (automation_key
// "case_opened:<id>"), and a daily pg_cron job sends in-app reminders for
// open tasks due today or tomorrow.
import { supabase } from "./supabase.js";

export var TASK_PRIORITIES = ["low", "normal", "high"];
export var TASK_TEXT_MAX = 1000;

function taskFromRow(row) {
  var c = row.clients || {};
  return {
    id: row.id, title: row.title, description: row.description || "", assignedTo: row.assigned_to || null,
    priority: row.priority, dueDate: row.due_date || "", status: row.status, completedAt: row.completed_at || null,
    completionNotes: row.completion_notes || "", clientId: row.client_id || null, caseId: row.case_id || null,
    clientName: ((c.first_name || "") + " " + (c.last_name || "")).trim(), source: row.source,
    automationKey: row.automation_key || null, createdBy: row.created_by || null, createdAt: row.created_at
  };
}

// ---------- pure helpers ----------

// Groups open tasks for the task list and dashboard. `today` is a
// YYYY-MM-DD string in NB4HS's local date (utils.todayStr()).
export function taskBuckets(tasks, today) {
  var soon = addDays(today, 7);
  var out = { overdue: [], dueSoon: [], later: [], noDate: [], done: [] };
  (tasks || []).forEach(function (task) {
    if (task.status === "done") { out.done.push(task); return; }
    if (task.status !== "open") return;
    if (!task.dueDate) out.noDate.push(task);
    else if (task.dueDate < today) out.overdue.push(task);
    else if (task.dueDate <= soon) out.dueSoon.push(task);
    else out.later.push(task);
  });
  ["overdue", "dueSoon", "later"].forEach(function (k) { out[k].sort(function (a, b) { return a.dueDate.localeCompare(b.dueDate); }); });
  return out;
}

export function addDays(ymd, n) {
  var d = new Date(ymd + "T12:00:00");
  d.setDate(d.getDate() + n);
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

// Automation-created tasks carry a stored English title; show them in the
// reader's language instead. Manual tasks show exactly what staff typed.
export function taskTitle(task, t) {
  if (task.automationKey && task.automationKey.indexOf("case_opened:") === 0) {
    return t("snapTaskInitialFollowUp") + (task.title.indexOf(": ") !== -1 ? ": " + task.title.split(": ").slice(1).join(": ") : "");
  }
  return task.title;
}

// Mirrors tasks RLS: leads edit any program task; workers only tasks assigned to them.
export function taskPermissions(task, programRole, userId) {
  var lead = programRole === "supervisor" || programRole === "program_admin";
  return { canEdit: lead || (programRole === "worker" && !!task && task.assignedTo === userId), canAssignOthers: lead };
}

// Share of tasks due in the period that were completed, as a whole percent,
// or null when nothing was due.
export function completionRate(dueInRange, doneInRange) {
  if (!dueInRange) return null;
  return Math.round((doneInRange / dueInRange) * 100);
}

// ---------- data ----------

export async function fetchTasks(filters) {
  let query = supabase.from("tasks").select("*, clients(first_name, last_name)").eq("program", "snap");
  if (filters && filters.caseId) query = query.eq("case_id", filters.caseId);
  if (filters && filters.assignedTo) query = query.eq("assigned_to", filters.assignedTo);
  const { data, error } = await query.order("due_date", { ascending: true, nullsFirst: false });
  if (error) throw error;
  return data.map(taskFromRow);
}

export async function createTask(fields, createdBy) {
  const { error } = await supabase.from("tasks").insert({
    program: "snap", title: fields.title.trim().slice(0, 200), description: (fields.description || "").trim().slice(0, TASK_TEXT_MAX) || null,
    assigned_to: fields.assignedTo || createdBy, priority: fields.priority || "normal", due_date: fields.dueDate || null,
    client_id: fields.clientId || null, case_id: fields.caseId || null, created_by: createdBy
  });
  if (error) throw error;
}

export async function updateTask(id, patch) {
  const row = {};
  if (patch.status !== undefined) row.status = patch.status;
  if (patch.completionNotes !== undefined) row.completion_notes = (patch.completionNotes || "").trim().slice(0, TASK_TEXT_MAX) || null;
  if (patch.dueDate !== undefined) row.due_date = patch.dueDate || null;
  if (patch.assignedTo !== undefined) row.assigned_to = patch.assignedTo || null;
  if (patch.priority !== undefined) row.priority = patch.priority;
  const { error, count } = await supabase.from("tasks").update(row, { count: "exact" }).eq("id", id);
  if (error) throw error;
  if (count === 0) throw new Error("not permitted");
}

export async function fetchSnapDashboard(from, to) {
  const { data, error } = await supabase.rpc("snap_dashboard", { p_from: from, p_to: to });
  if (error) throw error;
  return data;
}

export async function fetchRecentActivity(limit) {
  const { data, error } = await supabase.from("outreach_interactions")
    .select("id, type, outcome, occurred_at, staff_id, clients(first_name, last_name)")
    .eq("program", "snap").order("occurred_at", { ascending: false }).limit(limit || 8);
  if (error) throw error;
  return data.map((r) => ({
    id: r.id, type: r.type, outcome: r.outcome || "", occurredAt: r.occurred_at, staffId: r.staff_id,
    clientName: (((r.clients || {}).first_name || "") + " " + ((r.clients || {}).last_name || "")).trim()
  }));
}
