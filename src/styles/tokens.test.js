// Contrast guard for the semantic tone tokens in main.css. Every tone's ink
// must stay readable on its own tint, in both themes, so a later palette
// tweak can't quietly drop a status badge below WCAG AA.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(resolve(__dirname, "main.css"), "utf8");

function block(startMarker) {
  const start = css.indexOf("{", css.indexOf(startMarker)) + 1;
  return css.slice(start, css.indexOf("}", start));
}

function declarations(text) {
  const vars = {};
  const re = /--([\w-]+)\s*:\s*([^;]+);/g;
  let m;
  while ((m = re.exec(text.replace(/\/\*[\s\S]*?\*\//g, "")))) vars[m[1]] = m[2].trim();
  return vars;
}

const light = declarations(block(":root{"));
const dark = { ...light, ...declarations(block('html[data-theme="dark"]{')) };

function resolveVar(theme, name, depth = 0) {
  const value = theme[name];
  if (value === undefined) throw new Error("Unknown token --" + name);
  const ref = /^var\(--([\w-]+)\)$/.exec(value);
  if (ref && depth < 10) return resolveVar(theme, ref[1], depth + 1);
  return value;
}

function luminance(hex) {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const TONES = ["info", "success", "warning", "danger", "neutral", "violet"];
const THEMES = { light, dark };

describe("tone tokens", () => {
  for (const [themeName, theme] of Object.entries(THEMES)) {
    for (const tone of TONES) {
      const get = (slot) => resolveVar(theme, `tone-${tone}-${slot}`);

      it(`${themeName} ${tone}: ink on bg meets AA text (4.5:1)`, () => {
        expect(contrast(get("ink"), get("bg"))).toBeGreaterThanOrEqual(4.5);
      });

      it(`${themeName} ${tone}: ink on chip meets AA non-text (3:1)`, () => {
        expect(contrast(get("ink"), get("chip"))).toBeGreaterThanOrEqual(3);
      });

      it(`${themeName} ${tone}: on-solid text on solid meets AA text (4.5:1)`, () => {
        expect(contrast(get("on-solid"), get("solid"))).toBeGreaterThanOrEqual(4.5);
      });

      it(`${themeName} ${tone}: secondary text-on-tint on bg meets AA text (4.5:1)`, () => {
        expect(contrast(resolveVar(theme, "text-on-tint"), get("bg"))).toBeGreaterThanOrEqual(4.5);
      });
    }
  }
});
