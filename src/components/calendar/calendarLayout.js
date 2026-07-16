// calendarLayout.js -- shared time-grid math for WeekView/DayColumn/TimeSlot.
// Grid spans 8 AM-6 PM; HOUR_HEIGHT is the single source of truth for both
// the hour gridlines and event-card vertical placement so they always agree.
export var GRID_START_MIN = 8 * 60;
export var GRID_END_MIN = 18 * 60;
export var HOUR_HEIGHT = 64;
export var GRID_HEIGHT = ((GRID_END_MIN - GRID_START_MIN) / 60) * HOUR_HEIGHT;
export var HOURS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17];

export function toMinutes(timeStr) {
  if (!timeStr) return GRID_START_MIN;
  var parts = timeStr.split(":");
  return parseInt(parts[0], 10) * 60 + parseInt(parts[1] || "0", 10);
}

export function blockTop(startTime) {
  return ((toMinutes(startTime) - GRID_START_MIN) / 60) * HOUR_HEIGHT;
}

export function blockHeight(startTime, endTime) {
  var start = toMinutes(startTime);
  var end = endTime ? toMinutes(endTime) : start + 60;
  return Math.max(((end - start) / 60) * HOUR_HEIGHT, 28);
}

export function fmtHour(hour) {
  var h = hour % 12 === 0 ? 12 : hour % 12;
  return h + (hour < 12 ? " AM" : " PM");
}
