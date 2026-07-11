// clients.js -- shared logic for both Case Management and Job Developer
// clients, ported from the buildless app's already-deduplicated clients.js
// (see that file's own header comment for the full rationale: these were
// originally two hand-copied implementations that had begun to drift). Kept
// parameterized by `kind` ("case" | "job") here too. Functions that used to
// mutate App.data and call save() (addClient, importCaseClientRows) now
// return the new data instead; the page applies it via setData.
import { CASE_SERVICES, IMMIGRATION_STATUSES } from "./constants.js";
import { inRange } from "./reports_data.js";
import { csvEscape, downloadBlob, escapeHtml, normalizeDateCell, todayStr, uid } from "./utils.js";

export var CLIENT_KIND = {
  case: {
    dataKey: "caseClients",
    emptyIcon: "users",
    emptyMessageKey: "noClientsYet",
    removeConfirmKey: "removeClientConfirm"
  },
  job: {
    dataKey: "jobClients",
    emptyIcon: "jobdeveloper",
    emptyMessageKey: "noJobClientsYet",
    removeConfirmKey: "removeJobClientConfirm"
  },
  food: {
    dataKey: "foodClients",
    emptyIcon: "fooddistribution",
    emptyMessageKey: "noFoodClientsYet",
    removeConfirmKey: "removeFoodClientConfirm"
  }
};

export function clientDisplayName(c) { return (c.firstName || "") + " " + (c.lastName || ""); }

export function clientMatchesSearch(kind, c, term, lang) {
  if (!term) return true;
  var hay = (c.firstName || "") + " " + (c.lastName || "") + " " + (c.phone || "") + " " + (c.email || "");
  if (kind === "case") {
    hay += " " + (c.immigrationStatus || "") + " " + immigrationStatusLabel(c.immigrationStatus, lang);
  }
  return hay.toLowerCase().indexOf(term) !== -1;
}

export function caseServiceLabel(key, lang) {
  var found = CASE_SERVICES.filter(function (s) { return s.key === key; })[0];
  if (!found) return key;
  return found[lang] || found.en;
}
export function immigrationStatusLabel(key, lang) {
  var found = IMMIGRATION_STATUSES.filter(function (s) { return s.key === key; })[0];
  if (!found) return key || "";
  return found[lang] || found.en;
}

// Pure version of addClient(): returns the new client record (or null if
// required fields are missing) instead of pushing it onto App.data and
// calling save() itself.
export function buildClient(kind, fields, extra) {
  extra = extra || {};
  var firstName = (fields.firstName || "").trim();
  var lastName = (fields.lastName || "").trim();
  if (!firstName || !lastName) return null;
  var client = {
    id: uid(),
    firstName: firstName,
    lastName: lastName,
    phone: (fields.phone || "").trim(),
    email: (fields.email || "").trim(),
    intakeDate: fields.intakeDate || "",
    street: (fields.street || "").trim(),
    city: (fields.city || "").trim(),
    zip: (fields.zip || "").trim(),
    state: "RI"
  };
  if (kind === "case") {
    Object.assign(client, {
      immigrationStatus: (fields.immigrationStatus || "").trim(),
      dob: fields.dob || "",
      services: extra.services || [],
      notes: []
    });
  } else if (kind === "job") {
    Object.assign(client, {
      workPermit: !!fields.workPermit,
      workPermitExpiration: fields.workPermit ? (fields.workPermitExpiration || "") : "",
      hasResume: !!fields.hasResume,
      resumeDataUri: fields.hasResume ? (extra.resumeDataUri || "") : "",
      resumeFileName: fields.hasResume ? (extra.resumeFileName || "") : ""
    });
  } else if (kind === "food") {
    Object.assign(client, {
      householdSize: (fields.householdSize || "").toString().trim(),
      distributions: []
    });
  }
  return client;
}

// Most recent distribution date for a food household, or "" if none logged
// yet -- used for the client-list table's "Last Distribution" column.
export function lastDistributionDate(client) {
  var list = (client && client.distributions) || [];
  if (!list.length) return "";
  return list.slice().sort(function (a, b) { return (b.date || "").localeCompare(a.date || ""); })[0].date || "";
}

// Flattens every household's distribution log into one array (each entry
// tagged with its household id) so Dashboard/Reports can reuse the existing
// visit-stats helpers in reports_data.js (inRange, computeDailyTrend) as-is
// instead of duplicating range/trend logic for this second data shape --
// both just need objects with a `.date` string.
export function allDistributions(foodClients) {
  var out = [];
  (foodClients || []).forEach(function (c) {
    (c.distributions || []).forEach(function (d) {
      out.push(Object.assign({}, d, { clientId: c.id }));
    });
  });
  return out;
}

export function caseClientCsvTemplateContent() {
  return "First Name,Last Name,Email,Street Address,City,ZIP Code,Immigration Status,Intake Date (YYYY-MM-DD),Date of Birth (YYYY-MM-DD),Services (semicolon-separated)\r\n";
}
export function downloadCaseClientTemplate() {
  if (typeof XLSX !== "undefined") {
    try {
      var header = ["First Name", "Last Name", "Email", "Street Address", "City", "ZIP Code", "Immigration Status", "Intake Date (YYYY-MM-DD)", "Date of Birth (YYYY-MM-DD)", "Services (semicolon-separated)"];
      var ws = XLSX.utils.aoa_to_sheet([header]);
      var wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Clients");
      XLSX.writeFile(wb, "NB4HS-Case-Clients-Template.xlsx");
      return;
    } catch (e) { /* fall through to CSV */ }
  }
  downloadBlob(caseClientCsvTemplateContent(), "NB4HS-Case-Clients-Template.csv", "text/csv;charset=utf-8;");
}

// Pure version of importCaseClientRows(): returns the case clients to
// append plus how many rows had an immigration-status/services value that
// didn't match a known option (still imported, just without that field set).
export function buildImportedCaseClients(rows) {
  if (!rows || rows.length < 2) return null;
  var added = [];
  var unmatchedStatus = 0, unmatchedSvc = 0;
  for (var i = 1; i < rows.length; i++) {
    var r = rows[i];
    if (!r || !r.length) continue;
    var firstName = (r[0] || "").toString().trim();
    var lastName = (r[1] || "").toString().trim();
    var email = (r[2] || "").toString().trim();
    var street = (r[3] || "").toString().trim();
    var city = (r[4] || "").toString().trim();
    var zip = (r[5] || "").toString().trim();
    var statusText = (r[6] || "").toString().trim();
    var intakeDate = normalizeDateCell(r[7]);
    var dob = normalizeDateCell(r[8]);
    var servicesText = (r[9] || "").toString().trim();
    if (!firstName && !lastName) continue;
    var matchedStatus = IMMIGRATION_STATUSES.filter(function (s) { return s.en.toLowerCase() === statusText.toLowerCase() || s.key === statusText.toLowerCase(); })[0];
    if (statusText && !matchedStatus) unmatchedStatus++;
    var serviceKeys = [];
    if (servicesText) {
      servicesText.split(/[;,]/).map(function (s) { return s.trim(); }).filter(function (s) { return s; }).forEach(function (label) {
        var match = CASE_SERVICES.filter(function (s) { return s.en.toLowerCase() === label.toLowerCase() || s.key === label.toLowerCase(); })[0];
        if (match) serviceKeys.push(match.key); else unmatchedSvc++;
      });
    }
    added.push({
      id: uid(), firstName: firstName, lastName: lastName, email: email,
      immigrationStatus: matchedStatus ? matchedStatus.key : "",
      intakeDate: intakeDate, dob: dob, street: street, city: city, zip: zip, state: "RI",
      services: serviceKeys, notes: []
    });
  }
  return { added: added, unmatchedStatus: unmatchedStatus, unmatchedSvc: unmatchedSvc };
}

// -- Food Distribution: bulk import (new households only -- past pickups
// are still logged one at a time in-app, per the client's answer) and the
// two exports (household roster, and a flat distribution log) they asked
// for. Kept in this file alongside the rest of the "food" CLIENT_KIND logic
// rather than a new file.
export function foodClientCsvTemplateContent() {
  return "First Name,Last Name,Phone,Email,Street Address,City,ZIP Code,Household Size,Intake Date (YYYY-MM-DD)\r\n";
}
export function downloadFoodClientTemplate() {
  if (typeof XLSX !== "undefined") {
    try {
      var header = ["First Name", "Last Name", "Phone", "Email", "Street Address", "City", "ZIP Code", "Household Size", "Intake Date (YYYY-MM-DD)"];
      var ws = XLSX.utils.aoa_to_sheet([header]);
      var wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Households");
      XLSX.writeFile(wb, "NB4HS-Food-Households-Template.xlsx");
      return;
    } catch (e) { /* fall through to CSV */ }
  }
  downloadBlob(foodClientCsvTemplateContent(), "NB4HS-Food-Households-Template.csv", "text/csv;charset=utf-8;");
}

// Pure version of an import handler: returns the food households to append.
// No dedupe against existing households (same as buildImportedCaseClients) --
// re-importing the same name twice just adds a second household record,
// which staff can merge/delete manually if it happens.
export function buildImportedFoodClients(rows) {
  if (!rows || rows.length < 2) return null;
  var added = [];
  for (var i = 1; i < rows.length; i++) {
    var r = rows[i];
    if (!r || !r.length) continue;
    var firstName = (r[0] || "").toString().trim();
    var lastName = (r[1] || "").toString().trim();
    var phone = (r[2] || "").toString().trim();
    var email = (r[3] || "").toString().trim();
    var street = (r[4] || "").toString().trim();
    var city = (r[5] || "").toString().trim();
    var zip = (r[6] || "").toString().trim();
    var householdSize = (r[7] || "").toString().trim();
    var intakeDate = normalizeDateCell(r[8]);
    if (!firstName && !lastName) continue;
    added.push({
      id: uid(), firstName: firstName, lastName: lastName, phone: phone, email: email,
      street: street, city: city, zip: zip, state: "RI",
      householdSize: householdSize, intakeDate: intakeDate, distributions: []
    });
  }
  return { added: added };
}

// Household roster export -- a snapshot of every household on file today,
// not scoped to a date range (unlike the distribution log below).
export function foodRosterReportRows(foodClients) {
  var list = (foodClients || []).slice().sort(function (a, b) { return clientDisplayName(a).toLowerCase().localeCompare(clientDisplayName(b).toLowerCase()); });
  var header = ["First Name", "Last Name", "Phone", "Email", "Street", "City", "State", "ZIP", "Household Size", "Intake Date", "Last Distribution Date"];
  var rows = list.map(function (c) {
    return [c.firstName, c.lastName, c.phone, c.email, c.street, c.city, c.state, c.zip, c.householdSize, c.intakeDate, lastDistributionDate(c)];
  });
  return { header: header, rows: rows };
}
export function exportFoodRosterCSV(foodClients) {
  var data = foodRosterReportRows(foodClients);
  var lines = [data.header.map(csvEscape).join(",")].concat(data.rows.map(function (r) { return r.map(csvEscape).join(","); }));
  downloadBlob(lines.join("\r\n"), "nb4hs-food-households-" + todayStr() + ".csv", "text/csv;charset=utf-8;");
}
export function exportFoodRosterExcel(foodClients) {
  var data = foodRosterReportRows(foodClients);
  var html = "<table><thead><tr>" + data.header.map(function (h) { return "<th>" + escapeHtml(h) + "</th>"; }).join("") + "</tr></thead><tbody>" +
    data.rows.map(function (r) { return "<tr>" + r.map(function (c) { return "<td>" + escapeHtml(c) + "</td>"; }).join("") + "</tr>"; }).join("") +
    "</tbody></table>";
  var full = "<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:x='urn:schemas-microsoft-com:office:excel' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'></head><body>" + html + "</body></html>";
  downloadBlob(full, "nb4hs-food-households-" + todayStr() + ".xls", "application/vnd.ms-excel");
}

// Distribution-log export -- one row per pickup across every household,
// filtered to the given date range (from Reports_data.js's rangeForPreset)
// -- for grant/USDA-style reporting on what was given out and when.
export function foodDistributionReportRows(foodClients, range) {
  var rows = [];
  (foodClients || []).forEach(function (c) {
    (c.distributions || []).forEach(function (d) {
      if (!inRange(d, range.from, range.to)) return;
      rows.push([clientDisplayName(c), c.phone, c.street, c.city, c.zip, c.householdSize, d.date, d.items, d.quantity]);
    });
  });
  rows.sort(function (a, b) { return (a[6] || "").localeCompare(b[6] || ""); });
  var header = ["Household", "Phone", "Street", "City", "ZIP", "Household Size", "Date", "Items Given", "Quantity"];
  return { header: header, rows: rows };
}
export function exportFoodDistributionCSV(foodClients, range) {
  var data = foodDistributionReportRows(foodClients, range);
  var lines = [data.header.map(csvEscape).join(",")].concat(data.rows.map(function (r) { return r.map(csvEscape).join(","); }));
  downloadBlob(lines.join("\r\n"), "nb4hs-food-distributions-" + todayStr() + ".csv", "text/csv;charset=utf-8;");
}
export function exportFoodDistributionExcel(foodClients, range) {
  var data = foodDistributionReportRows(foodClients, range);
  var html = "<table><thead><tr>" + data.header.map(function (h) { return "<th>" + escapeHtml(h) + "</th>"; }).join("") + "</tr></thead><tbody>" +
    data.rows.map(function (r) { return "<tr>" + r.map(function (c) { return "<td>" + escapeHtml(c) + "</td>"; }).join("") + "</tr>"; }).join("") +
    "</tbody></table>";
  var full = "<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:x='urn:schemas-microsoft-com:office:excel' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'></head><body>" + html + "</body></html>";
  downloadBlob(full, "nb4hs-food-distributions-" + todayStr() + ".xls", "application/vnd.ms-excel");
}
