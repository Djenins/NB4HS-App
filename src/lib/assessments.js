// assessments.js -- NRS Educational Functioning Level lookup + pretest/
// posttest gain calculation for the Students roster, ported from a CASAS
// Reading STEPS score-range chart the client shared. NB4HS only administers
// the Reading STEPS test (no Listening component), so despite NRS_LEVELS
// (constants.js) still carrying the reference chart's Listening ranges too,
// every lookup here is Reading-only. Kept as its own small domain file (same
// pattern as clients.js/appointments.js) since this is a distinct concern
// from the roster/board logic in students.js.
import { NRS_LEVELS } from "./constants.js";

export function isScoreEntered(v) {
  return v !== "" && v !== null && v !== undefined && !isNaN(Number(v));
}

// Looks up the NRS level for a single Reading STEPS score. Returns null if
// no valid score was entered.
export function nrsLevelForReading(score) {
  if (!isScoreEntered(score)) return null;
  var n = Number(score);
  return NRS_LEVELS.filter(function (l) { return n >= l.readingMin && n <= l.readingMax; })[0] || null;
}

// Full assessment picture for one student, based on the Reading STEPS
// pretest/posttest, with a status the UI can branch on:
//   "noPretest"       -- nothing entered yet, nothing to show
//   "posttestMissing" -- pretest done, posttest not yet entered -- FLAG this
//                        ("Post-test Required" on the card)
//   "complete"        -- both pretest and posttest entered; `gain` is
//                        true/false based on whether the posttest level is
//                        higher than the pretest level
//
// `outcome` is the Outcome field the client asked for:
//   "completed"      -- automatic, whenever both tests are in AND there's a
//                       gain. This overrides any manual choice below -- a
//                       real gain always wins.
//   "working" / "scheduleRetest" -- the two dropdown choices staff pick
//                       between for everyone else (posttest not in yet, or
//                       no gain). Stored on student.outcome; defaults to
//                       "working" until staff sets it.
export function studentAssessmentStatus(student) {
  var s = student || {};
  var hasPretest = isScoreEntered(s.pretestReading);
  var hasPosttest = isScoreEntered(s.posttestReading);
  var pretestLevel = nrsLevelForReading(s.pretestReading);
  var posttestLevel = nrsLevelForReading(s.posttestReading);

  if (!hasPretest) return { status: "noPretest", pretestLevel: null, posttestLevel: null, gain: null, outcome: null, outcomeEditable: false };
  if (!hasPosttest) {
    return { status: "posttestMissing", pretestLevel: pretestLevel, posttestLevel: null, gain: null, outcome: s.outcome || "working", outcomeEditable: true };
  }
  var gain = !!(posttestLevel && pretestLevel && posttestLevel.order > pretestLevel.order);
  if (gain) return { status: "complete", pretestLevel: pretestLevel, posttestLevel: posttestLevel, gain: true, outcome: "completed", outcomeEditable: false };
  return { status: "complete", pretestLevel: pretestLevel, posttestLevel: posttestLevel, gain: false, outcome: s.outcome || "working", outcomeEditable: true };
}
