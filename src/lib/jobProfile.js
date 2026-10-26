// jobProfile.js -- constants and pure helpers for the Job Developer client
// detail page (src/pages/JobClientProfile.jsx). Follows the exact
// CASE_SERVICES/caseServiceLabel pattern already in constants.js/clients.js
// -- kept in its own file since none of this is shared by Case Management.
// The status and stage lists carry ht/fr like CASE_SERVICES, and their label
// helpers take an optional `lang`; the remaining lists (barriers, services)
// are still English-only. Stored values are always the `key`, never a label.
import { uid } from "./utils.js";

export var EMPLOYMENT_STATUSES = [
  { key: "not_started", en: "Not Started", ht: "Poko Kòmanse", fr: "Pas commencé" },
  { key: "assessment_needed", en: "Assessment Needed", ht: "Bezwen Evalyasyon", fr: "Évaluation requise" },
  { key: "resume_needed", en: "Resume Needed", ht: "Bezwen Rezime", fr: "CV requis" },
  { key: "resume_in_progress", en: "Resume in Progress", ht: "Rezime ap Prepare", fr: "CV en cours" },
  { key: "job_ready", en: "Job Ready", ht: "Pare pou Travay", fr: "Prêt à l'emploi" },
  { key: "actively_looking", en: "Actively Looking", ht: "Ap Chèche Aktivman", fr: "En recherche active" },
  { key: "applied", en: "Applied", ht: "Aplike", fr: "Candidature envoyée" },
  { key: "interview_scheduled", en: "Interview Scheduled", ht: "Entèvyou Pwograme", fr: "Entretien prévu" },
  { key: "offer_received", en: "Offer Received", ht: "Resevwa Òf", fr: "Offre reçue" },
  { key: "employed", en: "Employed", ht: "Gen Travay", fr: "En emploi" },
  { key: "follow_up_needed", en: "Follow-Up Needed", ht: "Bezwen Swivi", fr: "Suivi requis" },
  { key: "closed", en: "Closed", ht: "Fèmen", fr: "Clôturé" }
];

export var WORK_AUTH_STATUSES = [
  { key: "us_citizen", en: "U.S. Citizen", ht: "Sitwayen Ameriken", fr: "Citoyen américain" },
  { key: "permanent_resident", en: "Permanent Resident", ht: "Rezidan Pèmanan", fr: "Résident permanent" },
  { key: "tps", en: "TPS" },
  { key: "refugee", en: "Refugee", ht: "Refijye", fr: "Réfugié" },
  { key: "asylum_pending", en: "Asylum Pending", ht: "Azil an Atant", fr: "Asile en attente" },
  { key: "ead", en: "Employment Authorization Document", ht: "Dokiman Otorizasyon Travay (EAD)", fr: "Autorisation de travail (EAD)" },
  { key: "expired", en: "Work Permit Expired", ht: "Pèmi Travay Ekspire", fr: "Permis de travail expiré" },
  { key: "not_authorized", en: "Not Authorized", ht: "Pa Otorize", fr: "Non autorisé" },
  { key: "other", en: "Other", ht: "Lòt", fr: "Autre" }
];

export var JOB_PIPELINE_STAGES = [
  { key: "resume", en: "Resume", ht: "Rezime", fr: "CV" },
  { key: "applying", en: "Applying", ht: "Ap Aplike", fr: "Candidatures" },
  { key: "interview", en: "Interview", ht: "Entèvyou", fr: "Entretien" },
  { key: "offer", en: "Offer", ht: "Òf", fr: "Offre" },
  { key: "employed", en: "Employed", ht: "Gen Travay", fr: "En emploi" }
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
  { key: "applied", en: "Applied", ht: "Aplike", fr: "Candidature envoyée" },
  { key: "under_review", en: "Under Review", ht: "Y ap Revize", fr: "En cours d'examen" },
  { key: "interview_scheduled", en: "Interview Scheduled", ht: "Entèvyou Pwograme", fr: "Entretien prévu" },
  { key: "offer_received", en: "Offer Received", ht: "Resevwa Òf", fr: "Offre reçue" },
  { key: "hired", en: "Hired", ht: "Anboche", fr: "Embauché" },
  { key: "not_selected", en: "Not Selected", ht: "Pa Chwazi", fr: "Non retenu" },
  { key: "withdrawn", en: "Withdrawn", ht: "Retire", fr: "Retirée" }
];

function labelFor(list, key, lang) {
  var found = list.filter(function (i) { return i.key === key; })[0];
  return found ? (found[lang] || found.en) : (key || "");
}
export function employmentStatusLabel(key, lang) { return labelFor(EMPLOYMENT_STATUSES, key, lang); }
export function workAuthLabel(key, lang) { return labelFor(WORK_AUTH_STATUSES, key, lang); }
export function pipelineStageLabel(key, lang) { return labelFor(JOB_PIPELINE_STAGES, key, lang); }
export function barrierLabel(key) { return labelFor(BARRIERS_TO_EMPLOYMENT, key); }
export function jobServiceLabel(key) { return labelFor(JOB_SERVICES_PROVIDED, key); }
export function applicationStatusLabel(key, lang) { return labelFor(APPLICATION_STATUSES, key, lang); }

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
