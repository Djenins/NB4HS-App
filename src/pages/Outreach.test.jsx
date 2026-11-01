// Outreach.test.jsx -- what each kind of user sees in the Outreach module:
// which programs and sections, where the URL lands them, and that the Staff
// & Access table writes the role a manager picks for the current program.
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import LegacyRedirect from "../components/LegacyRedirect.jsx";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { t as translate } from "../lib/i18n.js";
import { snapInfo, snapOptions } from "../test/outreachProgram.jsx";

let app;
vi.mock("../context/AppContext.jsx", () => ({
  useApp: () => app,
  useT: () => (key) => translate(key, "en")
}));
const fetchProgramStaff = vi.fn();
const setProgramRole = vi.fn();
vi.mock("../lib/programStaff.js", async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, fetchProgramStaff: (...a) => fetchProgramStaff(...a), setProgramRole: (...a) => setProgramRole(...a) };
});

let programs;
vi.mock("../lib/outreachPrograms.js", async (importOriginal) => ({
  ...(await importOriginal()),
  fetchOutreachPrograms: () => Promise.resolve(programs),
  fetchProgramOptions: () => Promise.resolve(snapOptions)
}));

// The dashboard's data calls: stubbed so these tests stay about access.
vi.mock("../lib/snapTasks.js", async (importOriginal) => ({
  ...(await importOriginal()),
  fetchOutreachDashboard: () => Promise.resolve({ individuals_contacted: 4, cases_opened: 2, cases_by_stage: [] }),
  fetchTasks: () => Promise.resolve([]),
  fetchRecentActivity: () => Promise.resolve([])
}));
vi.mock("../lib/assistanceCases.js", async (importOriginal) => ({
  ...(await importOriginal()),
  fetchCaseStages: () => Promise.resolve([]),
  fetchCases: () => Promise.resolve([])
}));

import Outreach from "./Outreach.jsx";

const en = (key) => translate(key, "en");
const profiles = [
  { id: "u-admin", name: "Ada Admin", email: "ada@nb4hs.org", role: "administrator", active: true },
  { id: "u-cm", name: "Cam Manager", email: "cam@nb4hs.org", role: "case_manager", active: true },
  { id: "u-gone", name: "Old Account", email: "old@nb4hs.org", role: "staff", active: false }
];

const medicaidInfo = Object.assign({}, snapInfo, { key: "medicaid", names: { en: "Medicaid", ht: "Medicaid", fr: "Medicaid" }, features: ["contacts"] });

function Where() { return <p data-testid="where">{useLocation().pathname}</p>; }

function renderAs(role, programRoles, path) {
  app = {
    session: { id: role === "administrator" ? "u-admin" : "u-cm", role },
    data: { programRoles, profiles },
    lang: "en",
    showToast: vi.fn(),
    refetchProgramRoles: vi.fn().mockResolvedValue(undefined)
  };
  return render(
    <MemoryRouter initialEntries={[path || "/snap"]}>
      <Routes>
        {/* As in App.jsx: each Outreach program is its own workspace route. */}
        <Route path="/snap/:section?" element={<><Outreach program="snap" /><Where /></>} />
        <Route path="/medicaid/:section?" element={<><Outreach program="medicaid" /><Where /></>} />
        <Route path="/outreach" element={<LegacyRedirect to="/snap" />} />
        <Route path="/outreach/:program" element={<LegacyRedirect to="/:program" />} />
        <Route path="/outreach/:program/:section" element={<LegacyRedirect to="/:program/:section" />} />
        <Route path="/dashboard" element={<p>dashboard</p>} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  programs = [snapInfo];
  fetchProgramStaff.mockReset().mockResolvedValue({ "u-cm": { role: "worker", active: true } });
  setProgramRole.mockReset().mockResolvedValue(undefined);
});

describe("Outreach", () => {
  it("shows a worker the dashboard and working sections, and no staff management", async () => {
    renderAs("case_manager", { snap: "worker" });
    for (const k of ["snapSectionDashboard", "snapSectionContacts", "snapSectionCases", "snapSectionTasks"]) {
      expect(await screen.findByRole("button", { name: en(k) })).toBeInTheDocument();
    }
    expect(screen.queryByRole("button", { name: en("snapSectionStaff") })).not.toBeInTheDocument();
    expect(await screen.findByText(en("snapDashboardScopeWorker"))).toBeInTheDocument();
  });

  it("shows an administrator without a SNAP role only Staff & Access", async () => {
    renderAs("administrator", {});
    expect(await screen.findByRole("heading", { level: 1, name: en("snapStaffTitle") })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: en("snapSectionDashboard") })).not.toBeInTheDocument();
    // active staff only, with their current SNAP role
    // (the table and its phone rows both render here, so take the first)
    expect(screen.getAllByText("Cam Manager")[0]).toBeInTheDocument();
    expect(screen.queryByText("Old Account")).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getAllByLabelText(en("snapRoleCol") + ": Cam Manager")[0]).toHaveValue("worker"));
  });

  it("sends people without a role or admin rights back to the dashboard", async () => {
    renderAs("case_manager", {});
    expect(await screen.findByText("dashboard")).toBeInTheDocument();
  });

  it("opens the first program a person belongs to, and the section named in the URL", async () => {
    programs = [snapInfo, medicaidInfo];
    renderAs("case_manager", { medicaid: "worker" }, "/snap");
    await waitFor(() => expect(screen.getByTestId("where")).toHaveTextContent("/medicaid"));
    cleanup();
    renderAs("case_manager", { snap: "worker" }, "/snap/tasks");
    expect(await screen.findByRole("button", { name: en("snapSectionTasks") })).toHaveAttribute("aria-current", "page");
  });

  it("won't open a program the person has no role in", async () => {
    programs = [snapInfo, medicaidInfo];
    renderAs("case_manager", { snap: "worker" }, "/medicaid");
    await waitFor(() => expect(screen.getByTestId("where")).toHaveTextContent(/^\/snap$/));
  });

  it("only shows the sections a program has switched on, and a switcher when there's a choice", async () => {
    programs = [snapInfo, medicaidInfo];
    renderAs("case_manager", { snap: "worker", medicaid: "worker" }, "/medicaid");
    expect(await screen.findByRole("button", { name: en("snapSectionContacts") })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: en("snapSectionCases") })).not.toBeInTheDocument();
    const switcher = screen.getByLabelText(en("outreachProgramLabel"));
    fireEvent.change(switcher, { target: { value: "snap" } });
    await waitFor(() => expect(screen.getByTestId("where")).toHaveTextContent("/snap"));
    expect(await screen.findByRole("button", { name: en("snapSectionCases") })).toBeInTheDocument();
  });

  it("hides the switcher with a single program", async () => {
    renderAs("case_manager", { snap: "worker" });
    await screen.findByRole("button", { name: en("snapSectionDashboard") });
    expect(screen.queryByLabelText(en("outreachProgramLabel"))).not.toBeInTheDocument();
  });

  it("forwards old /outreach links to the program's own address", async () => {
    renderAs("case_manager", { snap: "worker" }, "/outreach/snap/tasks");
    await waitFor(() => expect(screen.getByTestId("where")).toHaveTextContent(/^\/snap\/tasks$/));
    cleanup();
    renderAs("case_manager", { snap: "worker" }, "/outreach");
    await waitFor(() => expect(screen.getByTestId("where")).toHaveTextContent(/^\/snap$/));
  });

  it("writes the chosen role, and revokes with null", async () => {
    renderAs("administrator", {});
    const select = (await screen.findAllByLabelText(en("snapRoleCol") + ": Cam Manager"))[0];
    await waitFor(() => expect(select).not.toBeDisabled());
    fireEvent.change(select, { target: { value: "supervisor" } });
    await waitFor(() => expect(setProgramRole).toHaveBeenCalledWith("u-cm", "snap", "supervisor", "u-admin"));
    await waitFor(() => expect(select).not.toBeDisabled());
    fireEvent.change(select, { target: { value: "" } });
    await waitFor(() => expect(setProgramRole).toHaveBeenLastCalledWith("u-cm", "snap", null, "u-admin"));
  });

  it("says so when SNAP staff can't be loaded", async () => {
    fetchProgramStaff.mockRejectedValue(new Error("relation does not exist"));
    renderAs("administrator", {});
    expect(await screen.findByText(en("snapStaffLoadError"))).toBeInTheDocument();
  });
});
