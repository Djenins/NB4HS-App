// StaffReports.test.jsx -- who sees the reporting pages, the staff flow
// (create a draft, required-field check, submit, confirmation), and the
// reviewer flow (opening a report starts the review; a revision needs a
// comment). Data calls are stubbed; the database rules themselves are
// covered by supabase/tests/staff_reports_r1_check.sql.
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { t as translate } from "../lib/i18n.js";
import { navItemsForRole } from "../lib/nav.js";

let app;
vi.mock("../context/AppContext.jsx", () => ({
  useApp: () => app,
  useT: () => (key) => translate(key, "en")
}));

const api = {};
vi.mock("../lib/staffReports.js", async (importOriginal) => {
  const actual = await importOriginal();
  const stub = (name) => (...a) => api[name](...a);
  return {
    ...actual,
    fetchMyExpectations: stub("fetchMyExpectations"), fetchReports: stub("fetchReports"), fetchDepartments: stub("fetchDepartments"),
    fetchSchedules: stub("fetchSchedules"), fetchReportHistory: stub("fetchReportHistory"), createDraft: stub("createDraft"),
    saveDraft: stub("saveDraft"), submitReport: stub("submitReport"), fetchReport: stub("fetchReport"), startReview: stub("startReview"),
    requestRevision: stub("requestRevision"), acknowledgeReport: stub("acknowledgeReport"),
    fetchStaffDepartments: () => Promise.resolve([])
  };
});
vi.mock("../lib/programStaff.js", async (importOriginal) => ({
  ...(await importOriginal()),
  fetchProgramStaff: () => Promise.resolve({})
}));

import MyReports from "./MyReports.jsx";
import StaffReports, { staffReportSectionsFor } from "./StaffReports.jsx";

const en = (key) => translate(key, "en");
const DEPT = { id: "d-cm", key: "case_management", name: "Case Management", active: true };
const SCHEDULE = {
  id: "s1", name: "Biweekly staff report", active: true, timeZone: "America/New_York", firstPeriodStart: "2026-11-02", periodDays: 14,
  deadlineDaysAfterEnd: 1, deadlineTime: "17:00", graceHours: 0, reminderOffsets: [-3, -1, 0, 1], appliesToAll: true, departmentIds: []
};
const PERIOD = { periodId: "p1", periodStart: "2026-11-02", periodEnd: "2026-11-15", dueAt: "2026-11-16T22:00:00Z" };
const blankReport = {
  id: "r1", periodId: "p1", staffId: "u-jane", departmentId: "d-cm", status: "draft", activities: "", accomplishments: "",
  challenges: "", assistanceNeeded: "", noAssistanceNeeded: false, nextGoals: "", comments: "", outcomes: [], version: 0,
  submittedAt: null, periodStart: "2026-11-02", periodEnd: "2026-11-15", dueAt: "2026-11-16T22:00:00Z", updatedAt: "2026-11-03T14:00:00Z"
};

function setup(role, programRoles, id) {
  app = {
    session: { id: id || "u-jane", role, currentUserName: "Jane Pierre" },
    data: { programRoles: programRoles || {}, profiles: [{ id: "u-jane", name: "Jane Pierre", role: "staff", active: true }, { id: "u-boss", name: "B. Director", role: "administrator", active: true }] },
    lang: "en",
    showToast: vi.fn(),
    requestConfirm: vi.fn().mockResolvedValue(true),
    refetchProgramRoles: vi.fn()
  };
}

function renderAt(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/myreports" element={<MyReports />} />
        <Route path="/myreports/:reportId" element={<MyReports />} />
        <Route path="/staffreports" element={<StaffReports />} />
        <Route path="/staffreports/:reportId" element={<StaffReports />} />
        <Route path="/dashboard" element={<p>dashboard</p>} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  Object.keys(api).forEach((k) => delete api[k]);
  api.fetchDepartments = vi.fn().mockResolvedValue([DEPT]);
  api.fetchSchedules = vi.fn().mockResolvedValue([SCHEDULE]);
  api.fetchReportHistory = vi.fn().mockResolvedValue({ versions: [], reviews: [] });
});

describe("navigation", () => {
  it("gives every staff role My Reports", () => {
    ["administrator", "staff", "receptionist", "case_manager", "job_developer"].forEach((role) => {
      expect(navItemsForRole(role, [], {})).toContain("myreports");
    });
  });
  it("shows Staff Reports to reviewers, reporting admins and administrators only", () => {
    expect(navItemsForRole("staff", [], {})).not.toContain("staffreports");
    expect(navItemsForRole("case_manager", [], { snap: "supervisor" })).not.toContain("staffreports");
    expect(navItemsForRole("staff", [], { staff_reports: "reviewer" })).toContain("staffreports");
    expect(navItemsForRole("staff", [], { staff_reports: "program_admin" })).toContain("staffreports");
    expect(navItemsForRole("administrator", [], {})).toContain("staffreports");
  });
  it("gives an administrator settings but not report access unless also a reviewer", () => {
    expect(staffReportSectionsFor("administrator", null)).toEqual(["settings"]);
    expect(staffReportSectionsFor("administrator", "reviewer")).toEqual(["overview", "all", "settings"]);
    expect(staffReportSectionsFor("staff", "reviewer")).toEqual(["overview", "all"]);
    expect(staffReportSectionsFor("staff", "program_admin")).toEqual(["settings"]);
    expect(staffReportSectionsFor("staff", null)).toEqual([]);
  });
});

describe("My Reports", () => {
  it("tells someone with no department that they have nothing to report", async () => {
    setup("staff");
    api.fetchMyExpectations = vi.fn().mockResolvedValue([]);
    api.fetchReports = vi.fn().mockResolvedValue([]);
    renderAt("/myreports");
    expect(await screen.findByText(en("srNotAssigned"))).toBeTruthy();
  });

  it("lists one row per department with Create report, and creates a draft", async () => {
    setup("staff");
    api.fetchMyExpectations = vi.fn().mockResolvedValue([
      Object.assign({}, PERIOD, { staffId: "u-jane", departmentId: "d-cm", status: "not_started", overdue: false, reportId: null }),
      Object.assign({}, PERIOD, { staffId: "u-jane", departmentId: "d-wf", status: "not_started", overdue: false, reportId: null })
    ]);
    api.fetchReports = vi.fn().mockResolvedValue([]);
    api.createDraft = vi.fn().mockResolvedValue(blankReport);
    renderAt("/myreports");
    const buttons = await screen.findAllByRole("button", { name: en("srCreateReport") });
    expect(buttons).toHaveLength(2);
    fireEvent.click(buttons[0]);
    await waitFor(() => expect(api.createDraft).toHaveBeenCalledWith("p1", "d-cm", "u-jane"));
    expect(await screen.findByLabelText(en("srFieldActivities"))).toBeTruthy();
  });

  it("blocks submitting with required fields empty, then submits once complete", async () => {
    setup("staff");
    api.fetchMyExpectations = vi.fn().mockResolvedValue([]);
    api.fetchReports = vi.fn().mockResolvedValue([blankReport]);
    api.saveDraft = vi.fn().mockImplementation((id, f) => Promise.resolve(Object.assign({}, blankReport, f)));
    api.submitReport = vi.fn().mockResolvedValue(Object.assign({}, blankReport, { status: "submitted", version: 1, submittedAt: "2026-11-16T15:00:00Z" }));
    renderAt("/myreports/r1");

    const submit = await screen.findByRole("button", { name: en("srSubmitReport") });
    fireEvent.click(submit);
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(api.submitReport).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText(en("srFieldActivities")), { target: { value: "Ran two workshops" } });
    fireEvent.change(screen.getByLabelText(en("srFieldAccomplishments")), { target: { value: "Placed 3 participants" } });
    fireEvent.change(screen.getByLabelText(en("srFieldChallenges")), { target: { value: "Staffing" } });
    fireEvent.click(screen.getByLabelText(en("srNoAssistanceNeeded")));
    fireEvent.change(screen.getByLabelText(en("srFieldNextGoals")), { target: { value: "Two more workshops" } });
    fireEvent.click(submit);

    await waitFor(() => expect(api.submitReport).toHaveBeenCalledWith("r1"));
    expect(app.requestConfirm).toHaveBeenCalled();
    expect(api.saveDraft).toHaveBeenCalled();
    expect(await screen.findByText(en("srSubmittedTitle"))).toBeTruthy();
  });

  it("shows a submitted report read-only", async () => {
    setup("staff");
    api.fetchMyExpectations = vi.fn().mockResolvedValue([]);
    api.fetchReports = vi.fn().mockResolvedValue([Object.assign({}, blankReport, { status: "acknowledged", version: 1, submittedAt: "2026-11-16T15:00:00Z", activities: "Ran two workshops" })]);
    renderAt("/myreports/r1");
    expect(await screen.findByText("Ran two workshops")).toBeTruthy();
    expect(screen.queryByRole("button", { name: en("srSubmitReport") })).toBeNull();
  });
});

describe("Staff Reports review", () => {
  const submitted = Object.assign({}, blankReport, { status: "submitted", version: 1, submittedAt: "2026-11-16T15:00:00Z" });
  const history = {
    versions: [{ version: 1, submittedAt: "2026-11-16T15:00:00Z", content: Object.assign({}, blankReport, { activities: "Ran two workshops" }) }],
    reviews: [{ id: 1, actorId: "u-jane", action: "submitted", version: 1, comment: "", createdAt: "2026-11-16T15:00:00Z" }]
  };

  it("sends a non-reviewer administrator back to settings instead of the report", async () => {
    setup("administrator", {}, "u-boss");
    renderAt("/staffreports/r1");
    expect(await screen.findByText(en("srScheduleTitle"))).toBeTruthy();
    expect(screen.queryByRole("button", { name: en("srAcknowledge") })).toBeNull();
  });

  it("starts the review on open and requires a comment to send it back", async () => {
    setup("administrator", { staff_reports: "reviewer" }, "u-boss");
    api.fetchReport = vi.fn().mockResolvedValue(submitted);
    api.fetchReportHistory = vi.fn().mockResolvedValue(history);
    api.fetchReports = vi.fn().mockResolvedValue([]);
    api.startReview = vi.fn().mockResolvedValue(Object.assign({}, submitted, { status: "under_review" }));
    api.requestRevision = vi.fn().mockResolvedValue(Object.assign({}, submitted, { status: "revision_requested" }));
    renderAt("/staffreports/r1");

    expect(await screen.findByText("Ran two workshops")).toBeTruthy();
    await waitFor(() => expect(api.startReview).toHaveBeenCalledWith("r1"));

    fireEvent.click(await screen.findByRole("button", { name: en("srRequestRevision") }));
    const send = screen.getByRole("button", { name: en("srSendBack") });
    expect(send.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText(en("srRevisionComment")), { target: { value: "Please add attendance." } });
    fireEvent.click(send);
    await waitFor(() => expect(api.requestRevision).toHaveBeenCalledWith("r1", "Please add attendance."));
  });

  it("does not offer review actions on the reviewer's own report", async () => {
    setup("staff", { staff_reports: "reviewer" }, "u-jane");
    api.fetchReport = vi.fn().mockResolvedValue(submitted);
    api.fetchReportHistory = vi.fn().mockResolvedValue(history);
    api.fetchReports = vi.fn().mockResolvedValue([]);
    api.startReview = vi.fn();
    renderAt("/staffreports/r1");
    expect(await screen.findByText("Ran two workshops")).toBeTruthy();
    expect(screen.queryByRole("button", { name: en("srAcknowledge") })).toBeNull();
    expect(api.startReview).not.toHaveBeenCalled();
  });
});
