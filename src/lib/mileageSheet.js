// mileageSheet.js -- the monthly mileage sheet staff sign and hand in for
// reimbursement: landscape US Letter, built with jsPDF's own text and lines
// (like foodSignInForm.js) so it prints sharp. One row per trip; the last
// page carries the totals, the rate, the amount and the signature lines.
// With no trips (or `blank`), it prints empty rows to fill in by hand.
// Staff-only paper, so English only.
import { ORG } from "./constants.js";
import { fmtMiles, fmtMoney, monthLabel, reimbursement, totalMiles, tripDateLabel, tripMiles } from "./mileage.js";

const INK = [17, 24, 39];
const MUTED = [100, 110, 125];
const RULE = [150, 158, 170];
const HEADER_FILL = [236, 239, 243];
const MARGIN = 36;
const PAGE = { width: 792, height: 612 };
const ROW_H = 24;
const HEAD_ROW_H = 22;
const TABLE_TOP = 132;
const FOOTER = 30;
// Space the totals and signatures take at the foot of the last page.
const CLOSING_H = 150;

// Date | From | To | Purpose | Odometer start | Odometer end | Round trip | Miles
const COLS = [
  { key: "date", head: "Date", w: 70 },
  { key: "from", head: "From", w: 135 },
  { key: "to", head: "To", w: 135 },
  { key: "purpose", head: "Purpose / client or program", w: 0 },
  { key: "odoStart", head: "Odometer start", w: 62, align: "right" },
  { key: "odoEnd", head: "Odometer end", w: 62, align: "right" },
  { key: "rt", head: "Round trip", w: 44, align: "center" },
  { key: "miles", head: "Miles", w: 52, align: "right" }
];

function columns(tableW) {
  const fixed = COLS.reduce((sum, c) => sum + c.w, 0);
  return COLS.map((c) => Object.assign({}, c, { w: c.w || tableW - fixed }));
}

function fitText(doc, text, maxW) {
  let size = 9.5;
  doc.setFontSize(size);
  while (size > 7 && doc.getTextWidth(text) > maxW) { size -= 0.5; doc.setFontSize(size); }
  if (doc.getTextWidth(text) <= maxW) return text;
  let cut = text;
  while (cut.length > 1 && doc.getTextWidth(cut + "…") > maxW) cut = cut.slice(0, -1);
  return cut + "…";
}

function drawLogo(doc, logo, x, y, h) {
  if (!logo) return;
  try { doc.addImage(logo.dataUrl, "PNG", x, y, h * (logo.width / logo.height), h, "nb4hs-logo", "FAST"); } catch (e) { /* no logo */ }
}

// "Employee: ____" -- the value printed on the line, or the line left blank.
function labeledLine(doc, label, value, x, y, w) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...INK);
  doc.text(label + ":", x, y);
  const lx = x + doc.getTextWidth(label + ":") + 6;
  if (value) {
    doc.setFont("helvetica", "normal");
    doc.text(fitText(doc, value, x + w - lx - 2), lx, y);
    doc.setFontSize(10);
  }
  doc.setDrawColor(...RULE);
  doc.setLineWidth(0.6);
  doc.line(lx, y + 3, x + w, y + 3);
}

function drawHeader(doc, opts, left, right) {
  drawLogo(doc, opts.logo, left, MARGIN, 30);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  doc.text(ORG.name, right, MARGIN + 12, { align: "right" });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(...INK);
  doc.text("Monthly Mileage Log", (left + right) / 2, MARGIN + 34, { align: "center" });

  const y = MARGIN + 70;
  const third = (right - left - 40) / 3;
  labeledLine(doc, "Employee", opts.blank ? "" : opts.staffName, left, y, third);
  labeledLine(doc, "Month", opts.blank ? "" : monthLabel(opts.month), left + third + 20, y, third);
  labeledLine(doc, "Program / department", opts.blank ? "" : opts.department, left + 2 * (third + 20), y, third);
}

function drawTableHead(doc, cols, left, y) {
  const tableW = cols.reduce((s, c) => s + c.w, 0);
  doc.setFillColor(...HEADER_FILL);
  doc.rect(left, y, tableW, HEAD_ROW_H, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(...INK);
  let x = left;
  cols.forEach((c) => {
    const lines = doc.splitTextToSize(c.head, c.w - 8);
    const ty = y + (lines.length > 1 ? 9 : 14);
    const tx = c.align === "right" ? x + c.w - 4 : c.align === "center" ? x + c.w / 2 : x + 4;
    doc.text(lines, tx, ty, { align: c.align || "left" });
    x += c.w;
  });
  return y + HEAD_ROW_H;
}

function cellValues(trip) {
  return {
    date: tripDateLabel(trip.tripDate, true),
    from: trip.startLocation,
    to: trip.destination,
    purpose: trip.purpose,
    odoStart: trip.odometerStart === null ? "" : String(trip.odometerStart),
    odoEnd: trip.odometerEnd === null ? "" : String(trip.odometerEnd),
    rt: trip.roundTrip ? "Yes" : "",
    miles: fmtMiles(tripMiles(trip))
  };
}

function drawRow(doc, cols, left, y, trip) {
  const values = trip ? cellValues(trip) : null;
  doc.setDrawColor(...RULE);
  doc.setLineWidth(0.5);
  let x = left;
  cols.forEach((c, i) => {
    if (i > 0) doc.line(x, y, x, y + ROW_H);
    if (values && values[c.key]) {
      doc.setFont("helvetica", c.key === "miles" ? "bold" : "normal");
      doc.setTextColor(...INK);
      const text = fitText(doc, values[c.key], c.w - 8);
      const tx = c.align === "right" ? x + c.w - 4 : c.align === "center" ? x + c.w / 2 : x + 4;
      doc.text(text, tx, y + 15.5, { align: c.align || "left" });
    }
    x += c.w;
  });
  doc.line(left, y + ROW_H, x, y + ROW_H);
}

function drawClosing(doc, opts, left, right, y) {
  const miles = opts.blank ? null : totalMiles(opts.trips);
  const amount = miles === null ? null : reimbursement(miles, opts.rate);
  const boxW = 230;
  const bx = right - boxW;
  const lines = [
    ["Total miles", miles === null ? "" : fmtMiles(miles)],
    ["Rate per mile", opts.blank || opts.rate === null ? "" : fmtMoney(opts.rate)],
    ["Amount due", amount === null ? "" : fmtMoney(amount)]
  ];
  lines.forEach(([label, value], i) => {
    const ly = y + 14 + i * 22;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...INK);
    doc.text(label + ":", bx, ly);
    doc.setDrawColor(...RULE);
    doc.setLineWidth(0.6);
    doc.line(bx + 90, ly + 3, right, ly + 3);
    if (value) doc.text(value, right - 2, ly, { align: "right" });
  });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  const statement = "I certify that the miles above were driven in my personal vehicle on " + ORG.name +
    " business, are accurate, and have not been claimed elsewhere.";
  doc.text(doc.splitTextToSize(statement, bx - left - 30), left, y + 10);

  const sy = y + 92;
  const half = (right - left - 40) / 2;
  [["Employee signature", left], ["Supervisor approval", left + half + 40]].forEach(([label, x]) => {
    doc.setDrawColor(...RULE);
    doc.line(x, sy, x + half - 90, sy);
    doc.line(x + half - 75, sy, x + half, sy);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...MUTED);
    doc.text(label, x, sy + 11);
    doc.text("Date", x + half - 75, sy + 11);
  });
}

function drawFooter(doc, page, total) {
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text(ORG.name + " · Mileage log", MARGIN, PAGE.height - 18);
  doc.text("Page " + page + " of " + total, PAGE.width - MARGIN, PAGE.height - 18, { align: "right" });
}

// How many rows fit on a page, with or without the closing block below them.
const ROWS_FULL = Math.floor((PAGE.height - TABLE_TOP - HEAD_ROW_H - FOOTER - MARGIN / 2) / ROW_H);
const ROWS_LAST = Math.floor((PAGE.height - TABLE_TOP - HEAD_ROW_H - FOOTER - CLOSING_H) / ROW_H);

// Trips split into pages; the last page leaves room for the closing block.
export function paginate(count) {
  if (count <= ROWS_LAST) return [count];
  const pages = [];
  let left = count;
  // Full pages first, always leaving at least one trip for the last page.
  while (left > ROWS_LAST) {
    const take = Math.min(ROWS_FULL, left - 1);
    pages.push(take);
    left -= take;
  }
  pages.push(left);
  return pages;
}

// opts: { trips, month ("YYYY-MM"), staffName, department, rate (number|null),
//         logo: { dataUrl, width, height } | null, blank }
export function buildMileagePdf(JsPDF, opts) {
  const doc = new JsPDF({ unit: "pt", format: "letter", orientation: "landscape", compress: true });
  doc.setProperties({ title: "Mileage log" + (opts.blank ? "" : " - " + opts.staffName + " - " + monthLabel(opts.month)), author: ORG.name });
  const left = MARGIN, right = PAGE.width - MARGIN;
  const cols = columns(right - left);
  const trips = opts.blank ? [] : (opts.trips || []);
  // A blank sheet (or a month without trips) gets rows to fill in by hand.
  const rowsPerPage = trips.length ? paginate(trips.length) : [ROWS_LAST];
  let index = 0;
  rowsPerPage.forEach((rows, p) => {
    if (p > 0) doc.addPage("letter", "landscape");
    drawHeader(doc, opts, left, right);
    let y = drawTableHead(doc, cols, left, TABLE_TOP);
    doc.setDrawColor(...RULE);
    doc.setLineWidth(0.5);
    doc.line(left, TABLE_TOP, left, TABLE_TOP + HEAD_ROW_H + rows * ROW_H);
    doc.line(right, TABLE_TOP, right, TABLE_TOP + HEAD_ROW_H + rows * ROW_H);
    for (let r = 0; r < rows; r++) {
      drawRow(doc, cols, left, y, trips.length ? trips[index++] : null);
      y += ROW_H;
    }
    if (p === rowsPerPage.length - 1) drawClosing(doc, opts, left, right, y + 14);
    drawFooter(doc, p + 1, rowsPerPage.length);
  });
  return doc;
}

export function mileagePdfName(opts) {
  if (opts.blank) return "mileage-log-blank.pdf";
  const who = (opts.staffName || "staff").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return "mileage-log-" + who + "-" + opts.month + ".pdf";
}
