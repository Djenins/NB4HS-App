// holidays.js -- US federal holidays, computed per year so the calendar
// always shows the right dates without a maintained lookup table. Rendered
// as an all-day banner (not a timed block) since holidays don't have a
// start/end time the way classes/visits/appointments do.
function nthWeekdayOfMonth(year, month, weekday, n) {
  var d = new Date(year, month, 1);
  var offset = (weekday - d.getDay() + 7) % 7;
  d.setDate(1 + offset + (n - 1) * 7);
  return d;
}

function lastWeekdayOfMonth(year, month, weekday) {
  var d = new Date(year, month + 1, 0);
  var offset = (d.getDay() - weekday + 7) % 7;
  d.setDate(d.getDate() - offset);
  return d;
}

function iso(d) {
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

export function holidaysForYear(year) {
  return [
    { date: iso(new Date(year, 0, 1)), name: "New Year's Day" },
    { date: iso(nthWeekdayOfMonth(year, 0, 1, 3)), name: "Martin Luther King Jr. Day" },
    { date: iso(nthWeekdayOfMonth(year, 1, 1, 3)), name: "Presidents' Day" },
    { date: iso(lastWeekdayOfMonth(year, 4, 1)), name: "Memorial Day" },
    { date: iso(new Date(year, 5, 19)), name: "Juneteenth" },
    { date: iso(new Date(year, 6, 4)), name: "Independence Day" },
    { date: iso(nthWeekdayOfMonth(year, 8, 1, 1)), name: "Labor Day" },
    { date: iso(nthWeekdayOfMonth(year, 9, 1, 2)), name: "Indigenous Peoples' Day" },
    { date: iso(new Date(year, 10, 11)), name: "Veterans Day" },
    { date: iso(nthWeekdayOfMonth(year, 10, 4, 4)), name: "Thanksgiving Day" },
    { date: iso(new Date(year, 11, 25)), name: "Christmas Day" }
  ];
}

export function holidaysByDate(years) {
  var map = {};
  years.forEach(function (year) {
    holidaysForYear(year).forEach(function (h) { map[h.date] = h; });
  });
  return map;
}
