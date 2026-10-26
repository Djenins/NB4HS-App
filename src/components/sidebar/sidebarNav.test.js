import { describe, expect, it } from "vitest";
import { navItemsForRole } from "../../lib/nav.js";
import { activeEntryKey, sidebarSections } from "./sidebarNav.js";

const SNAP = { key: "snap", names: { en: "SNAP" }, active: true };
const keysOf = (sections, sectionKey) => sections.find((s) => s.key === sectionKey).entries.map((e) => e.key);

describe("sidebarSections", () => {
  it("folds Workforce into one Programs entry and shows SNAP as its own program", () => {
    // Explicit, so the test doesn't move with each role's item list in nav.js.
    const items = [
      "dashboard", "mycaseload", "checkin", "checkout", "search", "calendar", "reports", "fooddistribution",
      "qrcode", "manage", "students", "casemanagement", "jobdeveloper", "employers", "placements", "users", "settings", "outreach"
    ];
    const sections = sidebarSections(items, { programs: [SNAP], role: "administrator", programRoles: {} });
    expect(sections.map((s) => s.key)).toEqual(["overview", "dailyOps", "programs", "operations", "administration"]);
    expect(keysOf(sections, "programs")).toEqual(["fooddistribution", "students", "casemanagement", "outreach:snap", "workforce"]);
    expect(sections.flatMap((s) => s.entries).some((e) => e.key === "employers")).toBe(false);
  });

  it("keeps the single Outreach entry until the program list has loaded", () => {
    const items = navItemsForRole("administrator", [], {});
    expect(keysOf(sidebarSections(items, { programs: null, role: "administrator" }), "programs")).toContain("outreach");
  });

  it("only lists programs the person holds a role in", () => {
    const other = { key: "housing", names: { en: "Housing" }, active: true };
    const items = navItemsForRole("staff", [], { snap: "worker" });
    const programs = keysOf(sidebarSections(items, { programs: [SNAP, other], role: "staff", programRoles: { snap: "worker" } }), "programs");
    expect(programs).toContain("outreach:snap");
    expect(programs).not.toContain("outreach:housing");
  });

  it("hides Administration from roles without it", () => {
    const sections = sidebarSections(navItemsForRole("case_manager", [], {}), { role: "case_manager" });
    expect(sections.some((s) => s.key === "administration")).toBe(false);
  });

  it("gives Workforce a Programs group of its own when it is the only program", () => {
    const sections = sidebarSections(navItemsForRole("receptionist", ["receptionist"], {}), { role: "receptionist" });
    expect(keysOf(sections, "programs")).toEqual(["workforce"]);
  });
});

describe("activeEntryKey", () => {
  const sections = sidebarSections(navItemsForRole("administrator", [], {}), { programs: [SNAP], role: "administrator", programRoles: {} });

  it("keeps the parent program active on its nested pages", () => {
    expect(activeEntryKey(sections, "/workforce/employers/42")).toBe("workforce");
    expect(activeEntryKey(sections, "/students/assessments")).toBe("students");
    expect(activeEntryKey(sections, "/students/42")).toBe("students");
    expect(activeEntryKey(sections, "/snap/cases")).toBe("outreach:snap");
    expect(activeEntryKey(sections, "/checkin/visitor")).toBe("checkin");
    expect(activeEntryKey(sections, "/admin/roles/7")).toBe("users");
    expect(activeEntryKey(sections, "/admin/settings")).toBe("settings");
  });

  it("doesn't confuse prefixes that only share letters", () => {
    expect(activeEntryKey(sections, "/workforce-old")).toBe(null);
    expect(activeEntryKey(sections, "/snapshots")).toBe(null);
    expect(activeEntryKey(sections, "/checkout")).toBe("checkout");
    expect(activeEntryKey(sections, "/nowhere")).toBe(null);
  });
});
