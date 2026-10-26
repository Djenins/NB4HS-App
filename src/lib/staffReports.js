// staffReports.js -- biweekly staff reports to the Executive Director
// (staff_reports_r1_core, reshaped by p6a_staff_reports_r1b). Each person who
// holds staff_reports.submit writes one report per reporting period, naming
// the programs they worked on; holders of staff_reports.review read,
// acknowledge or send them back (staff_reports.view_all reads only).
//
// The database is the real control: RLS, the staff_report_client_rules
// trigger and the submit/review RPCs. The pure helpers here mirror those
// rules so the UI explains a block before the server refuses it, and do the
// schedule arithmetic for display (the database computes the real deadlines).
import { DATE_LOCALE } from "./constants.js";
import { supabase } from "./supabase.js";

export var REPORT_STATUSES = ["draft", "submitted", "under_review", "revision_requested", "acknowledged"];
export var TEXT_FIELDS = ["activities", "accomplishments", "challenges", "assistanceNeeded", "nextGoals", "comments"];
export var REQUIRED_FIELDS = ["programs", "activities", "accomplishments", "challenges", "assistanceNeeded", "nextGoals"];
// Organization-wide or administration work, alongside the program keys.
export var ORGANIZATION = "organization";
export var REPORT_TEXT_MAX = 8000;
export var OUTCOMES_MAX = 30;
export var REVIEWER_ROLES = ["reviewer", "program_admin"];

var COLUMN = {
  activities: "activities", accomplishments: "accomplishments", challenges: "challenges",
  assistanceNeeded: "assistance_needed", nextGoals: "next_goals", comments: "comments"
};

function reportFromRow(row) {
  var p = row.reporting_periods || {};
  return {
    id: row.id, periodId: row.period_id, staffId: row.staff_id, programs: row.programs || [], status: row.status,
    activities: row.activities || "", accomplishments: row.accomplishments || "", challenges: row.challenges || "",
    assistanceNeeded: row.assistance_needed || "", noAssistanceNeeded: !!row.no_assistance_needed,
    nextGoals: row.next_goals || "", comments: row.comments || "", outcomes: normalizeOutcomes(row.outcomes),
    version: row.version || 0, submittedAt: row.submitted_at || null, reviewedBy: row.reviewed_by || null,
    reviewedAt: row.reviewed_at || null, acknowledgedAt: row.acknowledged_at || null,
    createdAt: row.created_at, updatedAt: row.updated_at,
    periodStart: p.period_start || null, periodEnd: p.period_end || null, dueAt: p.due_at || null
  };
}

function expectationFromRow(row) {
  return {
    periodId: row.period_id, periodStart: row.period_start || null, periodEnd: row.period_end || null,
    staffId: row.staff_id, programs: row.programs || [], dueAt: row.due_at, overdue: !!row.overdue,
    reportId: row.report_id || null, status: row.status, submittedAt: row.submitted_at || null, version: row.version || 0
  };
}

function scheduleFromRow(row) {
  return {
    id: row.id, name: row.name, firstPeriodStart: row.first_period_start, periodDays: row.period_days,
    deadlineDaysAfterEnd: row.deadline_days_after_end, deadlineTime: (row.deadline_time || "17:00").slice(0, 5),
    timeZone: row.time_zone, graceHours: row.grace_hours, reminderOffsets: row.reminder_offsets || [],
    active: !!row.active
  };
}

// ---------- pure helpers: dates and time zones ----------

function ymdToUtcDays(ymd) {
  var p = ymd.split("-").map(Number);
  return Date.UTC(p[0], p[1] - 1, p[2]) / 86400000;
}
function utcDaysToYmd(days) {
  var d = new Date(days * 86400000);
  return d.getUTCFullYear() + "-" + String(d.getUTCMonth() + 1).padStart(2, "0") + "-" + String(d.getUTCDate()).padStart(2, "0");
}
export function addDaysYmd(ymd, n) { return utcDaysToYmd(ymdToUtcDays(ymd) + n); }
export function daysBetween(fromYmd, toYmd) { return ymdToUtcDays(toYmd) - ymdToUtcDays(fromYmd); }

// The calendar date in `timeZone` at instant `when` -- "today" for a schedule.
export function localDateIn(timeZone, when) {
  var parts = new Intl.DateTimeFormat("en-CA", { timeZone: timeZone, year: "numeric", month: "2-digit", day: "2-digit" })
    .formatToParts(when || new Date());
  var m = {};
  parts.forEach(function (p) { m[p.type] = p.value; });
  return m.year + "-" + m.month + "-" + m.day;
}

function zoneOffsetMs(instantMs, timeZone) {
  var parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit"
  }).formatToParts(new Date(instantMs));
  var m = {};
  parts.forEach(function (p) { m[p.type] = p.value; });
  return Date.UTC(+m.year, +m.month - 1, +m.day, +m.hour, +m.minute, +m.second) - Math.floor(instantMs / 1000) * 1000;
}

// The instant a wall-clock time happens in `timeZone` (what Postgres's
// `timestamp at time zone tz` does). Two passes so the offset is the one in
// force at the result, not at the guess, across a DST change.
export function zonedTimeToUtc(ymd, hhmm, timeZone) {
  var d = ymd.split("-").map(Number);
  var t = hhmm.split(":").map(Number);
  var guess = Date.UTC(d[0], d[1] - 1, d[2], t[0], t[1] || 0);
  var result = guess - zoneOffsetMs(guess, timeZone);
  var second = guess - zoneOffsetMs(result, timeZone);
  return new Date(second !== result ? second : result);
}

// ---------- pure helpers: the schedule ----------

// Period n runs from first_period_start + n*period_days for period_days days.
// Never "twice a month": the dates drift across months on purpose.
export function periodForIndex(schedule, index) {
  var start = addDaysYmd(schedule.firstPeriodStart, index * schedule.periodDays);
  return { index: index, start: start, end: addDaysYmd(start, schedule.periodDays - 1) };
}

// The period containing `ymd`. Before the first period this returns index
// -1 or lower; callers show "first period starts …" instead.
export function periodForDate(schedule, ymd) {
  return periodForIndex(schedule, Math.floor(daysBetween(schedule.firstPeriodStart, ymd) / schedule.periodDays));
}

// Mirrors reporting_due_at(): the deadline day's wall-clock time in the zone.
export function dueAtFor(schedule, periodEnd) {
  return zonedTimeToUtc(addDaysYmd(periodEnd, schedule.deadlineDaysAfterEnd), schedule.deadlineTime, schedule.timeZone);
}

export function isOverdue(dueAt, submittedAt, graceHours, now) {
  if (submittedAt || !dueAt) return false;
  return (now || new Date()).getTime() > new Date(dueAt).getTime() + (graceHours || 0) * 3600000;
}

// Whole days from `now` until the deadline, counted in the schedule's zone
// (so "due tomorrow" flips at local midnight, not UTC midnight).
export function daysUntilDue(dueAt, timeZone, now) {
  return daysBetween(localDateIn(timeZone, now || new Date()), localDateIn(timeZone, new Date(dueAt)));
}

// "Mon, Nov 16, 5:00 PM EST" -- always in the schedule's zone, so a reviewer
// travelling elsewhere still sees the organization's deadline.
export function fmtDueAt(iso, timeZone, lang) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(DATE_LOCALE[lang] || "en-US", {
    timeZone: timeZone || "America/New_York", weekday: "short", month: "short", day: "numeric",
    hour: "numeric", minute: "2-digit", timeZoneName: "short"
  });
}

// "Nov 2 – Nov 15, 2026" from two YYYY-MM-DD strings.
export function fmtPeriod(start, end, lang) {
  if (!start || !end) return "—";
  var loc = DATE_LOCALE[lang] || "en-US";
  var a = new Date(start + "T12:00:00"), b = new Date(end + "T12:00:00");
  var short = { month: "short", day: "numeric" };
  var long = { month: "short", day: "numeric", year: "numeric" };
  return a.toLocaleDateString(loc, a.getFullYear() === b.getFullYear() ? short : long) + " – " + b.toLocaleDateString(loc, long);
}

// ---------- pure helpers: reports ----------

export function normalizeOutcomes(value) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, OUTCOMES_MAX).map(function (o) {
    return { metric: String((o && o.metric) || ""), value: String((o && o.value) || ""), notes: String((o && o.notes) || "") };
  });
}

// Outcome rows the author left completely empty are dropped before saving.
export function cleanOutcomes(outcomes) {
  return normalizeOutcomes(outcomes).filter(function (o) { return o.metric.trim() || o.value.trim() || o.notes.trim(); });
}

// Required fields still empty -- the same rule submit_staff_report() applies.
export function missingFields(report) {
  return REQUIRED_FIELDS.filter(function (f) {
    if (f === "programs") return !(report.programs && report.programs.length);
    if (f === "assistanceNeeded" && report.noAssistanceNeeded) return false;
    return !String(report[f] || "").trim();
  });
}

// "Students, Workforce" from program keys; `names` maps key -> name and
// `orgLabel` names the organization-wide option.
export function programsLabel(keys, names, orgLabel) {
  return (keys || []).map(function (k) { return k === ORGANIZATION ? orgLabel : names[k] || k; }).join(", ");
}

// Mirrors the RLS policies, the client-rules trigger and the review RPCs.
export function reportPermissions(report, userId, isReviewer) {
  var own = !!report && report.staffId === userId;
  var editable = own && (report.status === "draft" || report.status === "revision_requested");
  var reviewable = !!isReviewer && !!report && !own && (report.status === "submitted" || report.status === "under_review");
  return {
    canEdit: editable,
    canSubmit: editable,
    canDiscard: own && report.status === "draft" && !report.version,
    canAcknowledge: reviewable,
    canRequestRevision: reviewable
  };
}

export function statusVariant(status, overdue) {
  if (overdue) return "accent";
  return {
    draft: "neutral", not_started: "neutral", submitted: "default", under_review: "warn",
    revision_requested: "accent", acknowledged: "success"
  }[status] || "neutral";
}

// The headline numbers for one period on the reviewer dashboard.
export function summarizeExpectations(rows) {
  var s = { expected: 0, submitted: 0, pending: 0, overdue: 0, awaitingReview: 0, revisionRequested: 0, acknowledged: 0, rate: null };
  (rows || []).forEach(function (r) {
    s.expected += 1;
    if (r.submittedAt) s.submitted += 1;
    if (r.overdue) s.overdue += 1;
    else if (!r.submittedAt) s.pending += 1;
    if (r.status === "submitted" || r.status === "under_review") s.awaitingReview += 1;
    if (r.status === "revision_requested") s.revisionRequested += 1;
    if (r.status === "acknowledged") s.acknowledged += 1;
  });
  if (s.expected) s.rate = Math.round((s.submitted / s.expected) * 100);
  return s;
}

// What "My Reports" leads with: the period containing local today, or else
// the next one to come, with this person's row for it.
export function currentPeriodGroup(expectations, today) {
  var byPeriod = {};
  (expectations || []).forEach(function (e) { (byPeriod[e.periodId] = byPeriod[e.periodId] || []).push(e); });
  var groups = Object.keys(byPeriod).map(function (id) {
    var rows = byPeriod[id];
    return { periodId: id, start: rows[0].periodStart, end: rows[0].periodEnd, dueAt: rows[0].dueAt, rows: rows };
  }).sort(function (a, b) { return a.start.localeCompare(b.start); });
  var current = groups.find(function (g) { return g.start <= today && today <= g.end; });
  return current || groups.find(function (g) { return g.start > today; }) || groups[groups.length - 1] || null;
}

// Search/filter for the reviewer's tables. `names` maps staff id -> name and
// program key -> name, so search matches what the reviewer sees.
export function filterReportRows(rows, filters, names) {
  var q = String((filters && filters.q) || "").trim().toLowerCase();
  return (rows || []).filter(function (r) {
    if (filters.program && (r.programs || []).indexOf(filters.program) === -1) return false;
    if (filters.staffId && r.staffId !== filters.staffId) return false;
    if (filters.status === "overdue" && !r.overdue) return false;
    if (filters.status && filters.status !== "overdue" && r.status !== filters.status) return false;
    if (!q) return true;
    var hay = [names.staff[r.staffId]].concat((r.programs || []).map(function (k) { return names.programs[k] || k; })).join(" ").toLowerCase();
    return hay.indexOf(q) !== -1;
  });
}

function csvCell(v) {
  var s = v === null || v === undefined ? "" : String(v);
  // Neutralize spreadsheet formulas, then quote.
  if (/^[=+\-@]/.test(s)) s = "'" + s;
  return '"' + s.replace(/"/g, '""') + '"';
}
export function toCsv(header, rows) {
  return [header].concat(rows).map(function (r) { return r.map(csvCell).join(","); }).join("\r\n");
}

// ---------- data ----------

// Program names by key, for labels: { students: "Students", ... }.
export async function fetchProgramNames() {
  const { data, error } = await supabase.from("app_modules").select("key, name_en").eq("kind", "program").order("sort_order");
  if (error) throw error;
  const out = {};
  data.forEach(function (m) { out[m.key] = m.name_en; });
  return out;
}

// What the signed-in person can report on: 'organization' first, then the
// programs they can open (my_report_program_options).
export async function fetchMyProgramOptions() {
  const { data, error } = await supabase.rpc("my_report_program_options");
  if (error) throw error;
  return data || [ORGANIZATION];
}

export async function fetchSchedules() {
  const { data, error } = await supabase.from("reporting_schedules").select("*").order("created_at");
  if (error) throw error;
  return data.map(scheduleFromRow);
}

export async function updateSchedule(schedule) {
  const { error } = await supabase.from("reporting_schedules").update({
    name: schedule.name, first_period_start: schedule.firstPeriodStart, period_days: schedule.periodDays,
    deadline_days_after_end: schedule.deadlineDaysAfterEnd, deadline_time: schedule.deadlineTime,
    time_zone: schedule.timeZone, grace_hours: schedule.graceHours, reminder_offsets: schedule.reminderOffsets,
    active: schedule.active
  }).eq("id", schedule.id);
  if (error) throw error;
}

export async function fetchMyExpectations() {
  const { data, error } = await supabase.rpc("my_staff_report_expectations");
  if (error) throw error;
  return (data || []).map(expectationFromRow);
}

export async function fetchPeriods() {
  await supabase.rpc("ensure_reporting_periods");
  const { data, error } = await supabase.from("reporting_periods").select("*").order("period_start", { ascending: false });
  if (error) throw error;
  return data.map(function (p) { return { id: p.id, scheduleId: p.schedule_id, start: p.period_start, end: p.period_end, dueAt: p.due_at }; });
}

const REPORT_SELECT = "*, reporting_periods(period_start, period_end, due_at)";

export async function fetchReports(filters) {
  let query = supabase.from("staff_reports").select(REPORT_SELECT);
  if (filters && filters.staffId) query = query.eq("staff_id", filters.staffId);
  if (filters && filters.submittedOnly) query = query.not("submitted_at", "is", null);
  const { data, error } = await query.order("created_at", { ascending: false });
  if (error) throw error;
  return data.map(reportFromRow);
}

export async function fetchReport(id) {
  const { data, error } = await supabase.from("staff_reports").select(REPORT_SELECT).eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? reportFromRow(data) : null;
}

// Starts the caller's draft for a period. A unique-violation means one
// already exists (another tab, a double click) -- open that one.
export async function createDraft(periodId, staffId) {
  const { data, error } = await supabase.from("staff_reports")
    .insert({ period_id: periodId }).select(REPORT_SELECT).single();
  if (error && error.code === "23505") {
    const existing = await supabase.from("staff_reports").select(REPORT_SELECT)
      .eq("period_id", periodId).eq("staff_id", staffId).maybeSingle();
    if (existing.error) throw existing.error;
    return reportFromRow(existing.data);
  }
  if (error) throw error;
  return reportFromRow(data);
}

export async function saveDraft(id, fields) {
  const row = { no_assistance_needed: !!fields.noAssistanceNeeded, outcomes: cleanOutcomes(fields.outcomes), programs: fields.programs || [] };
  TEXT_FIELDS.forEach(function (f) { row[COLUMN[f]] = String(fields[f] || "").slice(0, REPORT_TEXT_MAX); });
  const { data, error } = await supabase.from("staff_reports").update(row).eq("id", id).select(REPORT_SELECT).single();
  if (error) throw error;
  return reportFromRow(data);
}

export async function discardDraft(id) {
  const { error } = await supabase.from("staff_reports").delete().eq("id", id);
  if (error) throw error;
}

async function callStatusRpc(fn, args) {
  const { error } = await supabase.rpc(fn, args);
  if (error) throw error;
  return fetchReport(args.p_report_id);
}
export function submitReport(id) { return callStatusRpc("submit_staff_report", { p_report_id: id }); }
export function startReview(id) { return callStatusRpc("start_staff_report_review", { p_report_id: id }); }
export function acknowledgeReport(id, comment) { return callStatusRpc("acknowledge_staff_report", { p_report_id: id, p_comment: comment || null }); }
export function requestRevision(id, comment) { return callStatusRpc("request_staff_report_revision", { p_report_id: id, p_comment: comment }); }

// Frozen submissions (newest first) and the review trail (oldest first).
export async function fetchReportHistory(id) {
  const [versions, reviews] = await Promise.all([
    supabase.from("staff_report_versions").select("*").eq("report_id", id).order("version", { ascending: false }),
    supabase.from("staff_report_reviews").select("*").eq("report_id", id).order("created_at")
  ]);
  if (versions.error) throw versions.error;
  if (reviews.error) throw reviews.error;
  return {
    versions: versions.data.map(function (v) {
      var c = v.content || {};
      return {
        version: v.version, submittedAt: v.submitted_at,
        content: {
          activities: c.activities || "", accomplishments: c.accomplishments || "", challenges: c.challenges || "",
          assistanceNeeded: c.assistance_needed || "", noAssistanceNeeded: !!c.no_assistance_needed,
          nextGoals: c.next_goals || "", comments: c.comments || "", outcomes: normalizeOutcomes(c.outcomes),
          programs: c.programs || [], positions: c.positions || []
        }
      };
    }),
    reviews: reviews.data.map(function (r) {
      return { id: r.id, actorId: r.actor_id, action: r.action, version: r.version, comment: r.comment || "", createdAt: r.created_at };
    })
  };
}

// Email copies of report notices (p6b): queue counts, the last error and
// whether sending is set up. Null when the queue doesn't exist yet.
export async function fetchQueueHealth() {
  const { data, error } = await supabase.rpc("outbound_queue_health");
  if (error) return null;
  const h = (data || [])[0];
  if (!h) return null;
  return {
    queued: h.queued || 0, sending: h.sending || 0, sent7d: h.sent_7d || 0, failed: h.failed || 0,
    oldestQueuedAt: h.oldest_queued_at || null, lastError: h.last_error || "", lastErrorAt: h.last_error_at || null,
    configured: !!h.configured
  };
}

export async function fetchOverview(periodId) {
  const { data, error } = await supabase.rpc("staff_reports_overview", { p_period_id: periodId });
  if (error) throw error;
  return (data || []).map(expectationFromRow);
}
