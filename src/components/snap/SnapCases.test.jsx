// SnapCases.test.jsx -- the case detail view enforces closure rules before
// the server would, offers review actions by role, and the dashboard shows
// the server's numbers and routes its quick actions.
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { t as translate } from "../../lib/i18n.js";
import { withProgram } from "../../test/outreachProgram.jsx";

let app;
vi.mock("../../context/AppContext.jsx", () => ({ useApp: () => app, useT: () => (key) => translate(key, "en") }));
const api = vi.hoisted(() => ({
  updateCase: vi.fn(), fetchCaseNotes: vi.fn(), fetchStageHistory: vi.fn(), addCaseNote: vi.fn(),
  fetchTasks: vi.fn(), fetchOutreachDashboard: vi.fn(), fetchRecentActivity: vi.fn(), fetchCaseStages: vi.fn(), fetchCases: vi.fn()
}));
function wrap(names) { const o = {}; names.forEach((k) => { o[k] = (...a) => api[k](...a); }); return o; }
vi.mock("../../lib/assistanceCases.js", async (orig) => ({ ...(await orig()), ...wrap(["updateCase", "fetchCaseNotes", "fetchStageHistory", "addCaseNote", "fetchCaseStages", "fetchCases"]) }));
vi.mock("../../lib/snapTasks.js", async (orig) => ({ ...(await orig()), ...wrap(["fetchTasks", "fetchOutreachDashboard", "fetchRecentActivity"]) }));

import SnapCaseDetail from "./SnapCaseDetail.jsx";
import SnapDashboard from "./SnapDashboard.jsx";

const en = (k) => translate(k, "en");
const stages = [
  { key: "new_inquiry", labels: { en: "New inquiry" }, sortOrder: 10, isTerminal: false, requiresReview: false, active: true },
  { key: "closed", labels: { en: "Closed" }, sortOrder: 100, isTerminal: true, requiresReview: true, active: true }
];
const referredStage = { key: "referred_to_dhs", labels: { en: "Referred to Rhode Island DHS" }, sortOrder: 70, isTerminal: false, requiresReview: false, milestone: "referred_external", active: true };
const baseCase = {
  id: "case1", caseNumber: "SNAP-2026-00001", clientId: "c1", nbId: "NB-00001", firstName: "Marie", lastName: "Joseph",
  assignedTo: "w1", openedAt: "2026-10-20", stageKey: "new_inquiry", assistanceRequested: ["application_help"], assistanceProvided: [],
  applicationAssistedAt: "", referredToDhsAt: "", followUpDate: "", closureReason: "", closedAt: null, reviewStatus: "not_requested"
};

let programRole = null;
function setApp(role, userId) {
  programRole = role;
  app = { data: { programRoles: { snap: role }, profiles: [{ id: "w1", name: "Wendy Worker", active: true }] }, lang: "en", session: { id: userId }, showToast: vi.fn() };
}

beforeEach(() => {
  Object.values(api).forEach((f) => f.mockReset());
  api.fetchCaseNotes.mockResolvedValue([]);
  api.fetchStageHistory.mockResolvedValue([]);
  api.fetchTasks.mockResolvedValue([]);
  api.updateCase.mockImplementation((id, patch) => Promise.resolve(Object.assign({}, baseCase, patch)));
});

function renderCase(caseRow) {
  return render(<MemoryRouter>{withProgram(<SnapCaseDetail caseRow={caseRow || baseCase} stages={stages} onChanged={vi.fn()} onClose={vi.fn()} />, { programRole })}</MemoryRouter>);
}

describe("SnapCaseDetail", () => {
  it("blocks closing without a reason, then without supervisor approval", async () => {
    setApp("worker", "w1");
    renderCase();
    fireEvent.change(screen.getByLabelText(en("snapCaseStage")), { target: { value: "closed" } });
    expect(await screen.findByRole("alert")).toHaveTextContent(en("snapCaseNeedsClosureReason"));
    expect(screen.getByRole("button", { name: en("saveLabel") })).toBeDisabled();
    fireEvent.change(screen.getByLabelText(en("snapClosureReason")), { target: { value: "assistance_completed" } });
    expect(screen.getByRole("alert")).toHaveTextContent(en("snapCaseNeedsReview"));
    expect(api.updateCase).not.toHaveBeenCalled();
  });

  it("lets the assigned worker request review but not approve it", async () => {
    setApp("worker", "w1");
    renderCase();
    expect(screen.queryByRole("button", { name: en("snapApproveReview") })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: en("snapRequestReview") }));
    await waitFor(() => expect(api.updateCase).toHaveBeenCalledWith("case1", { reviewStatus: "requested" }));
  });

  it("lets a supervisor approve a requested review", async () => {
    setApp("supervisor", "s1");
    renderCase(Object.assign({}, baseCase, { reviewStatus: "requested" }));
    fireEvent.click(screen.getByRole("button", { name: en("snapApproveReview") }));
    await waitFor(() => expect(api.updateCase).toHaveBeenCalledWith("case1", { reviewStatus: "approved" }));
  });

  it("is read-only for a worker who isn't assigned", () => {
    setApp("worker", "w2");
    renderCase();
    expect(screen.getByText(en("snapCaseReadOnly"))).toBeInTheDocument();
    expect(screen.getByLabelText(en("snapCaseStage"))).toBeDisabled();
    expect(screen.queryByRole("button", { name: en("snapAddNote") })).not.toBeInTheDocument();
  });

  it("saves a note through the case API", async () => {
    setApp("worker", "w1");
    api.addCaseNote.mockResolvedValue(undefined);
    renderCase();
    fireEvent.change(screen.getByLabelText(en("snapAddNote")), { target: { value: "Uploaded pay stubs." } });
    fireEvent.click(screen.getByRole("button", { name: en("snapAddNote") }));
    await waitFor(() => expect(api.addCaseNote).toHaveBeenCalledWith("case1", "Uploaded pay stubs.", "w1"));
  });
});

describe("SnapCaseDetail option lists", () => {
  it("lists the program's assistance types, keeping a retired one only where the case uses it", () => {
    setApp("worker", "w1");
    renderCase();
    expect(screen.getAllByLabelText("SNAP application help")).toHaveLength(2);
    expect(screen.getAllByLabelText("SNAP application help")[0]).toBeChecked();
    expect(screen.queryByLabelText("EBT card help (never ask for the PIN)")).not.toBeInTheDocument();
    cleanup();
    renderCase(Object.assign({}, baseCase, { assistanceProvided: ["ebt_card_help"] }));
    expect(screen.getAllByLabelText("EBT card help (never ask for the PIN)")).toHaveLength(1);
  });

  it("offers the program's closure reasons and shows its scope note", () => {
    setApp("worker", "w1");
    renderCase();
    fireEvent.change(screen.getByLabelText(en("snapCaseStage")), { target: { value: "closed" } });
    const reasons = Array.from(screen.getByLabelText(en("snapClosureReason")).options).map((o) => o.textContent);
    expect(reasons).toEqual([en("snapNotSet"), "Assistance completed", "Participant declined"]);
    expect(screen.getByText("Eligibility decisions are made only by Rhode Island DHS.")).toBeInTheDocument();
  });

  it("names milestones after the stage configured for them", () => {
    setApp("worker", "w1");
    render(<MemoryRouter>{withProgram(<SnapCaseDetail caseRow={baseCase} stages={stages.concat([referredStage])} onChanged={vi.fn()} onClose={vi.fn()} />, { programRole })}</MemoryRouter>);
    expect(screen.getByText(/Referred to Rhode Island DHS:/)).toBeInTheDocument();
  });
});

describe("SnapDashboard", () => {
  it("shows the server's numbers and routes quick actions", async () => {
    setApp("supervisor", "s1");
    api.fetchOutreachDashboard.mockResolvedValue({
      individuals_contacted: 12, new_contacts: 5, cases_opened: 3, applications_assisted: 2, referred_external: 1,
      follow_ups_due: 4, overdue_tasks: 1, tasks_due_in_range: 4, tasks_done_in_range: 3,
      activity_by_week: [], activity_by_type: [{ key: "call", count: 7 }], contacts_by_source: [], cases_by_stage: []
    });
    api.fetchRecentActivity.mockResolvedValue([]);
    api.fetchCaseStages.mockResolvedValue(stages);
    api.fetchCases.mockResolvedValue([]);
    const onNavigate = vi.fn();
    render(<MemoryRouter>{withProgram(<SnapDashboard onNavigate={onNavigate} />, { programRole })}</MemoryRouter>);
    expect(await screen.findByText("75%")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByText(en("snapType_call"))).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: en("snapOpenCase") }));
    expect(onNavigate).toHaveBeenCalledWith("cases", "new");
    expect(api.fetchOutreachDashboard.mock.calls[0][0]).toBe("snap");
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("SNAP");
    // no stage carries a milestone in these fixtures, so neither milestone tile shows
    expect(screen.queryByText(en("snapKpiApplications"))).not.toBeInTheDocument();
  });

  it("labels the referral tile with the program's referral stage", async () => {
    setApp("supervisor", "s1");
    api.fetchOutreachDashboard.mockResolvedValue({ referred_external: 6, activity_by_week: [], activity_by_type: [], contacts_by_source: [], cases_by_stage: [] });
    api.fetchRecentActivity.mockResolvedValue([]);
    api.fetchCaseStages.mockResolvedValue(stages.concat([referredStage]));
    api.fetchCases.mockResolvedValue([]);
    render(<MemoryRouter>{withProgram(<SnapDashboard onNavigate={vi.fn()} />, { programRole })}</MemoryRouter>);
    expect(await screen.findByRole("button", { name: /Referred to Rhode Island DHS/ })).toHaveTextContent("6");
  });
});
