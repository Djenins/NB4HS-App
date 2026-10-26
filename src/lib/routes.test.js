// Every page has a canonical URL and every earlier URL still works
// (plans/unified-access-architecture.md §7.4): each redirect lands on a real
// route, carrying its parameters, and every sidebar page has a route.
import { readFileSync } from "node:fs";
import { resolve as resolvePath } from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("./supabase.js", () => ({ supabase: null }));
const { LEGACY_REDIRECTS, NAV_PATHS, fillPath, pathForNavKey } = await import("./routes.js");
const { NAV_ORDER } = await import("./modules.js");

const app = readFileSync(resolvePath(__dirname, "../App.jsx"), "utf8");
const routePatterns = [...app.matchAll(/<Route path="([^"]+)"/g)].map((m) => m[1]).filter((p) => p !== "*");

// Does a concrete path match a route pattern (":x" any segment, "x?" optional)?
function matches(pattern, path) {
  const pat = pattern.split("/").filter(Boolean);
  const parts = path.split("/").filter(Boolean);
  let i = 0;
  for (const seg of pat) {
    const optional = seg.endsWith("?");
    const name = optional ? seg.slice(0, -1) : seg;
    if (i >= parts.length) { if (optional) continue; return false; }
    if (name.startsWith(":") || name === parts[i]) { i++; continue; }
    if (optional) continue;
    return false;
  }
  return i === parts.length;
}
const routed = (path) => routePatterns.some((p) => matches(p, path));

describe("canonical routes", () => {
  it("gives every sidebar page a route", () => {
    expect(NAV_ORDER.filter((k) => !routed(pathForNavKey(k)))).toEqual([]);
  });

  it("puts program pages under their workspace", () => {
    expect(NAV_PATHS.assessments.startsWith("/students/")).toBe(true);
    ["jobdeveloper", "employers", "jobopenings", "candidatematching", "referrals", "placements", "workforcereports"]
      .forEach((k) => expect(NAV_PATHS[k].startsWith("/workforce/")).toBe(true));
  });
});

describe("old addresses", () => {
  const SAMPLE = { clientId: "c-1", employerId: "e-2", placementId: "p-3", program: "snap", section: "cases" };

  it("are all mounted as redirects, and no page is still served at one", () => {
    expect(app).toMatch(/LEGACY_REDIRECTS\.map\(\(r\) => <Route key=\{r\.from\} path=\{r\.from\} element=\{<LegacyRedirect to=\{r\.to\} \/>\} \/>\)/);
    expect(LEGACY_REDIRECTS.filter((r) => routePatterns.includes(r.from)).map((r) => r.from)).toEqual([]);
  });

  it("each one lands on a real page, parameters carried", () => {
    const broken = LEGACY_REDIRECTS.filter((r) => !routed(fillPath(r.to, SAMPLE)));
    expect(broken).toEqual([]);
    expect(fillPath("/workforce/employers/:employerId", SAMPLE)).toBe("/workforce/employers/e-2");
    expect(fillPath("/:program/:section", SAMPLE)).toBe("/snap/cases");
  });

  it("covers every address the app used before Phase 4b", () => {
    const old = ["/assessments", "/casemanagement", "/workforcedashboard", "/jobdeveloper", "/jobdeveloper/:clientId",
      "/employers", "/employers/:employerId", "/jobopenings", "/candidatematching", "/referrals", "/placements",
      "/placements/:placementId", "/workforcereports", "/fooddistribution", "/outreach", "/outreach/:program",
      "/outreach/:program/:section", "/settings", "/users"];
    expect(old.filter((o) => !LEGACY_REDIRECTS.some((r) => r.from === o))).toEqual([]);
  });
});
