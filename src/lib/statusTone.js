// statusTone.js -- the one place a domain status becomes a colour.
// Every status badge in the app asks this map which tone to use, so
// "completed" is the same green on every screen and red stays reserved for
// errors and overdue work (PRODUCT.md, brand commitments).
//
// Keys are "<domain>:<status>". Domains migrate in as their pages move onto
// the design system; an unknown status falls back to neutral rather than
// guessing a colour.
const STATUS_TONES = {
  // Visitor log (Search, Check-Out)
  "visit:in": "success",
  "visit:out": "neutral",

  // Client records and program enrollment (Client Profile)
  "client:active": "success",
  "client:inactive": "neutral",
  "enrollment:active": "success",
  "enrollment:inactive": "neutral",
  "enrollment:droppedOut": "warning",
  "enrollment:waitlisted": "warning",

  // Classes and assessments (Students, Assessments)
  "classroom:open": "info",
  "classroom:full": "warning",
  "outcome:completed": "success",
  "assessment:posttestMissing": "warning",
  "assessment:gain": "success",
  "assessment:noGain": "neutral",
  "assessment:completed": "success",

  // Appointments (Client Profile, Case Management, Job Developer)
  "appointment:requested": "warning",
  "appointment:scheduled": "info",
  "appointment:completed": "success",
  "appointment:cancelled": "neutral",

  // Client communications log
  "communication:followup": "warning",

  // Outreach follow-up tasks (overdue/dueToday are derived from open + due date)
  "task:overdue": "danger",
  "task:dueToday": "warning",
  "task:open": "info",
  "task:done": "success",
  "taskPriority:high": "warning",
  "taskPriority:low": "neutral",
  "caseReview:requested": "warning",

  // Workforce: job openings, referrals, placements (not_selected is neutral -- it isn't an error)
  "opening:draft": "neutral",
  "opening:active": "success",
  "opening:filled": "info",
  "opening:expired": "warning",
  "opening:archived": "neutral",
  "referral:ready": "neutral",
  "referral:interested": "info",
  "referral:referred": "info",
  "referral:applied": "warning",
  "referral:interview": "warning",
  "referral:offer": "success",
  "referral:hired": "success",
  "referral:not_selected": "neutral",
  "placement:active": "success",
  "placement:ended": "neutral",

  // Workforce job seekers (employment status, documents, follow-ups) and employer partnership stage
  "employment:not_started": "neutral",
  "employment:assessment_needed": "warning",
  "employment:resume_needed": "warning",
  "employment:resume_in_progress": "info",
  "employment:job_ready": "info",
  "employment:actively_looking": "info",
  "employment:applied": "info",
  "employment:interview_scheduled": "violet",
  "employment:offer_received": "success",
  "employment:employed": "success",
  "employment:follow_up_needed": "warning",
  "employment:closed": "neutral",
  "workPermit:yes": "info",
  "workPermit:no": "neutral",
  "resume:onFile": "success",
  "resume:none": "neutral",
  "followUp:overdue": "danger",
  "followUp:dueToday": "warning",
  "employer:prospect": "neutral",
  "employer:contacted": "info",
  "employer:meeting_scheduled": "warning",
  "employer:partner": "success",
  "employer:hiring": "success",
  "employer:inactive": "neutral",

  // Candidate Matching: match strength and candidate flags
  "match:strong": "success",
  "match:good": "info",
  "match:possible": "neutral",
  "candidate:resume": "success",
  "candidate:noResume": "neutral",
  "candidate:workAuth": "neutral",
  "candidate:barrier": "warning",

  // Placement retention check-ins (due = past due, so danger)
  "checkin:completed": "success",
  "checkin:due": "danger",
  "checkin:upcoming": "neutral",

  // Job applications (Job Seeker profile) and employer activity log
  "application:applied": "info",
  "application:under_review": "warning",
  "application:interview_scheduled": "warning",
  "application:offer_received": "success",
  "application:hired": "success",
  "application:not_selected": "neutral",
  "application:withdrawn": "neutral",
  "employerActivity:followup": "warning"
};

export function statusTone(domain, status) {
  return STATUS_TONES[domain + ":" + status] || "neutral";
}
