// placements.js -- constants and pure helpers for the Placements module
// (src/pages/Placements.jsx, src/pages/PlacementDetail.jsx and friends).
// Mirrors jobOpenings.js's shape.
import { addDays, todayStr } from "./utils.js";

export var PLACEMENT_STATUSES = [
  { key: "active", en: "Active" },
  { key: "ended", en: "Ended" }
];

// Ordered 30/60/90/180-day check-in schedule, days-from-start-date.
export var CHECKIN_TYPES = [
  { key: "30", en: "30-Day", days: 30 },
  { key: "60", en: "60-Day", days: 60 },
  { key: "90", en: "90-Day", days: 90 },
  { key: "180", en: "180-Day", days: 180 }
];

export var PERFORMANCE_RATINGS = [
  { key: "excellent", en: "Excellent" },
  { key: "good", en: "Good" },
  { key: "fair", en: "Fair" },
  { key: "poor", en: "Poor" }
];

function labelFor(list, key) {
  var found = list.filter(function (i) { return i.key === key; })[0];
  return found ? found.en : (key || "");
}
export function placementStatusLabel(key) { return labelFor(PLACEMENT_STATUSES, key); }
export function checkinTypeLabel(key) { return labelFor(CHECKIN_TYPES, key); }
export function performanceRatingLabel(key) { return labelFor(PERFORMANCE_RATINGS, key); }

export function placementStatusBadgeVariant(key) { return key === "active" ? "success" : "neutral"; }

export function checkinDueDate(startDate, days) {
  return startDate ? addDays(startDate, days) : "";
}

// "completed" | "due" (past due_date, not completed) | "upcoming" -- drives
// both the list table's status dots and the detail page's timeline.
export function checkinState(checkin) {
  if (checkin.completed) return "completed";
  if (checkin.dueDate && checkin.dueDate <= todayStr()) return "due";
  return "upcoming";
}

// Honest, disclosed definition: among placements old enough to evaluate
// (start_date at least 90 days ago), the percentage still active today.
// This is a point-in-time snapshot, not a time-travel-accurate calculation
// -- there's no historical status log to do better than that. Returns null
// (not 0) when there are no eligible placements yet, so callers can render
// "--" instead of a misleading 0%.
export function computeRetentionRate(placements) {
  var cutoff = addDays(todayStr(), -90);
  var eligible = (placements || []).filter(function (p) { return p.startDate && p.startDate <= cutoff; });
  if (eligible.length === 0) return null;
  var retained = eligible.filter(function (p) { return p.currentStatus === "active"; }).length;
  return Math.round((retained / eligible.length) * 100);
}
