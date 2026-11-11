// vite-i18n-split.js -- ships Kreyòl and French as their own chunks.
//
// src/lib/i18n.js keeps every language side by side ({ en, ht, fr } per key),
// which is how it's edited. Staff screens are English-only and make up most
// of the app's use, so loading all three languages on every page cost about
// 50 KB (gzipped) that staff never read. This plugin rewrites i18n.js as it
// is served or bundled:
//   - STR keeps only `en`;
//   - the ht and fr values that differ from English go to two virtual
//     modules (staff keys repeat English there, and t() already falls back
//     to `en`, so those copies are dropped);
//   - loadLanguages() / languagesLoaded() get real bodies that import those
//     modules and merge them back into STR.
// AppContext calls loadLanguages() on client-facing pages, which are the
// only ones that show Kreyòl or French. Vitest skips the plugin, so tests
// read i18n.js as written, with every language present.
const I18N_FILE = /\/src\/lib\/i18n\.js$/;
const VIRTUAL = "virtual:i18n-lang/";
const RESOLVED = "\0" + VIRTUAL;
const EXTRA_LANGS = ["ht", "fr"];

const LOADER = `
var extraLoaded = false;
var extraLoading = null;
export function languagesLoaded() { return extraLoaded; }
export function loadLanguages() {
  if (!extraLoading) {
    extraLoading = Promise.all([${EXTRA_LANGS.map((l) => `import("${VIRTUAL}${l}")`).join(", ")}]).then(function (mods) {
      ${JSON.stringify(EXTRA_LANGS)}.forEach(function (lang, i) {
        var strings = mods[i].default;
        Object.keys(strings).forEach(function (key) { if (STR[key]) STR[key][lang] = strings[key]; });
      });
      extraLoaded = true;
    }, function (err) {
      extraLoading = null;
      throw err;
    });
  }
  return extraLoading;
}
`;

function propName(prop) {
  return prop.key.type === "Identifier" ? prop.key.name : String(prop.key.value);
}

export default function i18nSplit() {
  // Filled when i18n.js is transformed; the virtual modules read from it.
  const extra = Object.fromEntries(EXTRA_LANGS.map((l) => [l, []]));

  return {
    name: "nb4hs-i18n-split",
    apply: () => !process.env.VITEST,
    resolveId(id) {
      if (id.startsWith(VIRTUAL)) return "\0" + id;
    },
    load(id) {
      if (!id.startsWith(RESOLVED)) return;
      const lang = id.slice(RESOLVED.length);
      return "export default {\n" + (extra[lang] || []).join(",\n") + "\n};\n";
    },
    transform(code, id) {
      if (!I18N_FILE.test(id)) return;
      const ast = this.parse(code);
      const decl = ast.body.find((n) => n.type === "ExportNamedDeclaration" && n.declaration?.declarations?.[0]?.id.name === "STR");
      const obj = decl?.declaration.declarations[0].init;
      if (!obj || obj.type !== "ObjectExpression") this.error("i18n split: `export var STR = { ... }` not found");
      const loaderStubs = ast.body.filter((n) => n.type === "ExportNamedDeclaration" && ["languagesLoaded", "loadLanguages"].includes(n.declaration?.id?.name));
      if (loaderStubs.length !== 2) this.error("i18n split: languagesLoaded() / loadLanguages() stubs not found");

      EXTRA_LANGS.forEach((l) => { extra[l].length = 0; });
      const entries = [];
      for (const prop of obj.properties) {
        if (prop.type !== "Property" || prop.value.type !== "ObjectExpression") this.error("i18n split: unexpected STR entry");
        const key = JSON.stringify(propName(prop));
        const values = Object.fromEntries(prop.value.properties.map((p) => [propName(p), code.slice(p.value.start, p.value.end)]));
        entries.push(key + ": { en: " + values.en + " }");
        for (const l of EXTRA_LANGS) {
          if (values[l] !== undefined && values[l] !== values.en) extra[l].push(key + ": " + values[l]);
        }
      }

      // Splice from the end so earlier offsets stay valid.
      const edits = [
        { start: obj.start, end: obj.end, text: "{\n" + entries.join(",\n") + "\n}" },
        ...loaderStubs.map((n, i) => ({ start: n.start, end: n.end, text: i === 0 ? LOADER : "" }))
      ].sort((a, b) => b.start - a.start);
      let out = code;
      for (const e of edits) out = out.slice(0, e.start) + e.text + out.slice(e.end);
      return { code: out, map: null };
    }
  };
}
