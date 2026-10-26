// SnapCases.test.jsx -- the case detail view enforces closure rules before
// the server would, offers review actions by role, and the dashboard shows
// the server's numbers and routes its quick actions.
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { t as translate } from "../../lib/i18n.js";

let app;
vi.mock("../../context/AppContext.jsx", () => ({ useApp: () => app, useT: () => (key) => translate(key, "en") }));
const api = vi.hoisted(() => ({
  updateCase: vi.fn(), fetchCaseNotes: vi.fn(), fetchStageHistory: vi.fn(), addCaseNote: vi.fn(),
  fetchTasks: vi.fn(), fetchSnapDashboard: vi.fn(), fetchRecentActivity: vi.fn(), fetchCaseStages: vi.fn(), fetchCases: vi.fn()
}));
function wrap(names) { const o = {}; names.forEach((k) => { o[k] = (...a) => api[k](...a); }); return o; }
vi.mock("../../lib/assistanceCases.js", async (orig) => ({ ...(await orig()), ...wrap(["updateCase", "fetchCaseNotes", "fetchStageHistory", "addCaseNote", "fetchCaseStages", "fetchCases"]) }));
vi.mock("../../lib/snapTasks.js", async (orig) => ({ ...(await orig()), ...wrap(["fetchTasks", "fetchSnapDashboard", "fetchRecentActivity"]) }));

import SnapCaseDetail from "./SnapCaseDetail.jsx";
import SnapDashboard from "./SnapDashboard.jsx";

const en = (k) => translate(k, "en");
const stages = [
  { key: "new_inquiry", labels: { en: "New inquiry" }, sortOrder: 10, isTerminal: false, requiresReview: false, active: true },
  { key: "closed", labels: { en: "Closed" }, sortOrder: 100, isTerminal: true, requiresReview: true, active: true }
];
const baseCase = {
  id: "case1", caseNumber: "SNAP-2026-00001", clientId: "c1", nbId: "NB-00001", firstName: "Marie", lastName: "Joseph",
  assignedTo: "w1", openedAt: "2026-10-20", stageKey: "new_inquiry", assistanceRequested: ["application_help"], assistanceProvided: [],
  applicationAssistedAt: "", referredToDhsAt: "", followUpDate: "", closureReason: "", closedAt: null, reviewStatus: "not_requested"
};

function setApp(programRole, userId) {
  app = { data: { programRoles: { snap: programRole }, profiles: [{ id: "w1", name: "Wendy Worker", active: true }] }, lang: "en", session: { id: userId }, showToast: vi.fn() };
}

beforeEach(() => {
  Object.values(api).forEach((f) => f.mockReset());
  api.fetchCaseNotes.mockResolvedValue([]);
  api.fetchStageHistory.mockResolvedValue([]);
  api.fetchTasks.mockResolvedValue([]);
  api.updateCase.mockImplementation((id, patch) => Promise.resolve(Object.assign({}, baseCase, patch)));
});

function renderCase(caseRow) {
  return render(<MemoryRouter><SnapCaseDetail caseRow={caseRow || baseCase} stages={stages} onChanged={vi.fn()} onClose={vi.fn()} /></MemoryRouter>);
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

describe("SnapDashboard", () => {
  it("shows the server's numbers and routes quick actions", async () => {
    setApp("supervisor", "s1");
    api.fetchSnapDashboard.mockResolvedValue({
      individuals_contacted: 12, new_contacts: 5, cases_opened: 3, applications_assisted: 2, referred_to_dhs: 1,
      follow_ups_due: 4, overdue_tasks: 1, tasks_due_in_range: 4, tasks_done_in_range: 3,
      activity_by_week: [], activity_by_type: [{ key: "call", count: 7 }], contacts_by_source: [], cases_by_stage: []
    });
    api.fetchRecentActivity.mockResolvedValue([]);
    api.fetchCaseStages.mockResolvedValue(stages);
    api.fetchCases.mockResolvedValue([]);
    const onNavigate = vi.fn();
    render(<MemoryRouter><SnapDashboard onNavigate={onNavigate} /></MemoryRouter>);
    expect(await screen.findByText("75%")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByText(en("snapType_call"))).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: en("snapOpenCase") }));
    expect(onNavigate).toHaveBeenCalledWith("cases", "new");
  });
});
