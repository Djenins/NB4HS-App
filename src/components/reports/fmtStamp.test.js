import { afterAll, describe, expect, it, vi } from "vitest";

vi.mock("../../context/AppContext.jsx", () => ({ useApp: () => ({}), useT: () => (k) => k }));
const { fmtStamp } = await import("./ReportParts.jsx");

// Node reads TZ on each Date call, so this pins the viewer to New York
// whatever zone the machine (or CI) runs in.
const savedTz = process.env.TZ;
process.env.TZ = "America/New_York";
afterAll(() => { process.env.TZ = savedTz; });

describe("fmtStamp", () => {
  it("shows an evening submission on its own date, not the UTC date", () => {
    // 03:42 UTC on Oct 30 = 11:42 PM EDT on Oct 29.
    expect(fmtStamp("2026-10-30T03:42:46.328Z", "en")).toBe("Oct 29, 2026 · 11:42 PM");
  });

  it("returns a dash for no timestamp", () => {
    expect(fmtStamp(null, "en")).toBe("—");
  });
});
