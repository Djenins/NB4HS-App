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

  // Staff accounts (Administration)
  "account:active": "success",
  "account:invited": "info",
  "account:pending": "warning",
  "account:deactivated": "neutral",
  "roleKind:builtin": "violet",
  "roleKind:custom": "info",
  "roleKind:legacy": "neutral"
};

export function statusTone(domain, status) {
  return STATUS_TONES[domain + ":" + status] || "neutral";
}
