// Pins who sees which outreach programs and sections, and how option lists
// read. These mirror the RLS rules (has_program_role / can_manage_program)
// and the outreach_o1_programs_and_options migration; the UI must never show
// more than the database allows.
import { describe, expect, it } from "vitest";
import {
  hasOutreachAccess, optionLabel, optionsFor, outreachSectionsFor, programName, programScopeNote, programsVisibleTo
} from "./outreachPrograms.js";
import { milestoneStage } from "./assistanceCases.js";
import { navItemsForRole } from "./nav.js";

const ALL = ["contacts", "cases", "tasks"];

describe("outreachSectionsFor", () => {
  it("gives a worker or supervisor the member sections only", () => {
    expect(outreachSectionsFor("staff", "worker", ALL)).toEqual(["dashboard", "contacts", "cases", "tasks"]);
    expect(outreachSectionsFor("case_manager", "supervisor", ALL)).toEqual(["dashboard", "contacts", "cases", "tasks"]);
  });

  it("gives a program admin both member and staff sections", () => {
    expect(outreachSectionsFor("staff", "program_admin", ALL)).toEqual(["dashboard", "contacts", "cases", "tasks", "staff"]);
  });

  it("gives an administrator without a program role only staff management", () => {
    expect(outreachSectionsFor("administrator", null, ALL)).toEqual(["staff"]);
  });

  it("gives an administrator who also holds a program role the member sections too", () => {
    expect(outreachSectionsFor("administrator", "worker", ALL)).toEqual(["dashboard", "contacts", "cases", "tasks", "staff"]);
  });

  it("gives everyone else nothing", () => {
    expect(outreachSectionsFor("case_manager", null, ALL)).toEqual([]);
    expect(outreachSectionsFor("staff", "owner", ALL)).toEqual([]);
    expect(outreachSectionsFor(null, null, ALL)).toEqual([]);
  });

  it("hides workflows the program hasn't switched on", () => {
    expect(outreachSectionsFor("staff", "worker", ["contacts"])).toEqual(["dashboard", "contacts"]);
    expect(outreachSectionsFor("staff", "program_admin", [])).toEqual(["dashboard", "staff"]);
  });
});

describe("programsVisibleTo", () => {
  const programs = [
    { key: "snap", active: true }, { key: "medicaid", active: true }, { key: "old", active: false }
  ];

  it("shows members only the programs they hold a role in", () => {
    expect(programsVisibleTo(programs, "staff", { medicaid: "worker" }).map((p) => p.key)).toEqual(["medicaid"]);
  });

  it("shows administrators every active program", () => {
    expect(programsVisibleTo(programs, "administrator", {}).map((p) => p.key)).toEqual(["snap", "medicaid"]);
  });

  it("never shows an inactive program", () => {
    expect(programsVisibleTo(programs, "staff", { old: "worker" })).toEqual([]);
  });
});

describe("Outreach sidebar entry", () => {
  it("shows for administrators and anyone holding a role in any program", () => {
    expect(navItemsForRole("administrator", [], {})).toContain("outreach");
    expect(navItemsForRole("staff", [], { snap: "worker" })).toContain("outreach");
    expect(navItemsForRole("receptionist", [], { medicaid: "supervisor" })).toContain("outreach");
    expect(hasOutreachAccess("staff", { snap: null })).toBe(false);
  });

  it("is hidden from other staff, and the old SNAP entry is gone", () => {
    expect(navItemsForRole("case_manager", [], {})).not.toContain("outreach");
    expect(navItemsForRole("job_developer", [])).not.toContain("outreach");
    expect(navItemsForRole("administrator", [], { snap: "worker" })).not.toContain("snap");
  });
});

describe("option lists", () => {
  const options = [
    { setKey: "assistance_type", key: "b", labels: { en: "Bee", ht: "Bi" }, sortOrder: 20, active: true },
    { setKey: "assistance_type", key: "a", labels: { en: "Ay" }, sortOrder: 10, active: true },
    { setKey: "assistance_type", key: "old", labels: { en: "Retired" }, sortOrder: 5, active: false },
    { setKey: "closure_reason", key: "done", labels: { en: "Done" }, sortOrder: 10, active: true }
  ];

  it("lists one set's active options in order", () => {
    expect(optionsFor(options, "assistance_type").map((o) => o.key)).toEqual(["a", "b"]);
  });

  it("keeps a retired option a record already uses", () => {
    expect(optionsFor(options, "assistance_type", ["old"]).map((o) => o.key)).toEqual(["old", "a", "b"]);
  });

  it("labels in the reader's language, falling back to English, then the code", () => {
    expect(optionLabel(options, "assistance_type", "b", "ht")).toBe("Bi");
    expect(optionLabel(options, "assistance_type", "a", "fr")).toBe("Ay");
    expect(optionLabel(options, "closure_reason", "gone", "en")).toBe("gone");
  });
});

describe("program labels and milestones", () => {
  const info = { names: { en: "SNAP", fr: "SNAP (fr)" }, scopeNotes: { en: "DHS decides.", ht: "", fr: "" } };

  it("reads names and scope notes per language", () => {
    expect(programName(info, "fr")).toBe("SNAP (fr)");
    expect(programName(info, "ht")).toBe("SNAP");
    expect(programScopeNote(info, "ht")).toBe("DHS decides.");
    expect(programScopeNote(null, "en")).toBe("");
  });

  it("finds the stage configured for a milestone, or none", () => {
    const stages = [{ key: "assistance_provided", milestone: "application_assisted" }, { key: "closed", milestone: null }];
    expect(milestoneStage(stages, "application_assisted").key).toBe("assistance_provided");
    expect(milestoneStage(stages, "referred_external")).toBeNull();
  });
});
