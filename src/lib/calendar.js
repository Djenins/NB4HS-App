// calendar.js -- pure helpers for the shared calendar's week-grid view.
// Class blocks (Level 1/2/3, 9:30-12:30) are derived from `data.classes`
// (the same table Dashboard/CheckIn already read) rather than stored as
// calendar_events rows, since the class schedule is a fixed recurring
// block, not something staff edit day-by-day.
export var CLASS_START_TIME = "09:30";
export var CLASS_END_TIME = "12:30";

// Sunday-first week (matches WEEKDAYS in constants.js / Date.getDay()).
export function startOfWeek(date) {
  var d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay());
  return d;
}

export function addDays(date, n) {
  var d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

export function weekDays(weekStart) {
  var out = [];
  for (var i = 0; i < 7; i++) out.push(addDays(weekStart, i));
  return out;
}

// Every active, in-person class (Online has no fixed days -- see
// DEFAULT_CLASSES in constants.js) that meets on the given JS weekday
// (0=Sun..6=Sat), as a calendar block.
export function classBlocksForDay(classes, weekday) {
  return (classes || [])
    .filter(function (c) { return c.active !== false && (c.days || []).indexOf(weekday) !== -1; })
    .map(function (c) {
      return { key: "class_" + c.key, kind: "class", title: c.name, startTime: CLASS_START_TIME, endTime: CLASS_END_TIME };
    });
}

export function sortDayBlocks(blocks) {
  return (blocks || []).slice().sort(function (a, b) {
    return (a.startTime || "").localeCompare(b.startTime || "");
  });
}
