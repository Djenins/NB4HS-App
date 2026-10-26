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
  "communication:followup": "warning"
};

export function statusTone(domain, status) {
  return STATUS_TONES[domain + ":" + status] || "neutral";
}
