// assistanceCases.js -- outreach assistance cases, their configurable
// stages, stage history and case notes (stage2b_cases_tasks_dashboard and
// outreach_o1_programs_and_options migrations). Assistance types and closure
// reasons are per-program option lists (outreachPrograms.js).
// The database enforces the rules (closure reason, supervisor review,
// milestone dates, assigned-only access for workers); the pure helpers here
// mirror them so the UI only offers what will succeed.
//
// NB4HS assists with applications; it never records an eligibility decision. Stages
// and milestones describe NB4HS's own work.
import { supabase } from "./supabase.js";

export var NOTE_MAX = 4000;

function caseFromRow(row) {
  var c = row.clients || {};
  return {
    id: row.id, caseNumber: row.case_number, clientId: row.client_id, outreachContactId: row.outreach_contact_id,
    nbId: c.nb_id || "", firstName: c.first_name || "", lastName: c.last_name || "",
    assignedTo: row.assigned_to || null, openedAt: row.opened_at, stageKey: row.stage_key,
    assistanceRequested: row.assistance_requested || [], assistanceProvided: row.assistance_provided || [],
    applicationAssistedAt: row.application_assisted_at || "", referredToDhsAt: row.referred_to_dhs_at || "",
    followUpDate: row.follow_up_date || "", closureReason: row.closure_reason || "", closedAt: row.closed_at || null,
    reviewStatus: row.supervisor_review_status, reviewedBy: row.reviewed_by || null, reviewedAt: row.reviewed_at || null,
    createdAt: row.created_at
  };
}
function casePatchToRow(patch) {
  var row = {};
  if (patch.stageKey !== undefined) row.stage_key = patch.stageKey;
  if (patch.assignedTo !== undefined) row.assigned_to = patch.assignedTo || null;
  if (patch.assistanceRequested !== undefined) row.assistance_requested = patch.assistanceRequested;
  if (patch.assistanceProvided !== undefined) row.assistance_provided = patch.assistanceProvided;
  if (patch.followUpDate !== undefined) row.follow_up_date = patch.followUpDate || null;
  if (patch.closureReason !== undefined) row.closure_reason = patch.closureReason || null;
  if (patch.reviewStatus !== undefined) row.supervisor_review_status = patch.reviewStatus;
  return row;
}
function stageFromRow(row) {
  return { key: row.key, labels: { en: row.label_en, ht: row.label_ht, fr: row.label_fr }, sortOrder: row.sort_order,
    isTerminal: row.is_terminal, requiresReview: row.requires_review, milestone: row.milestone || null, active: row.active };
}

// ---------- pure helpers ----------

export function stageLabel(stages, key, lang) {
  var s = (stages || []).find(function (x) { return x.key === key; });
  return s ? (s.labels[lang] || s.labels.en) : key;
}

// The stage configured to record a milestone ("application_assisted",
// "referred_external"), or null when the program has none -- its label
// names the milestone (SNAP: "Referred to Rhode Island DHS").
export function milestoneStage(stages, milestone) {
  return (stages || []).find(function (s) { return s.milestone === milestone; }) || null;
}

// Mirrors assistance_cases RLS: leads edit and reassign any case and decide
// reviews; the assigned worker edits their own case and may only request one.
export function casePermissions(c, programRole, userId) {
  var lead = programRole === "supervisor" || programRole === "program_admin";
  return {
    canEdit: lead || (programRole === "worker" && !!c && c.assignedTo === userId),
    canReassign: lead,
    canReview: lead
  };
}

// What moving to `stageKey` still needs, per assistance_case_rules():
// returns null when the move will be accepted, else an i18n key.
export function closureProblem(stages, stageKey, closureReason, reviewStatus) {
  var s = (stages || []).find(function (x) { return x.key === stageKey; });
  if (!s || !s.isTerminal) return null;
  if (!closureReason) return "snapCaseNeedsClosureReason";
  if (s.requiresReview && reviewStatus !== "approved") return "snapCaseNeedsReview";
  return null;
}

// "Cases needing attention" on the dashboard: open cases whose follow-up
// date has passed, that are waiting on a follow-up, or that await review.
export function casesNeedingAttention(cases, today) {
  return (cases || []).filter(function (c) {
    if (c.closedAt) return false;
    return (c.followUpDate && c.followUpDate < today) || c.stageKey === "follow_up_required" || c.reviewStatus === "requested";
  });
}

export function filterCases(cases, opts) {
  var q = String((opts && opts.q) || "").trim().toLowerCase();
  return (cases || []).filter(function (c) {
    if (opts && opts.openOnly && c.closedAt) return false;
    if (opts && opts.mineOnly && c.assignedTo !== opts.userId) return false;
    if (opts && opts.stageKey && c.stageKey !== opts.stageKey) return false;
    if (!q) return true;
    return (c.firstName + " " + c.lastName).toLowerCase().indexOf(q) !== -1 ||
      c.caseNumber.toLowerCase().indexOf(q) !== -1 || (c.nbId || "").toLowerCase().indexOf(q) !== -1;
  });
}

// ---------- data ----------

export async function fetchCaseStages(program) {
  const { data, error } = await supabase.from("program_case_stages").select("*").eq("program", program).order("sort_order");
  if (error) throw error;
  return data.map(stageFromRow);
}

export async function fetchCases(program) {
  const { data, error } = await supabase.from("assistance_cases")
    .select("*, clients(nb_id, first_name, last_name)").eq("program", program).order("opened_at", { ascending: false });
  if (error) throw error;
  return data.map(caseFromRow);
}

export async function createCase(program, contact, fields, createdBy) {
  const { data, error } = await supabase.from("assistance_cases").insert({
    program, client_id: contact.clientId, outreach_contact_id: contact.id,
    assigned_to: fields.assignedTo || createdBy, created_by: createdBy,
    assistance_requested: fields.assistanceRequested || [], follow_up_date: fields.followUpDate || null
  }).select("*, clients(nb_id, first_name, last_name)").single();
  if (error) throw error;
  return caseFromRow(data);
}

export async function updateCase(id, patch) {
  const { data, error } = await supabase.from("assistance_cases").update(casePatchToRow(patch)).eq("id", id)
    .select("*, clients(nb_id, first_name, last_name)").maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("not permitted");
  return caseFromRow(data);
}

export async function fetchCaseNotes(caseId) {
  const { data, error } = await supabase.from("assistance_case_notes").select("*").eq("case_id", caseId).order("created_at", { ascending: false });
  if (error) throw error;
  return data.map((r) => ({ id: r.id, content: r.content, createdBy: r.created_by, createdAt: r.created_at }));
}

export async function addCaseNote(caseId, content, createdBy) {
  const { error } = await supabase.from("assistance_case_notes").insert({ case_id: caseId, content: content.trim().slice(0, NOTE_MAX), created_by: createdBy });
  if (error) throw error;
}

export async function fetchStageHistory(caseId) {
  const { data, error } = await supabase.from("case_stage_history").select("*").eq("case_id", caseId).order("changed_at", { ascending: false });
  if (error) throw error;
  return data.map((r) => ({ id: r.id, fromStage: r.from_stage, toStage: r.to_stage, changedBy: r.changed_by, changedAt: r.changed_at }));
}
