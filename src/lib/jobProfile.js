// jobProfile.js -- constants and pure helpers for the Job Developer client
// detail page (src/pages/JobClientProfile.jsx). Follows the exact
// CASE_SERVICES/caseServiceLabel pattern already in constants.js/clients.js
// -- kept in its own file since none of this is shared by Case Management.
// Unlike CASE_SERVICES, these lists are English-only (no ht/es/fr) --
// deliberate scope cut given the size of this feature; label lookups always
// return the English string regardless of app language. Worth revisiting if
// this page needs full i18n parity with the rest of the app later.
import { uid } from "./utils.js";

export var EMPLOYMENT_STATUSES = [
  { key: "not_started", en: "Not Started" },
  { key: "assessment_needed", en: "Assessment Needed" },
  { key: "resume_needed", en: "Resume Needed" },
  { key: "resume_in_progress", en: "Resume in Progress" },
  { key: "job_ready", en: "Job Ready" },
  { key: "actively_looking", en: "Actively Looking" },
  { key: "applied", en: "Applied" },
  { key: "interview_scheduled", en: "Interview Scheduled" },
  { key: "offer_received", en: "Offer Received" },
  { key: "employed", en: "Employed" },
  { key: "follow_up_needed", en: "Follow-Up Needed" },
  { key: "closed", en: "Closed" }
];

export var WORK_AUTH_STATUSES = [
  { key: "us_citizen", en: "U.S. Citizen" },
  { key: "permanent_resident", en: "Permanent Resident" },
  { key: "tps", en: "TPS" },
  { key: "refugee", en: "Refugee" },
  { key: "asylum_pending", en: "Asylum Pending" },
  { key: "ead", en: "Employment Authorization Document" },
  { key: "expired", en: "Work Permit Expired" },
  { key: "not_authorized", en: "Not Authorized" },
  { key: "other", en: "Other" }
];

export var JOB_PIPELINE_STAGES = [
  { key: "resume", en: "Resume" },
  { key: "applying", en: "Applying" },
  { key: "interview", en: "Interview" },
  { key: "offer", en: "Offer" },
  { key: "employed", en: "Employed" }
];

export var BARRIERS_TO_EMPLOYMENT = [
  { key: "transportation", en: "Transportation" },
  { key: "childcare", en: "Childcare" },
  { key: "english", en: "English" },
  { key: "no_computer", en: "No Computer" },
  { key: "no_resume", en: "No Resume" },
  { key: "legal_status", en: "Legal Status" },
  { key: "housing", en: "Housing" },
  { key: "healthcare", en: "Healthcare" }
];

export var JOB_SERVICES_PROVIDED = [
  { key: "resume_assistance", en: "Resume Assistance" },
  { key: "interview_coaching", en: "Interview Coaching" },
  { key: "job_referral", en: "Job Referral" },
  { key: "career_counseling", en: "Career Counseling" },
  { key: "job_placement", en: "Job Placement" },
  { key: "retention_followup", en: "Retention Follow-Up" }
];

export var APPLICATION_STATUSES = [
  { key: "applied", en: "Applied" },
  { key: "under_review", en: "Under Review" },
  { key: "interview_scheduled", en: "Interview Scheduled" },
  { key: "offer_received", en: "Offer Received" },
  { key: "hired", en: "Hired" },
  { key: "not_selected", en: "Not Selected" },
  { key: "withdrawn", en: "Withdrawn" }
];

function labelFor(list, key) {
  var found = list.filter(function (i) { return i.key === key; })[0];
  return found ? found.en : (key || "");
}
export function employmentStatusLabel(key) { return labelFor(EMPLOYMENT_STATUSES, key); }
export function workAuthLabel(key) { return labelFor(WORK_AUTH_STATUSES, key); }
export function pipelineStageLabel(key) { return labelFor(JOB_PIPELINE_STAGES, key); }
export function barrierLabel(key) { return labelFor(BARRIERS_TO_EMPLOYMENT, key); }
export function jobServiceLabel(key) { return labelFor(JOB_SERVICES_PROVIDED, key); }
export function applicationStatusLabel(key) { return labelFor(APPLICATION_STATUSES, key); }

export function pipelineStageIndex(key) {
  var i = JOB_PIPELINE_STAGES.findIndex(function (s) { return s.key === key; });
  return i === -1 ? 0 : i;
}

// Application statuses that still represent an open, in-progress application
// (as opposed to a terminal outcome like hired/not_selected/withdrawn) --
// only these count toward a client "needing" follow-up.
export var OPEN_APPLICATION_STATUSES = ["applied", "under_review", "interview_scheduled", "offer_received"];

// One entry per job client with an open application whose next step is due
// today or already overdue, keyed by jobClientId and keeping the earliest
// such date per client. Powers the "Follow-ups Due" KPI/column on the Job
// Developer list page -- the daily triage question of "who do I need to
// call today" that the raw client list otherwise doesn't answer.
export function computeFollowUps(applications, todayStr) {
  var map = {};
  (applications || []).forEach(function (a) {
    if (!a.jobClientId || !a.nextStepDate || a.nextStepDate > todayStr) return;
    if (OPEN_APPLICATION_STATUSES.indexOf(a.status) === -1) return;
    var existing = map[a.jobClientId];
    if (!existing || a.nextStepDate < existing.nextStepDate) {
      map[a.jobClientId] = { nextStepDate: a.nextStepDate, company: a.company, position: a.position, nextStepNote: a.nextStepNote };
    }
  });
  return map;
}

// Pure constructor for one row in a job record's applications[] array.
export function buildApplication(fields) {
  return {
    id: uid(),
    company: (fields.company || "").trim(),
    position: (fields.position || "").trim(),
    appliedDate: fields.appliedDate || "",
    status: fields.status || "applied",
    nextStepDate: fields.nextStepDate || "",
    nextStepNote: (fields.nextStepNote || "").trim(),
    interviewDate: fields.interviewDate || "",
    interviewNotes: (fields.interviewNotes || "").trim()
  };
}

// Deterministic 0-100 readiness score from what's actually on file --
// no manual entry, so it can't drift from the record it describes.
// Weights: resume 25, work authorization on file & not expired 25,
// >=1 skill 15, >=1 service provided 15, pipeline-stage progress 20.
export function computeJobReadinessScore(record) {
  var score = 0;
  if (record.hasResume) score += 25;
  if (record.workAuthorization && record.workAuthorization !== "expired" && record.workAuthorization !== "not_authorized") score += 25;
  if ((record.skills || []).length > 0) score += 15;
  if ((record.servicesProvided || []).length > 0) score += 15;
  score += Math.round((pipelineStageIndex(record.pipelineStage) / (JOB_PIPELINE_STAGES.length - 1)) * 20);
  return Math.min(100, score);
}
export function readinessBucket(score) {
  if (score >= 80) return { key: "good", labelKey: "readinessGood", tone: "success" };
  if (score >= 50) return { key: "fair", labelKey: "readinessFair", tone: "warn" };
  return { key: "attention", labelKey: "readinessAttention", tone: "accent" };
}
