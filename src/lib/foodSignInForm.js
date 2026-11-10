// foodSignInForm.js -- the paper form clients fill in at a food
// distribution: name, address, phone and signature. Staff pick the occasion
// (Thanksgiving, Christmas, ... or their own wording), the form's language and
// a layout, and this builds a print-ready US Letter PDF with jsPDF's own text
// and lines (not a screenshot), so it prints sharp and stays small.
//
// Two layouts:
//  - "sheet":      landscape sign-in sheet, one row per household, numbered
//                  across pages.
//  - "individual": portrait, one full-page form per household.
//
// The paper is client-facing, so its wording is translated (en/ht/fr) and can
// be printed bilingual ("en+ht", "en+fr"). The staff controls around it are
// staff-only and stay English.
import { ORG } from "./constants.js";
import { t } from "./i18n.js";

export const FORM_LANGS = ["en", "ht", "fr", "en+ht", "en+fr"];
export const OCCASIONS = ["general", "thanksgiving", "christmas", "easter", "backToSchool", "monthly", "custom"];
// Food distribution programs; each has its own form. Regular asks the two
// SNAP questions; CDBG (CDBG-funded distributions) doesn't. The database
// check on food_signin_events.program lists the same keys.
export const FOOD_PROGRAMS = ["regular", "cdbg"];
export const PROGRAM_LABEL = { regular: "Regular", cdbg: "CDBG" };
export function programAsksSnap(program) {
  return (program || "regular") === "regular";
}

const OCCASION_KEY = {
  thanksgiving: "ffOccThanksgiving",
  christmas: "ffOccChristmas",
  easter: "ffOccEaster",
  backToSchool: "ffOccBackToSchool",
  monthly: "ffOccMonthly",
};

const HT_MONTHS = ["janvye", "fevriye", "mas", "avril", "me", "jen", "jiyè", "out", "septanm", "oktòb", "novanm", "desanm"];

export function langList(lang) {
  return FORM_LANGS.includes(lang) ? lang.split("+") : ["en"];
}

// The occasion's name in one language: a preset's translation, or what staff
// typed (used as-is in every language). Empty for the general form.
export function occasionName(occasion, custom, lang) {
  if (occasion === "custom") return (custom || "").trim();
  const key = OCCASION_KEY[occasion];
  return key ? t(key, lang) : "";
}

// "Thanksgiving Food Distribution Form" / "Fòm Distribisyon Manje pou ..." /
// "Formulaire de distribution alimentaire (...)".
export function formTitle(occasion, custom, lang) {
  const name = occasionName(occasion, custom, lang);
  if (!name) return t("ffTitleGeneral", lang);
  return t("ffTitleWithOccasion", lang).replace("{occasion}", name);
}

// One title line per language of the form; a CDBG form says so in its title.
export function formTitles(opts) {
  const suffix = opts.program === "cdbg" ? " – CDBG" : "";
  return langList(opts.lang).map((l) => formTitle(opts.occasion, opts.customOccasion, l) + suffix);
}

// A field label in every language of the form: "Name / Non". A word that's
// the same in both ("SNAP?") is printed once.
export function label(key, lang) {
  return langList(lang).map((l) => t(key, l)).filter((v, i, all) => all.indexOf(v) === i).join(" / ");
}

// YYYY-MM-DD -> a long date in the form's first language. Parsed as a local
// date so it never slips a day across time zones.
export function formatFormDate(iso, lang) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return "";
  const primary = langList(lang)[0];
  if (primary === "ht") return d + " " + HT_MONTHS[m - 1] + " " + y;
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString(primary === "fr" ? "fr-FR" : "en-US", { year: "numeric", month: "long", day: "numeric" });
}

export function pdfFileName(opts) {
  const base = (formTitle(opts.occasion, opts.customOccasion, "en") + (opts.program === "cdbg" ? " cdbg" : ""))
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return (base || "food-distribution-form") + (opts.date ? "-" + opts.date : "") + ".pdf";
}

const INK = [17, 24, 39];
const MUTED = [100, 110, 125];
const RULE = [150, 158, 170];
const HEADER_FILL = [236, 239, 243];
const MARGIN = 36;

// Sign-in sheet geometry, shared with the page count shown to staff.
const SHEET = { width: 792, height: 612, headerBottom: 148, rowH: 30, headRowH: 22, footer: 30 };
export const SHEET_ROWS_PER_PAGE = Math.floor((SHEET.height - SHEET.headerBottom - SHEET.headRowH - SHEET.footer - MARGIN) / SHEET.rowH);

function drawLogo(doc, logo, x, y, h) {
  if (!logo) return 0;
  const w = h * (logo.width / logo.height);
  try { doc.addImage(logo.dataUrl, "PNG", x, y, w, h, "nb4hs-logo", "FAST"); } catch (e) { return 0; }
  return w;
}

// Logo, org name, the title line(s), and the Date/Location line.
// Returns the y where content can start.
function drawHeader(doc, opts, top, left, right) {
  const width = right - left;
  drawLogo(doc, opts.logo, left, top, 32);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  doc.text(ORG.name, right, top + 12, { align: "right" });

  let y = top + 58;
  formTitles(opts).forEach((title, i) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(i === 0 ? 18 : 13);
    doc.setTextColor(...(i === 0 ? INK : MUTED));
    const lines = doc.splitTextToSize(title, width);
    doc.text(lines, left + width / 2, y, { align: "center" });
    y += lines.length * (i === 0 ? 20 : 15);
  });
  return y;
}

// A typeable box (AcroForm text field) over a blank, so the PDF can be filled
// in on a computer or tablet (Adobe Reader, Preview, a browser's PDF viewer)
// as well as by hand. Empty boxes print as nothing, so the paper copy is the
// same either way. y is the baseline of the line the box sits on.
function addField(doc, name, x, y, w, size) {
  if (w < 20 || typeof doc.AcroFormTextField !== "function") return;
  const h = (size || 10) + 7;
  const f = new doc.AcroFormTextField();
  f.fieldName = name;
  f.x = x;
  f.y = y - h + 3;
  f.width = w;
  f.height = h;
  f.fontSize = size || 10;
  f.fontName = "helvetica";
  f.maxFontSize = size || 10;
  doc.addField(f);
}

// "Date: November 26, 2026" -- or a blank line to fill in by hand (and a
// typeable box when fieldName is given).
function drawLabeledLine(doc, text, value, x, y, w, fieldName) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...INK);
  doc.text(text + ":", x, y);
  const lx = x + doc.getTextWidth(text + ":") + 6;
  if (value) {
    doc.setFont("helvetica", "normal");
    doc.text(value, lx, y);
  }
  doc.setDrawColor(...RULE);
  doc.setLineWidth(0.6);
  doc.line(lx, y + 3, x + w, y + 3);
  if (!value && fieldName) addField(doc, fieldName, lx + 2, y + 2, x + w - lx - 4, 10);
}

// A tick box: a small square to mark by hand, plus a clickable check box
// over it when the PDF is filled in on screen.
function drawTickBox(doc, x, y, size, fieldName) {
  doc.setDrawColor(...INK);
  doc.setLineWidth(0.7);
  doc.rect(x, y - size + 1, size, size);
  if (fieldName && typeof doc.AcroFormCheckBox === "function") {
    const cb = new doc.AcroFormCheckBox();
    cb.fieldName = fieldName;
    cb.x = x;
    cb.y = y - size + 1;
    cb.width = size;
    cb.height = size;
    doc.addField(cb);
  }
}

// "Do you have SNAP? / Èske ou gen SNAP?" then "[ ] Yes / Wi   [ ] No / Non"
// on the line below. Returns the y after it.
function drawYesNoQuestion(doc, question, lang, x, y, w, fieldName) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...INK);
  const lines = doc.splitTextToSize(question, w);
  doc.text(lines, x, y);
  y += lines.length * 13 + 9;
  doc.setFont("helvetica", "normal");
  let bx = x + 4;
  ["ffYes", "ffNo"].forEach((k) => {
    drawTickBox(doc, bx, y, 11, fieldName ? fieldName + "_" + (k === "ffYes" ? "yes" : "no") : null);
    doc.setTextColor(...INK);
    doc.text(label(k, lang), bx + 17, y);
    bx += 17 + doc.getTextWidth(label(k, lang)) + 36;
  });
  return y;
}

// Fit a typed value into a table cell: shrink a little, then cut with "…".
function fitText(doc, text, maxW) {
  let size = 10;
  doc.setFontSize(size);
  while (size > 7 && doc.getTextWidth(text) > maxW) { size -= 0.5; doc.setFontSize(size); }
  if (doc.getTextWidth(text) <= maxW) return text;
  let cut = text;
  while (cut.length > 1 && doc.getTextWidth(cut + "…") > maxW) cut = cut.slice(0, -1);
  return cut + "…";
}

function drawSignatureImage(doc, dataUrl, x, y, maxW, maxH, alias) {
  try {
    const props = doc.getImageProperties(dataUrl);
    const scale = Math.min(maxW / props.width, maxH / props.height);
    const w = props.width * scale, h = props.height * scale;
    doc.addImage(dataUrl, "PNG", x, y + (maxH - h) / 2, w, h, alias, "FAST");
  } catch (e) { /* a bad image just leaves the box empty */ }
}

function drawFooter(doc, opts, page, total, width, height) {
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  const lang = langList(opts.lang)[0];
  doc.text(ORG.name, MARGIN, height - 18);
  doc.text(t("ffPageOf", lang).replace("{n}", page).replace("{total}", total), width - MARGIN, height - 18, { align: "right" });
}

function buildSheet(doc, opts) {
  const { width, height } = SHEET;
  const left = MARGIN, right = width - MARGIN, tableW = right - left;
  const lang = opts.lang;
  // # | Name | Address | Phone | [SNAP? | Apply?] | Signature
  const snap = programAsksSnap(opts.program);
  const fixed = snap ? [28, 158, 200, 100, 52, 52] : [28, 175, 235, 110];
  const cols = fixed.concat([tableW - fixed.reduce((a, b) => a + b, 0)]);
  const heads = ["#", label("ffName", lang), label("ffAddress", lang), label("ffPhone", lang)]
    .concat(snap ? [label("ffSnapCol", lang), label("ffApplyCol", lang)] : [])
    .concat([label("ffSignature", lang)]);
  const sigCol = cols.length - 1;
  const firstLang = langList(lang)[0];
  const entries = opts.entries || [];
  const pages = Math.max(opts.pages, Math.ceil(entries.length / SHEET_ROWS_PER_PAGE));

  for (let p = 0; p < pages; p++) {
    if (p > 0) doc.addPage("letter", "landscape");
    let y = drawHeader(doc, opts, MARGIN, left, right);
    // Date/Location sit just under the title, clear of the table.
    y = Math.min(Math.max(y + 6, 112), SHEET.headerBottom - 12);
    const half = (tableW - 24) / 2;
    drawLabeledLine(doc, label("ffDate", lang), formatFormDate(opts.date, lang), left, y, half, "p" + (p + 1) + "_date");
    drawLabeledLine(doc, label("ffLocation", lang), (opts.location || "").trim(), left + half + 24, y, half, "p" + (p + 1) + "_location");
    y = SHEET.headerBottom;

    // Header row
    doc.setFillColor(...HEADER_FILL);
    doc.setDrawColor(...RULE);
    doc.setLineWidth(0.6);
    doc.rect(left, y, tableW, SHEET.headRowH, "FD");
    doc.setFont("helvetica", "bold");
    const headSize = heads.some((h) => h.length > 18) ? 8.5 : 10;
    doc.setTextColor(...INK);
    let x = left;
    heads.forEach((h, i) => {
      // The narrow SNAP columns stack their languages.
      const parts = h.split(" / ");
      if (doc.setFontSize(headSize).getTextWidth(h) > cols[i] - 8 && parts.length > 1) {
        doc.setFontSize(7.5);
        parts.slice(0, 2).forEach((part, k) => doc.text(part, x + 5, y + 9 + k * 8.5));
      } else {
        doc.setFontSize(headSize);
        doc.text(h, i === 0 ? x + cols[0] / 2 : x + 6, y + 14.5, i === 0 ? { align: "center" } : undefined);
      }
      x += cols[i];
    });
    y += SHEET.headRowH;

    // Rows
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    for (let r = 0; r < SHEET_ROWS_PER_PAGE; r++) {
      const n = p * SHEET_ROWS_PER_PAGE + r + 1;
      doc.setDrawColor(...RULE);
      doc.rect(left, y, tableW, SHEET.rowH);
      doc.setTextColor(...MUTED);
      doc.setFontSize(9);
      doc.text(String(n), left + cols[0] / 2, y + SHEET.rowH / 2 + 3, { align: "center" });
      const entry = entries[n - 1];
      const cellX = cols.slice(1).map((_, c) => left + cols.slice(0, c + 1).reduce((a, b) => a + b, 0));
      const baseline = y + SHEET.rowH / 2 + 3.5;
      const textKeys = ["name", "address", "phone"];
      const snapKeys = snap ? ["hasSnap", "wantsSnapHelp"] : [];
      if (entry) {
        // A row someone filled in online: their typed answers and drawn signature.
        doc.setTextColor(...INK);
        textKeys.forEach((k, i) => {
          const value = fitText(doc, String(entry[k] || ""), cols[i + 1] - 12);
          doc.text(value, cellX[i] + 6, baseline);
        });
        snapKeys.forEach((k, i) => {
          const v = entry[k] === "yes" ? t("ffYes", firstLang) : entry[k] === "no" ? t("ffNo", firstLang) : "";
          if (v) doc.text(fitText(doc, v, cols[4 + i] - 12), cellX[3 + i] + 6, baseline);
        });
        doc.setFontSize(9);
        if (entry.signature) drawSignatureImage(doc, entry.signature, cellX[sigCol - 1] + 6, y + 3, cols[sigCol] - 12, SHEET.rowH - 6, "sig-" + n);
      } else {
        textKeys.concat(["signature"]).forEach((k, i) => {
          const c = k === "signature" ? sigCol - 1 : i;
          addField(doc, "row" + n + "_" + k, cellX[c] + 3, baseline + 3.5, cols[c + 1] - 6, 10);
        });
        // Yes / No tick boxes, with the first language's initials.
        snapKeys.forEach((k, i) => {
          let bx = cellX[3 + i] + 5;
          doc.setFont("helvetica", "normal");
          ["ffYesShort", "ffNoShort"].forEach((lk, j) => {
            doc.setFontSize(8);
            doc.setTextColor(...MUTED);
            doc.text(t(lk, firstLang), bx, baseline);
            bx += doc.getTextWidth(t(lk, firstLang)) + 2;
            drawTickBox(doc, bx, baseline + 0.5, 8, "row" + n + "_" + (k === "hasSnap" ? "snap" : "apply") + "_" + (j === 0 ? "yes" : "no"));
            bx += 13;
          });
        });
      }
      y += SHEET.rowH;
    }
    // Column rules, top of header to bottom of the last row
    const tableTop = SHEET.headerBottom;
    doc.setDrawColor(...RULE);
    doc.setLineWidth(0.6);
    x = left;
    for (let i = 0; i < cols.length - 1; i++) {
      x += cols[i];
      doc.line(x, tableTop, x, y);
    }
    // What the SNAP columns ask, under the table.
    if (snap) {
      doc.setFont("helvetica", "italic");
      doc.setFontSize(8);
      doc.setTextColor(...MUTED);
      langList(lang).forEach((l, k) => doc.text(t("ffSnapLegend", l), left, y + 14 + k * 10));
    }
    drawFooter(doc, opts, p + 1, pages, width, height);
  }
}

function buildIndividual(doc, opts) {
  const width = 612, height = 792;
  const left = MARGIN + 18, right = width - MARGIN - 18, w = right - left;
  const lang = opts.lang;
  const pages = opts.pages;
  const snap = programAsksSnap(opts.program);
  // Room to write by hand between lines; the Regular form has two more questions.
  const GAP = snap ? 56 : 74;

  for (let p = 0; p < pages; p++) {
    if (p > 0) doc.addPage("letter", "portrait");
    const id = "form" + (p + 1);
    let y = drawHeader(doc, opts, 48, left, right);
    y = Math.max(y + 24, 190);
    drawLabeledLine(doc, label("ffDate", lang), formatFormDate(opts.date, lang), left, y, w * 0.45, id + "_date");
    if ((opts.location || "").trim()) {
      drawLabeledLine(doc, label("ffLocation", lang), opts.location.trim(), left + w * 0.5, y, w * 0.5);
    }
    y += GAP + 10;
    drawLabeledLine(doc, label("ffName", lang), "", left, y, w, id + "_name");
    y += GAP;
    drawLabeledLine(doc, label("ffAddress", lang), "", left, y, w, id + "_address");
    y += GAP - 14;
    doc.setDrawColor(...RULE);
    doc.line(left, y + 3, right, y + 3);
    addField(doc, id + "_address2", left + 2, y + 2, w - 4, 10);
    y += GAP;
    drawLabeledLine(doc, label("ffPhone", lang), "", left, y, w * 0.6, id + "_phone");
    if (snap) {
      y += GAP - 8;
      y = drawYesNoQuestion(doc, label("ffSnapQ", lang), lang, left, y, w, id + "_snap");
      y += 34;
      y = drawYesNoQuestion(doc, label("ffApplyQ", lang), lang, left, y, w, id + "_apply");
      y += GAP - 14;
    } else {
      y += GAP + 6;
    }
    doc.setFont("helvetica", "italic");
    doc.setFontSize(10);
    doc.setTextColor(...MUTED);
    langList(lang).forEach((l) => {
      doc.text(doc.splitTextToSize(t("ffAcknowledge", l), w), left, y);
      y += 14;
    });
    y += GAP;
    drawLabeledLine(doc, label("ffSignature", lang), "", left, y, w, id + "_signature");
    drawFooter(doc, opts, p + 1, pages, width, height);
  }
}

// jsPDF is passed in (it's loaded lazily by the page). opts:
//   layout: "sheet" | "individual", lang: one of FORM_LANGS, program: one of
//   FOOD_PROGRAMS (default "regular"),
//   occasion: one of OCCASIONS, customOccasion, date (YYYY-MM-DD or ""),
//   location, pages (1-20), logo: { dataUrl, width, height } | null,
//   entries (sheet only): [{ name, address, phone, hasSnap, wantsSnapHelp,
//   signature (PNG data URL) }]
//   -- answers given online, printed into the rows; the sheet grows to fit.
// Blank lines carry typeable fields, so the PDF can be filled on screen too.
export function buildFoodFormPdf(JsPDF, raw) {
  const opts = Object.assign({}, raw, { pages: Math.min(20, Math.max(1, Number(raw.pages) || 1)) });
  const sheet = opts.layout !== "individual";
  const doc = new JsPDF({ unit: "pt", format: "letter", orientation: sheet ? "landscape" : "portrait", compress: true });
  doc.setProperties({ title: formTitle(opts.occasion, opts.customOccasion, langList(opts.lang)[0]), author: ORG.name });
  if (sheet) buildSheet(doc, opts); else buildIndividual(doc, opts);
  return doc;
}
