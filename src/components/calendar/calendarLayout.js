// calendarLayout.js -- shared time-grid math for WeekView/DayColumn/EventCard.
// The grid is described by one `grid` object ({startMin, endMin, hourHeight,
// height, hours}) built by buildTimeGrid() and threaded through the view, so
// the hour gridlines, the gutter labels and the event cards can never
// disagree about where 10 AM is.
//
// The visible window defaults to 8 AM-6 PM (NB4HS office hours) but is
// widened to cover anything actually scheduled outside it -- the class time
// block is configurable (Calendar Settings) and staff can enter any start
// time on a visit/appointment, so a fixed 8-6 window would silently clip
// events instead of showing them.
export var DEFAULT_START_MIN = 8 * 60;
export var DEFAULT_END_MIN = 18 * 60;
export var HOUR_HEIGHT = 64;
// Shared row heights for the day-header and All Day rows. The time gutter
// has to reserve exactly the same space as the day columns beside it, so
// both read these rather than each measuring itself.
export var HEADER_HEIGHT = 62;
export var ALLDAY_HEIGHT = 46;

export function toMinutes(timeStr) {
  if (!timeStr) return DEFAULT_START_MIN;
  var parts = String(timeStr).split(":");
  var h = parseInt(parts[0], 10);
  var m = parseInt(parts[1] || "0", 10);
  if (isNaN(h)) return DEFAULT_START_MIN;
  return h * 60 + (isNaN(m) ? 0 : m);
}

function blockEndMin(block) {
  var start = toMinutes(block.startTime);
  return block.endTime ? Math.max(toMinutes(block.endTime), start) : start + 60;
}

// dayBlocks is the array Calendar.jsx builds ({ date, dateStr, blocks }).
export function buildTimeGrid(dayBlocks, hourHeight) {
  var startMin = DEFAULT_START_MIN;
  var endMin = DEFAULT_END_MIN;
  (dayBlocks || []).forEach(function (day) {
    (day.blocks || []).forEach(function (b) {
      startMin = Math.min(startMin, Math.floor(toMinutes(b.startTime) / 60) * 60);
      endMin = Math.max(endMin, Math.ceil(blockEndMin(b) / 60) * 60);
    });
  });
  startMin = Math.max(0, startMin);
  endMin = Math.min(24 * 60, Math.max(endMin, startMin + 60));

  var hours = [];
  for (var h = startMin / 60; h < endMin / 60; h++) hours.push(h);
  var perHour = hourHeight || HOUR_HEIGHT;
  return {
    startMin: startMin,
    endMin: endMin,
    hourHeight: perHour,
    height: ((endMin - startMin) / 60) * perHour,
    hours: hours
  };
}

export function blockTop(grid, startTime) {
  return ((toMinutes(startTime) - grid.startMin) / 60) * grid.hourHeight;
}

export function blockHeight(grid, startTime, endTime) {
  var start = toMinutes(startTime);
  var end = endTime ? toMinutes(endTime) : start + 60;
  return Math.max(((end - start) / 60) * grid.hourHeight, 26);
}

// Fraction (0-1) of the grid a given minute-of-day sits at, or null when
// it falls outside the visible window -- used for the current-time line.
export function minuteOffset(grid, minutes) {
  if (minutes < grid.startMin || minutes > grid.endMin) return null;
  return ((minutes - grid.startMin) / 60) * grid.hourHeight;
}

export function fmtHour(hour) {
  var h = hour % 12 === 0 ? 12 : hour % 12;
  return h + (hour < 12 || hour === 24 ? " AM" : " PM");
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
    return blockEndMin(a) - blockEndMin(b);
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
    var end = blockEndMin(block);
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

// "09:30"/"12:30" (the HH:mm strings both calendar_events and the class
// time-block setting store) -> "9:30 AM – 12:30 PM". The leading meridiem is
// dropped when both ends share one, the way calendar apps print a range.
export function fmtTime(timeStr) {
  var mins = toMinutes(timeStr);
  var h = Math.floor(mins / 60) % 24;
  var m = mins % 60;
  var h12 = h % 12 === 0 ? 12 : h % 12;
  return h12 + ":" + String(m).padStart(2, "0") + (h < 12 ? " AM" : " PM");
}

export function fmtTimeRange(startTime, endTime) {
  if (!endTime) return fmtTime(startTime);
  var start = fmtTime(startTime);
  var end = fmtTime(endTime);
  if (start.slice(-2) === end.slice(-2)) start = start.slice(0, -3);
  return start + " – " + end;
}
