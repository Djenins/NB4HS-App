// Case rules the UI mirrors from the stage2b database triggers and RLS:
// closing needs a reason (and approval when the stage requires review),
// workers act only on their own cases, and what counts as "needs attention".
import { describe, expect, it } from "vitest";
import { casePermissions, casesNeedingAttention, closureProblem, filterCases, stageLabel } from "./assistanceCases.js";

const stages = [
  { key: "new_inquiry", labels: { en: "New inquiry", ht: "Nouvo demann", fr: "Nouvelle demande" }, isTerminal: false, requiresReview: false },
  { key: "closed", labels: { en: "Closed", ht: "Fèmen", fr: "Clôturé" }, isTerminal: true, requiresReview: false }
];
const reviewed = stages.map((s) => (s.key === "closed" ? Object.assign({}, s, { requiresReview: true }) : s));

describe("closureProblem", () => {
  it("lets non-terminal stages through", () => {
    expect(closureProblem(stages, "new_inquiry", "", "not_requested")).toBeNull();
  });
  it("requires a closure reason to close", () => {
    expect(closureProblem(stages, "closed", "", "not_requested")).toBe("snapCaseNeedsClosureReason");
    expect(closureProblem(stages, "closed", "assistance_completed", "not_requested")).toBeNull();
  });
  it("requires approval when the closing stage needs review", () => {
    expect(closureProblem(reviewed, "closed", "assistance_completed", "requested")).toBe("snapCaseNeedsReview");
    expect(closureProblem(reviewed, "closed", "assistance_completed", "approved")).toBeNull();
  });
});

describe("casePermissions", () => {
  const mine = { assignedTo: "w1" };
  it("gives the assigned worker edit rights only", () => {
    expect(casePermissions(mine, "worker", "w1")).toEqual({ canEdit: true, canReassign: false, canReview: false });
    expect(casePermissions(mine, "worker", "w2").canEdit).toBe(false);
  });
  it("gives supervisors and program admins everything", () => {
    expect(casePermissions(mine, "supervisor", "s")).toEqual({ canEdit: true, canReassign: true, canReview: true });
    expect(casePermissions(mine, "program_admin", "p").canReview).toBe(true);
  });
});

describe("casesNeedingAttention", () => {
  const cases = [
    { id: "a", followUpDate: "2026-10-01", stageKey: "new_inquiry", reviewStatus: "not_requested", closedAt: null },
    { id: "b", followUpDate: "", stageKey: "follow_up_required", reviewStatus: "not_requested", closedAt: null },
    { id: "c", followUpDate: "", stageKey: "new_inquiry", reviewStatus: "requested", closedAt: null },
    { id: "d", followUpDate: "2026-12-01", stageKey: "new_inquiry", reviewStatus: "not_requested", closedAt: null },
    { id: "e", followUpDate: "2026-10-01", stageKey: "closed", reviewStatus: "approved", closedAt: "2026-10-10T00:00:00Z" }
  ];
  it("flags overdue follow-ups, follow-up stage and pending reviews on open cases", () => {
    expect(casesNeedingAttention(cases, "2026-10-26").map((c) => c.id)).toEqual(["a", "b", "c"]);
  });
});

describe("filterCases / stageLabel", () => {
  const cases = [
    { caseNumber: "SNAP-2026-00001", firstName: "Marie", lastName: "Joseph", nbId: "NB-1", assignedTo: "w1", stageKey: "new_inquiry", closedAt: null },
    { caseNumber: "SNAP-2026-00002", firstName: "Jean", lastName: "Pierre", nbId: "NB-2", assignedTo: "w2", stageKey: "closed", closedAt: "x" }
  ];
  it("filters by search, open, mine", () => {
    expect(filterCases(cases, { q: "00002" })).toHaveLength(1);
    expect(filterCases(cases, { openOnly: true })).toHaveLength(1);
    expect(filterCases(cases, { mineOnly: true, userId: "w2" })[0].firstName).toBe("Jean");
  });
  it("labels stages in the reader's language, falling back to the key", () => {
    expect(stageLabel(stages, "closed", "ht")).toBe("Fèmen");
    expect(stageLabel(stages, "gone", "en")).toBe("gone");
  });
});
