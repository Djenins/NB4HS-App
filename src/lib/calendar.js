// calendar.js -- pure helpers for the shared calendar's week-grid view.
// Class blocks (Level 1/2/3, 9:30-12:30) are derived from `data.classes`
// (the same table Dashboard/CheckIn already read) rather than stored as
// calendar_events rows, since the class schedule is a fixed recurring
// block, not something staff edit day-by-day.
export var CLASS_START_TIME = "09:30";
export var CLASS_END_TIME = "12:30";

// Week start defaults to Sunday (matches WEEKDAYS in constants.js /
// Date.getDay()); pass startDay=1 for a Monday-first week (Calendar Settings).
export function startOfWeek(date, startDay) {
  var start = startDay || 0;
  var d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() - start + 7) % 7));
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
// (0=Sun..6=Sat). All classes share one fixed start/end (the whole point of
// the class time-block setting), so any classes meeting the same day --
// e.g. Level 1 & Level 2, both Mon/Wed/Fri -- form a single group.
export function activeClassesForDay(classes, weekday) {
  return (classes || []).filter(function (c) {
    return c.active !== false && (c.days || []).indexOf(weekday) !== -1;
  });
}

export function classGroupKey(activeClasses) {
  return activeClasses.map(function (c) { return c.key; }).join("_");
}

// Which palette each distinct class grouping draws from, so Level 1 & 2
// (Mon/Wed/Fri) and Level 3 (Tue/Thu) don't render as the same blue card
// five days running. Derived from the schedule itself rather than hard-coded
// per class name: walk the work week in order, and the first time a new
// grouping appears it claims the next palette slot. Stable for a given
// `classes` array, and it degrades to "everything is slot 0" (today's single
// blue) if every weekday happens to hold the same set of classes.
export function classGroupAccents(classes) {
  var map = {};
  var next = 0;
  for (var weekday = 1; weekday <= 5; weekday++) {
    var active = activeClassesForDay(classes, weekday);
    if (!active.length) continue;
    var key = classGroupKey(active);
    if (map[key] === undefined) { map[key] = next; next++; }
  }
  return map;
}

// The day's class group as one calendar block. `accents` is the map from
// classGroupAccents(); `classKeys` is carried on the block so the page can
// attach the things only it can resolve -- the service label and the live
// enrolled-student count -- without this staying pure-data helper needing
// the language, the custom-service list or the student roster.
export function classBlocksForDay(classes, weekday, startTime, endTime, accents) {
  var start = startTime || CLASS_START_TIME;
  var end = endTime || CLASS_END_TIME;
  var active = activeClassesForDay(classes, weekday);
  if (!active.length) return [];
  var groupKey = classGroupKey(active);
  return [{
    key: "class_" + groupKey,
    kind: "class",
    title: active.map(function (c) { return c.name; }).join(" & "),
    classKeys: active.map(function (c) { return c.key; }),
    accentIndex: (accents && accents[groupKey]) || 0,
    startTime: start,
    endTime: end
  }];
}

export function startOfMonth(date) {
  var d = new Date(date);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

// Sets date-of-month to 1 first so e.g. Jan 31 + 1 month lands on Feb 1,
// not rolling over into March the way `setMonth` would on a 31-day source.
export function addMonths(date, n) {
  var d = new Date(date);
  d.setDate(1);
  d.setMonth(d.getMonth() + n);
  return d;
}

// Always 42 cells (6 full weeks) so the month grid never reflows height as
// the user navigates between shorter/longer months.
export function monthGridDays(monthAnchor, weekStartDay) {
  var gridStart = startOfWeek(startOfMonth(monthAnchor), weekStartDay);
  var out = [];
  for (var i = 0; i < 42; i++) out.push(addDays(gridStart, i));
  return out;
}

// NB4HS is closed Sat/Sun, so the calendar only shows the Mon-Fri work
// week -- these variants replace weekDays()/monthGridDays() everywhere the
// page renders a grid; the weekend-inclusive versions above are kept only
// because startOfWeek()/monthGridDays() are still handy building blocks.
export function workWeekDays(anchorDate) {
  var monday = startOfWeek(anchorDate, 1);
  var out = [];
  for (var i = 0; i < 5; i++) out.push(addDays(monday, i));
  return out;
}

// 6 work-weeks (30 cells) covering the month, Monday-anchored regardless of
// the (now-unused) week-starts-on setting since there's no weekend column
// to disagree about.
export function workMonthGridDays(monthAnchor) {
  var gridStart = startOfWeek(startOfMonth(monthAnchor), 1);
  var out = [];
  for (var week = 0; week < 6; week++) {
    for (var i = 0; i < 5; i++) out.push(addDays(gridStart, week * 7 + i));
  }
  return out;
}

export function isWeekend(date) {
  var day = date.getDay();
  return day === 0 || day === 6;
}

// Steps by calendar day, skipping Sat/Sun, so Day view's Prev/Next always
// lands on a real work day.
export function addWorkdays(date, n) {
  var d = new Date(date);
  var step = n < 0 ? -1 : 1;
  var remaining = Math.abs(n);
  while (remaining > 0) {
    d.setDate(d.getDate() + step);
    if (!isWeekend(d)) remaining--;
  }
  return d;
}

// Sat -> following Monday, Sun -> following Monday -- used when "Today" or
// a saved default lands Day view on a non-work day.
export function nearestWorkday(date) {
  var d = new Date(date);
  if (d.getDay() === 6) d.setDate(d.getDate() + 2);
  else if (d.getDay() === 0) d.setDate(d.getDate() + 1);
  return d;
}

export function sortDayBlocks(blocks) {
  return (blocks || []).slice().sort(function (a, b) {
    return (a.startTime || "").localeCompare(b.startTime || "");
  });
}
