// @vitest-environment node
// The build splits Kreyòl and French out of i18n.js (vite-i18n-split.js).
// Run the plugin over the real file so a change to the file's shape (a
// computed key, a renamed stub) fails here instead of in the production build.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parseAst } from "vite";
import { describe, expect, it } from "vitest";
import i18nSplit from "../../vite-i18n-split.js";
import { STR } from "./i18n.js";

const file = fileURLToPath(new URL("./i18n.js", import.meta.url));

function run() {
  const plugin = i18nSplit();
  const ctx = { parse: (code) => parseAst(code), error: (msg) => { throw new Error(msg); } };
  const out = plugin.transform.call(ctx, readFileSync(file, "utf8"), file).code;
  const lang = (l) => plugin.load("\0virtual:i18n-lang/" + l);
  return { out, ht: lang("ht"), fr: lang("fr") };
}

// Evaluate an `export default { ... }` module body as a plain object.
const evalDefault = (code) => new Function(code.replace("export default", "return"))();

describe("i18n split", () => {
  it("keeps only English in the main chunk and swaps in the real loader", () => {
    const { out } = run();
    expect(out).not.toMatch(/\bht:/);
    expect(out).not.toMatch(/\bfr:/);
    expect(out).toContain('import("virtual:i18n-lang/ht")');
    expect(out).not.toContain("return Promise.resolve();");
  });

  it("moves every translated string, and only those, to its language chunk", () => {
    const { ht, fr } = run();
    const chunks = { ht: evalDefault(ht), fr: evalDefault(fr) };
    for (const l of ["ht", "fr"]) {
      const expected = Object.fromEntries(Object.entries(STR).filter(([, v]) => v[l] && v[l] !== v.en).map(([k, v]) => [k, v[l]]));
      expect(chunks[l]).toEqual(expected);
    }
    expect(chunks.ht.appTitle).toBe(STR.appTitle.ht);
  });
});
