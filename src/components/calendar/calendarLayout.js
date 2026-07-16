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

// Side-by-side column assignment for same-day blocks that overlap in time
// (e.g. Level 1 & Level 2 both meet 09:30-12:30) -- without this, later
// blocks silently render on top of earlier ones at the same position.
// Classic calendar-grid sweep: walk blocks sorted by start time, reuse a
// column slot once its previous occupant has ended, and give every block in
// a connected overlap cluster the same `cols` count so they render as equal-
// width side-by-side slices instead of full width.
export function layoutOverlaps(blocks) {
  var sorted = blocks.slice().sort(function (a, b) {
    var byStart = toMinutes(a.startTime) - toMinutes(b.startTime);
    if (byStart !== 0) return byStart;
    return toMinutes(a.endTime || a.startTime) - toMinutes(b.endTime || b.startTime);
  });

  var result = [];
  var cluster = [];
  var columnEnds = [];
  var clusterEnd = -Infinity;

  function flush() {
    var cols = columnEnds.length;
    cluster.forEach(function (item) {
      result.push(Object.assign({}, item.block, { layout: { col: item.col, cols: cols } }));
    });
    cluster = [];
    columnEnds = [];
    clusterEnd = -Infinity;
  }

  sorted.forEach(function (block) {
    var start = toMinutes(block.startTime);
    var end = block.endTime ? toMinutes(block.endTime) : start + 60;
    if (cluster.length && start >= clusterEnd) flush();

    var col = columnEnds.findIndex(function (endMin) { return endMin <= start; });
    if (col === -1) { col = columnEnds.length; columnEnds.push(end); }
    else columnEnds[col] = end;

    cluster.push({ block: block, col: col });
    clusterEnd = Math.max(clusterEnd, end);
  });
  flush();

  return result;
}
