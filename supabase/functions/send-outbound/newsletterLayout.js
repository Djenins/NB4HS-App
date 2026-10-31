// newsletterLayout.js -- the newsletter email layouts (c3_newsletter_layouts).
// Plain JavaScript on purpose: the send-outbound Edge Function (Deno) renders
// the emails with it, and the app (Vite) imports the same file for the
// editor's live preview, so what staff see is exactly what clients get.
//
// Every layout reads the same content:
//   { hero: { src, alt }, headline, intro, cta: { label, url },
//     subheading, sections: [{ src, alt, title, text, link: { label, url } }] }
// and arranges it differently (the seven common email layouts):
//   single     hero, headline, intro, button, sections stacked
//   f_pattern  headline, intro, sections as image-left rows
//   zigzag     hero, headline, intro, button, sections alternating sides
//   multi      hero, headline, intro, button, sub-heading, 3 columns
//   pyramid    hero, headline, intro, button, centred, no sections
//   hybrid     hero, headline, intro, button, sub-heading, image-left rows
//   double     hero, headline, intro, sub-heading, 2 columns
// A newsletter with no layout ("plain") stays the plain-text email.
//
// Emails are tables with inline styles (what mail apps render reliably);
// columns stack on narrow screens where the app honours the media query.
// Everything staff typed is escaped, and only https: links and images (and
// mailto: links) are kept, so a newsletter can't carry script or odd URLs.

export var LAYOUTS = {
  single: { hero: true, cta: true, subheading: false, sections: "stack", start: 2, max: 6 },
  f_pattern: { hero: false, cta: false, subheading: false, sections: "rows", start: 4, max: 8 },
  zigzag: { hero: true, cta: true, subheading: false, sections: "zigzag", start: 3, max: 8 },
  multi: { hero: true, cta: true, subheading: true, sections: "grid3", start: 3, max: 9 },
  pyramid: { hero: true, cta: true, subheading: false, sections: "none", start: 0, max: 0 },
  hybrid: { hero: true, cta: true, subheading: true, sections: "rows", start: 2, max: 6 },
  double: { hero: true, cta: false, subheading: true, sections: "grid2", start: 2, max: 8 }
};
export var LAYOUT_KEYS = ["single", "f_pattern", "zigzag", "multi", "pyramid", "hybrid", "double"];

// The legal footer's wording, per language (send-outbound and the preview).
// The Kreyòl and French wording needs a native speaker's check.
export var NEWSLETTER_FOOTER = {
  en: { why: "You're receiving this because you agreed to receive program updates from New Bridges for Haitian Success.", stop: "Unsubscribe" },
  ht: { why: "Ou resevwa mesaj sa a paske ou te dakò pou resevwa nouvèl pwogram New Bridges for Haitian Success.", stop: "Dezabòne" },
  fr: { why: "Vous recevez ce message parce que vous avez accepté de recevoir les actualités des programmes de New Bridges for Haitian Success.", stop: "Se désabonner" }
};

var INK = "#0b1f3a";
var MUTED = "#5b6b82";
var BRAND = "#1d4ed8";
var BG = "#f4f6fa";
var LINE = "#e3e8f0";
var FONT = "Arial,Helvetica,sans-serif";

export function escapeHtml(value) {
  return String(value == null ? "" : value).replace(/[&<>"']/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
  });
}

// https: (and mailto: for links) only; anything else is dropped. The local
// development stack serves images over http://127.0.0.1, so that's allowed
// too -- no real email ever carries it.
export function safeUrl(url, allowMailto) {
  var u = String(url || "").trim();
  if (/^https:\/\/[^\s"'<>]+$/i.test(u)) return u;
  if (/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?\/[^\s"'<>]*$/i.test(u)) return u;
  if (allowMailto && /^mailto:[^\s"'<>]+$/i.test(u)) return u;
  return "";
}

function str(v, max) {
  return String(v == null ? "" : v).trim().slice(0, max);
}

// Trims and caps whatever the editor (or a payload) holds into the shape
// above. Missing pieces become empty strings; extra sections are dropped.
export function normalizeContent(content, layout) {
  var c = content && typeof content === "object" ? content : {};
  var cfg = LAYOUTS[layout] || LAYOUTS.single;
  var hero = c.hero && typeof c.hero === "object" ? c.hero : {};
  var cta = c.cta && typeof c.cta === "object" ? c.cta : {};
  var sections = Array.isArray(c.sections) ? c.sections : [];
  return {
    hero: { src: str(hero.src, 1000), alt: str(hero.alt, 200) },
    headline: str(c.headline, 150),
    intro: str(c.intro, 3000),
    cta: { label: str(cta.label, 60), url: str(cta.url, 1000) },
    subheading: str(c.subheading, 150),
    sections: sections.slice(0, cfg.max).map(function (s) {
      var x = s && typeof s === "object" ? s : {};
      var link = x.link && typeof x.link === "object" ? x.link : {};
      return {
        src: str(x.src, 1000), alt: str(x.alt, 200), title: str(x.title, 150), text: str(x.text, 1500),
        link: { label: str(link.label, 60), url: str(link.url, 1000) }
      };
    })
  };
}

// Starter content for a layout: what the editor fills in when someone picks
// it, shaped like the layout's mock-up. Staff replace every line.
export function starterContent(layout) {
  var cfg = LAYOUTS[layout] || LAYOUTS.single;
  var sections = [];
  for (var i = 0; i < cfg.start; i++) {
    sections.push({
      src: "", alt: "", title: "Headline for section " + (i + 1),
      text: "A sentence or two about this item. Keep it short; people skim newsletters.",
      link: { label: "Learn more", url: "" }
    });
  }
  return {
    hero: { src: "", alt: "" },
    headline: "The main headline goes here",
    intro: "Start with the one thing you most want readers to know. Add the details below.",
    cta: { label: cfg.cta ? "Call to action" : "", url: "" },
    subheading: cfg.subheading ? "More from New Bridges" : "",
    sections: sections
  };
}

// The text/plain part of the email (and what the app stores as the body).
export function newsletterText(content, layout) {
  var c = normalizeContent(content, layout);
  var cfg = LAYOUTS[layout] || LAYOUTS.single;
  var out = [];
  if (c.headline) out.push(c.headline);
  if (c.intro) out.push(c.intro);
  if (cfg.cta && c.cta.label && safeUrl(c.cta.url, true)) out.push(c.cta.label + ": " + c.cta.url);
  if (cfg.subheading && c.subheading && c.sections.length) out.push(c.subheading);
  if (cfg.sections !== "none") {
    c.sections.forEach(function (s) {
      var lines = [s.title, s.text];
      if (s.link.label && safeUrl(s.link.url, true)) lines.push(s.link.label + ": " + s.link.url);
      var block = lines.filter(Boolean).join("\n");
      if (block) out.push(block);
    });
  }
  return out.join("\n\n");
}

// ---------- pieces ----------

function paragraphs(text, style) {
  return String(text || "").split(/\n{2,}/).map(function (p) { return p.trim(); }).filter(Boolean).map(function (p) {
    return '<p style="margin:0 0 12px;' + style + '">' + escapeHtml(p).replace(/\n/g, "<br>") + "</p>";
  }).join("");
}

// A grey picture with a mountain, like the mock-ups: shown only in the
// editor's preview where an image hasn't been added yet.
function placeholderImage(height) {
  return '<div style="height:' + height + 'px;background:#dbe4ff;border-radius:8px;position:relative;overflow:hidden">' +
    '<svg width="100%" height="100%" viewBox="0 0 200 100" preserveAspectRatio="none" aria-hidden="true">' +
    '<polygon points="0,100 60,40 110,90 140,60 200,100" fill="#b4c6fc"/><circle cx="150" cy="30" r="10" fill="#c7d4fe"/></svg></div>';
}

function image(src, alt, height, opts) {
  var url = safeUrl(src);
  if (!url) return opts.placeholders ? placeholderImage(height) : "";
  return '<img src="' + escapeHtml(url) + '" alt="' + escapeHtml(alt) + '" width="100%" ' +
    'style="display:block;width:100%;max-width:100%;height:auto;border:0;border-radius:8px">';
}

// In the preview (opts.placeholders) a button or link without an address
// still shows, pointing nowhere, so staff see where it will sit.
function button(cta, align, opts) {
  var url = safeUrl(cta.url, true) || (opts && opts.placeholders ? "#" : "");
  if (!cta.label || !url) return "";
  return '<table role="presentation" cellpadding="0" cellspacing="0" style="margin:4px ' + (align === "center" ? "auto" : "0") + ' 0"><tr>' +
    '<td style="background:' + BRAND + ';border-radius:8px"><a href="' + escapeHtml(url) + '" style="display:inline-block;padding:12px 22px;' +
    'color:#ffffff;text-decoration:none;font-weight:bold;font-size:15px;font-family:' + FONT + '">' + escapeHtml(cta.label) + "</a></td></tr></table>";
}

function textLink(link, opts) {
  var url = safeUrl(link.url, true) || (opts && opts.placeholders ? "#" : "");
  if (!link.label || !url) return "";
  return '<a href="' + escapeHtml(url) + '" style="color:' + BRAND + ';font-weight:bold;font-size:14px;text-decoration:underline">' +
    escapeHtml(link.label) + " &rarr;</a>";
}

function sectionText(s, size, opts) {
  return (s.title ? '<h3 style="margin:0 0 6px;font-size:' + size + 'px;line-height:1.3;color:' + INK + '">' + escapeHtml(s.title) + "</h3>" : "") +
    paragraphs(s.text, "font-size:14px;line-height:1.5;color:" + INK) + textLink(s.link, opts);
}

function row(inner, pad) {
  return '<tr><td style="padding:' + (pad || "0 28px 24px") + '">' + inner + "</td></tr>";
}

// ---------- sections per arrangement ----------

function stack(sections, opts) {
  return sections.map(function (s) {
    var img = image(s.src, s.alt, 160, opts);
    return row((img ? '<div style="margin:0 0 12px">' + img + "</div>" : "") + sectionText(s, 18, opts), "0 28px 22px");
  }).join("");
}

// Image beside text; `alternate` swaps sides on every other row (zig zag).
function rows(sections, opts, alternate) {
  return sections.map(function (s, i) {
    var img = image(s.src, s.alt, 110, opts);
    var right = alternate && i % 2 === 1;
    var imgCell = img ? '<td class="nl-col" width="42%" valign="top" style="width:42%;padding:' + (right ? "0 0 0 8px" : "0 8px 0 0") + '">' + img + "</td>" : "";
    var textCell = '<td class="nl-col" valign="top" style="padding:' + (img ? (right ? "0 8px 0 0" : "0 0 0 8px") : "0") + '">' + sectionText(s, 16, opts) + "</td>";
    return row('<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>' +
      (right ? textCell + imgCell : imgCell + textCell) + "</tr></table>", "0 28px 20px");
  }).join("");
}

function grid(sections, opts, perRow) {
  var width = Math.floor(100 / perRow);
  var out = "";
  for (var i = 0; i < sections.length; i += perRow) {
    var cells = sections.slice(i, i + perRow).map(function (s) {
      var img = image(s.src, s.alt, perRow === 3 ? 80 : 110, opts);
      return '<td class="nl-col" width="' + width + '%" valign="top" style="width:' + width + '%;padding:0 6px 16px">' +
        (img ? '<div style="margin:0 0 10px">' + img + "</div>" : "") + sectionText(s, perRow === 3 ? 14 : 16, opts) + "</td>";
    });
    while (cells.length < perRow) cells.push('<td class="nl-col" width="' + width + '%" style="width:' + width + '%"></td>');
    out += row('<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>' + cells.join("") + "</tr></table>", "0 22px 4px");
  }
  return out;
}

// ---------- the whole email ----------

// footer: { brand, why, address, stopLabel, href } -- the legal footer the
// Edge Function supplies (mailing address + unsubscribe link).
// opts.placeholders: draw grey boxes where images are missing (preview only).
export function renderNewsletterHtml(input, opts) {
  var o = opts || {};
  var layout = LAYOUTS[input.layout] ? input.layout : "single";
  var cfg = LAYOUTS[layout];
  var c = normalizeContent(input.content, layout);
  var lang = input.language === "ht" || input.language === "fr" ? input.language : "en";
  var f = input.footer || {};
  var centered = layout === "pyramid" || layout === "multi";
  var align = centered ? "center" : "left";

  var body = "";
  body += row('<p style="margin:0;font-size:13px;color:' + MUTED + ';text-align:' + align + '">' + escapeHtml(f.brand || "") + "</p>", "24px 28px 16px");
  if (cfg.hero) {
    var hero = image(c.hero.src, c.hero.alt, 200, o);
    if (hero) body += row(hero, "0 28px 20px");
  }
  var lead = (c.headline ? '<h1 style="margin:0 0 12px;font-size:24px;line-height:1.25;color:' + INK + ';text-align:' + align + '">' + escapeHtml(c.headline) + "</h1>" : "") +
    paragraphs(c.intro, "font-size:15px;line-height:1.55;color:" + INK + ";text-align:" + align) +
    (cfg.cta ? button(c.cta, align, o) : "");
  if (lead) body += row(lead, "0 28px 24px");

  if (cfg.sections !== "none" && c.sections.length) {
    body += row('<div style="border-top:1px solid ' + LINE + '"></div>', "0 28px 22px");
    if (cfg.subheading && c.subheading) {
      body += row('<h2 style="margin:0;font-size:19px;line-height:1.3;color:' + INK + ';text-align:' + align + '">' + escapeHtml(c.subheading) + "</h2>", "0 28px 16px");
    }
    if (cfg.sections === "stack") body += stack(c.sections, o);
    else if (cfg.sections === "rows") body += rows(c.sections, o, false);
    else if (cfg.sections === "zigzag") body += rows(c.sections, o, true);
    else if (cfg.sections === "grid3") body += grid(c.sections, o, 3);
    else if (cfg.sections === "grid2") body += grid(c.sections, o, 2);
  }

  var footer = (f.why ? '<p style="margin:0 0 4px">' + escapeHtml(f.why) + "</p>" : "") +
    (f.address ? '<p style="margin:0 0 4px">' + escapeHtml(f.address) + "</p>" : "") +
    (f.href ? '<p style="margin:0"><a href="' + escapeHtml(f.href) + '" style="color:' + BRAND + '">' + escapeHtml(f.stopLabel || "Unsubscribe") + "</a></p>" : "");

  return '<!doctype html><html lang="' + lang + '"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    "<title>" + escapeHtml(input.subject || "") + "</title>" +
    "<style>@media (max-width:600px){.nl-col{display:block!important;width:100%!important;padding:0 0 14px!important}}</style></head>" +
    '<body style="margin:0;padding:24px 12px;background:' + BG + ";font-family:" + FONT + ";color:" + INK + '">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">' +
    '<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:#ffffff;border-radius:12px">' +
    body + "</table>" +
    '<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px"><tr><td style="padding:18px 28px 0;font-size:12px;line-height:1.5;color:' + MUTED + ';text-align:center">' +
    footer + "</td></tr></table>" +
    "</td></tr></table></body></html>";
}
