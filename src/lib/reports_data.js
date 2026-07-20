// reports_data.js -- stats computation, now including the Reports page's
// pieces (computeDailyTrend, reportRows, exportCSV, exportExcel). Pure
// functions: take `visits`/`lang`/etc. as parameters instead of reading a
// global App.state.
import { STUDENT_VISIT_HOURS } from "./constants.js";
import { serviceDisplay } from "./students.js";
import {
  csvEscape, dateStrFromDate, downloadBlob, escapeHtml, fmtTime, fullStaffList,
  labelFor, minutesBetween, todayStr
} from "./utils.js";

export function inRange(visit, fromStr, toStr) {
  return visit.date >= fromStr && visit.date <= toStr;
}

export function rangeForPreset(preset, customFrom, customTo) {
  var now = new Date();
  var today = todayStr();
  if (preset === "today") return { from: today, to: today };
  if (preset === "week") {
    var day = now.getDay();
    var diffToMon = (day === 0 ? 6 : day - 1);
    var monday = new Date(now); monday.setDate(now.getDate() - diffToMon);
    return { from: dateStrFromDate(monday), to: today };
  }
  if (preset === "month") {
    var first = new Date(now.getFullYear(), now.getMonth(), 1);
    return { from: dateStrFromDate(first), to: today };
  }
  if (preset === "quarter") {
    var q = Math.floor(now.getMonth() / 3);
    var qFirst = new Date(now.getFullYear(), q * 3, 1);
    return { from: dateStrFromDate(qFirst), to: today };
  }
  if (preset === "year") {
    var yFirst = new Date(now.getFullYear(), 0, 1);
    return { from: dateStrFromDate(yFirst), to: today };
  }
  return { from: customFrom || today, to: customTo || today };
}

export function isFirstVisit(visit, allVisits) {
  var earlier = allVisits.filter(function (v) {
    return v.phone === visit.phone && (v.date < visit.date || (v.date === visit.date && v.timeIn < visit.timeIn));
  });
  return earlier.length === 0;
}

export function computeStats(visits, range) {
  var all = visits || [];
  var inRangeVisits = all.filter(function (v) { return inRange(v, range.from, range.to); });
  var today = todayStr();
  var todayVisits = all.filter(function (v) { return v.date === today; });
  var currentlyIn = all.filter(function (v) { return !v.timeOut; });
  var checkedOutToday = todayVisits.filter(function (v) { return v.timeOut; });
  var withDuration = inRangeVisits.filter(function (v) { return v.timeOut; }).map(function (v) { return minutesBetween(v.timeIn, v.timeOut); });
  var avgLen = withDuration.length ? withDuration.reduce(function (a, b) { return a + b; }, 0) / withDuration.length : 0;

  var wr = rangeForPreset("week"), mr = rangeForPreset("month"), yr = rangeForPreset("year");
  var totalToday = todayVisits.length;
  var totalWeek = all.filter(function (v) { return inRange(v, wr.from, wr.to); }).length;
  var totalMonth = all.filter(function (v) { return inRange(v, mr.from, mr.to); }).length;
  var totalYear = all.filter(function (v) { return inRange(v, yr.from, yr.to); }).length;

  // Instructional hours for NRS/grant reporting: every student check-in
  // (visit.studentId set) counts as a flat STUDENT_VISIT_HOURS (4) hours,
  // regardless of actual Time In/Time Out -- those real timestamps are still
  // recorded and shown everywhere else unchanged. Visitor/Case Management/
  // Job Developer visits (no studentId) never count toward this total.
  var isStudentVisit = function (v) { return !!v.studentId; };
  var studentHours = inRangeVisits.filter(isStudentVisit).length * STUDENT_VISIT_HOURS;
  var studentHoursToday = todayVisits.filter(isStudentVisit).length * STUDENT_VISIT_HOURS;
  var studentHoursWeek = all.filter(function (v) { return isStudentVisit(v) && inRange(v, wr.from, wr.to); }).length * STUDENT_VISIT_HOURS;
  var studentHoursMonth = all.filter(function (v) { return isStudentVisit(v) && inRange(v, mr.from, mr.to); }).length * STUDENT_VISIT_HOURS;
  var studentHoursYear = all.filter(function (v) { return isStudentVisit(v) && inRange(v, yr.from, yr.to); }).length * STUDENT_VISIT_HOURS;

  var svcCounts = {};
  inRangeVisits.forEach(function (v) { svcCounts[v.service] = (svcCounts[v.service] || 0) + 1; });
  var svcSorted = Object.keys(svcCounts).map(function (k) { return { key: k, count: svcCounts[k] }; }).sort(function (a, b) { return b.count - a.count; });

  var dayCounts = [0, 0, 0, 0, 0, 0, 0];
  inRangeVisits.forEach(function (v) { var wd = new Date(v.date + "T00:00:00").getDay(); dayCounts[wd]++; });

  var hourCounts = {};
  inRangeVisits.forEach(function (v) { var h = new Date(v.timeIn).getHours(); hourCounts[h] = (hourCounts[h] || 0) + 1; });
  var hourSorted = Object.keys(hourCounts).map(function (k) { return { hour: parseInt(k, 10), count: hourCounts[k] }; }).sort(function (a, b) { return b.count - a.count; });

  var staffCounts = {};
  inRangeVisits.forEach(function (v) { staffCounts[v.staff] = (staffCounts[v.staff] || 0) + 1; });
  var staffSorted = Object.keys(staffCounts).map(function (k) { return { key: k, count: staffCounts[k] }; }).sort(function (a, b) { return b.count - a.count; });

  var newCount = 0, returningCount = 0;
  inRangeVisits.forEach(function (v) { if (isFirstVisit(v, all)) newCount++; else returningCount++; });

  return {
    inRangeVisits: inRangeVisits,
    todayVisits: todayVisits,
    currentlyIn: currentlyIn,
    checkedOutToday: checkedOutToday,
    avgLen: avgLen,
    totalToday: totalToday, totalWeek: totalWeek, totalMonth: totalMonth, totalYear: totalYear,
    studentHours: studentHours,
    studentHoursToday: studentHoursToday, studentHoursWeek: studentHoursWeek, studentHoursMonth: studentHoursMonth, studentHoursYear: studentHoursYear,
    svcSorted: svcSorted, dayCounts: dayCounts, hourSorted: hourSorted, staffSorted: staffSorted,
    newCount: newCount, returningCount: returningCount
  };
}

// Visitor check-ins carry city/zip directly on the visit record; student
// check-ins leave those blank (city/zip live on the student's own record
// instead -- see students.js's buildStudent()). These two helpers resolve
// "where did this visit come from" across both cases so the Reports page
// can report location for every visit, not just walk-in visitors.
export function visitCity(v, studentsById) {
  if (v.city && v.city.trim()) return v.city.trim();
  var student = v.studentId && studentsById ? studentsById[v.studentId] : null;
  return student && student.city ? student.city.trim() : "";
}
export function visitZip(v, studentsById) {
  if (v.zip && v.zip.trim()) return v.zip.trim();
  var student = v.studentId && studentsById ? studentsById[v.studentId] : null;
  return student && student.zip ? student.zip.trim() : "";
}
function titleCase(s) {
  return s.replace(/\w\S*/g, function (w) { return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase(); });
}

// Visits-by-city / visits-by-ZIP breakdown for the Reports page. Grouped
// case-insensitively by city (so "Providence"/"providence" count together)
// but displayed with a clean title-cased label; visits with no city/zip on
// either the visit or the linked student fall into a null-label "unknown"
// bucket instead of being silently dropped, so the counts still add up to
// the total number of in-range visits.
export function computeGeoBreakdown(visits, students, range) {
  var studentsById = {};
  (students || []).forEach(function (s) { studentsById[s.id] = s; });
  var inRangeVisits = (visits || []).filter(function (v) { return inRange(v, range.from, range.to); });

  var cityCounts = {}, cityLabels = {}, zipCounts = {};
  inRangeVisits.forEach(function (v) {
    var city = visitCity(v, studentsById);
    var cityKey = city ? city.toLowerCase() : "__unknown";
    cityCounts[cityKey] = (cityCounts[cityKey] || 0) + 1;
    if (city) cityLabels[cityKey] = titleCase(city);

    var zip = visitZip(v, studentsById);
    var zipKey = zip || "__unknown";
    zipCounts[zipKey] = (zipCounts[zipKey] || 0) + 1;
  });

  var citySorted = Object.keys(cityCounts).map(function (k) {
    return { key: k, label: k === "__unknown" ? null : cityLabels[k], count: cityCounts[k] };
  }).sort(function (a, b) { return b.count - a.count; });

  var zipSorted = Object.keys(zipCounts).map(function (k) {
    return { key: k, label: k === "__unknown" ? null : k, count: zipCounts[k] };
  }).sort(function (a, b) { return b.count - a.count; });

  return { citySorted: citySorted, zipSorted: zipSorted };
}

export function fmtHour(h) {
  var ampm = h >= 12 ? "PM" : "AM";
  var h12 = h % 12; if (h12 === 0) h12 = 12;
  return h12 + ":00 " + ampm;
}

// Immediately-preceding period of the same length as `range`, used to
// compute the KPI cards' "vs previous period" trend badges (e.g. a 7-day
// range compares against the 7 days before it).
export function previousRange(range) {
  var from = new Date(range.from + "T00:00:00"), to = new Date(range.to + "T00:00:00");
  var days = Math.round((to - from) / 86400000) + 1;
  var prevTo = new Date(from); prevTo.setDate(prevTo.getDate() - 1);
  var prevFrom = new Date(prevTo); prevFrom.setDate(prevFrom.getDate() - (days - 1));
  return { from: dateStrFromDate(prevFrom), to: dateStrFromDate(prevTo) };
}

// Percent change from `prev` to `cur`, with the "brand-new activity"/"no
// change" edge cases the raw formula can't express (division by zero).
export function trendPct(cur, prev) {
  if (prev === 0) return cur === 0 ? { pct: 0, none: true } : { pct: 100, none: false };
  return { pct: Math.round(((cur - prev) / prev) * 100), none: false };
}

// The single calendar date (within `range`) with the most visits, plus its
// count -- for the Reports page's "Most Active Day" card. Ties keep the
// earliest date. Returns null for an empty range.
export function computeMostActiveDay(visits, range) {
  var trend = computeDailyTrend(visits, range);
  var bestIdx = -1, bestCount = -1;
  trend.data.forEach(function (c, i) { if (c > bestCount) { bestCount = c; bestIdx = i; } });
  if (bestIdx === -1 || bestCount <= 0) return null;
  var d = new Date(range.from + "T00:00:00");
  d.setDate(d.getDate() + bestIdx);
  return { date: dateStrFromDate(d), count: bestCount };
}

export function computeDailyTrend(visits, range) {
  var counts = {};
  (visits || []).forEach(function (v) { if (inRange(v, range.from, range.to)) counts[v.date] = (counts[v.date] || 0) + 1; });
  var labels = [], data = [];
  var from = new Date(range.from + "T00:00:00"), to = new Date(range.to + "T00:00:00");
  var maxDays = 92; // safety cap so a huge custom range can't hang the browser
  var d = new Date(from);
  var n = 0;
  while (d <= to && n < maxDays) {
    var key = dateStrFromDate(d);
    labels.push((d.getMonth() + 1) + "/" + d.getDate());
    data.push(counts[key] || 0);
    d.setDate(d.getDate() + 1);
    n++;
  }
  return { labels: labels, data: data };
}

// Same day-by-day bucketing as computeDailyTrend, but sums a numeric value
// per item instead of just counting occurrences -- used for food
// distribution volume, where `quantity` is free text ("2 boxes", "15 lbs")
// rather than a clean number.
export function computeDailyValueTrend(items, range, valueFn) {
  var sums = {};
  (items || []).forEach(function (item) {
    if (!inRange(item, range.from, range.to)) return;
    sums[item.date] = (sums[item.date] || 0) + valueFn(item);
  });
  var labels = [], data = [];
  var from = new Date(range.from + "T00:00:00"), to = new Date(range.to + "T00:00:00");
  var maxDays = 92;
  var d = new Date(from);
  var n = 0;
  while (d <= to && n < maxDays) {
    var key = dateStrFromDate(d);
    labels.push((d.getMonth() + 1) + "/" + d.getDate());
    data.push(sums[key] || 0);
    d.setDate(d.getDate() + 1);
    n++;
  }
  return { labels: labels, data: data };
}

// Best-effort numeric read of a free-text quantity field ("2 boxes" -> 2,
// "15 lbs" -> 15, "" / non-numeric -> 0). Not exact, but the only signal
// available without a schema change to a real numeric column.
export function parseQuantity(quantity) {
  var m = String(quantity || "").match(/[\d.]+/);
  return m ? parseFloat(m[0]) || 0 : 0;
}

// Job placement outcomes for the Reports page. `jobClients`' pipelineStage
// is a current snapshot (no history), so the funnel breakdown is always
// "as of now" regardless of the selected date range -- only the
// applications-based figures (submitted/hired counts, daily trend) are
// actually range-filtered, keyed off `appliedDate` since job_applications
// has no separate "decided" date.
export function computeJobOutcomes(jobClients, applications, range) {
  var pipelineCounts = {};
  (jobClients || []).forEach(function (c) {
    if (c.active === false) return;
    var stage = c.pipelineStage || "resume";
    pipelineCounts[stage] = (pipelineCounts[stage] || 0) + 1;
  });

  var dated = (applications || []).map(function (a) { return Object.assign({}, a, { date: a.appliedDate }); }).filter(function (a) { return a.date; });
  var inRangeApps = dated.filter(function (a) { return inRange(a, range.from, range.to); });
  var statusCounts = {};
  inRangeApps.forEach(function (a) { statusCounts[a.status] = (statusCounts[a.status] || 0) + 1; });
  var placementsInRange = inRangeApps.filter(function (a) { return a.status === "hired"; }).length;
  var applicationsTrend = computeDailyTrend(dated, range);

  return {
    pipelineCounts: pipelineCounts,
    statusCounts: statusCounts,
    applicationsInRange: inRangeApps.length,
    placementsInRange: placementsInRange,
    applicationsTrend: applicationsTrend
  };
}

export function reportRows(visits, range, customServices, customStaff, lang) {
  var list = (visits || []).filter(function (v) { return inRange(v, range.from, range.to); });
  list = list.slice().sort(function (a, b) { return new Date(a.timeIn) - new Date(b.timeIn); });
  var header = ["Date", "First Name", "Last Name", "Phone", "Email", "Address", "City", "State", "ZIP", "Service", "Staff", "Time In", "Time Out", "Duration (min)"];
  var staffList = fullStaffList(customStaff);
  var rows = list.map(function (v) {
    return [
      v.date, v.firstName, v.lastName, v.phone, v.email, v.address, v.city, v.state, v.zip,
      serviceDisplay(v, customServices, lang),
      labelFor(staffList, v.staff, lang) + (v.staff === "other" && v.staffOther ? (": " + v.staffOther) : ""),
      fmtTime(v.timeIn), fmtTime(v.timeOut),
      v.timeOut ? Math.round(minutesBetween(v.timeIn, v.timeOut)) : ""
    ];
  });
  // Flat NRS instructional-hours total for the same range (student check-ins
  // only) -- exported as a summary line above the table, not a per-row value,
  // since it's an aggregate credit rather than a real per-visit duration.
  var studentHours = list.filter(function (v) { return !!v.studentId; }).length * STUDENT_VISIT_HOURS;
  return { header: header, rows: rows, studentHours: studentHours };
}

export function exportCSV(visits, range, customServices, customStaff, lang) {
  var data = reportRows(visits, range, customServices, customStaff, lang);
  var summaryLine = "Total Student Instructional Hours (" + STUDENT_VISIT_HOURS + " hrs/visit)," + data.studentHours;
  var lines = [summaryLine, ""].concat([data.header.map(csvEscape).join(",")]).concat(data.rows.map(function (r) { return r.map(csvEscape).join(","); }));
  downloadBlob(lines.join("\r\n"), "nb4hs-visits-" + todayStr() + ".csv", "text/csv;charset=utf-8;");
}

export function exportExcel(visits, range, customServices, customStaff, lang) {
  var data = reportRows(visits, range, customServices, customStaff, lang);
  var summary = "<p><strong>Total Student Instructional Hours (" + STUDENT_VISIT_HOURS + " hrs/visit):</strong> " + data.studentHours + "</p>";
  var html = summary + "<table><thead><tr>" + data.header.map(function (h) { return "<th>" + escapeHtml(h) + "</th>"; }).join("") + "</tr></thead><tbody>" +
    data.rows.map(function (r) { return "<tr>" + r.map(function (c) { return "<td>" + escapeHtml(c) + "</td>"; }).join("") + "</tr>"; }).join("") +
    "</tbody></table>";
  var full = "<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:x='urn:schemas-microsoft-com:office:excel' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'></head><body>" + html + "</body></html>";
  downloadBlob(full, "nb4hs-visits-" + todayStr() + ".xls", "application/vnd.ms-excel");
}
