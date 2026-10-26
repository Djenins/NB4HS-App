// SnapOutreach.test.jsx -- what each kind of user sees in the SNAP module,
// and that the Staff & Access table writes the role a manager picks.
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { t as translate } from "../lib/i18n.js";

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

import SnapOutreach from "./SnapOutreach.jsx";

const en = (key) => translate(key, "en");
const profiles = [
  { id: "u-admin", name: "Ada Admin", email: "ada@nb4hs.org", role: "administrator", active: true },
  { id: "u-cm", name: "Cam Manager", email: "cam@nb4hs.org", role: "case_manager", active: true },
  { id: "u-gone", name: "Old Account", email: "old@nb4hs.org", role: "staff", active: false }
];

function renderAs(role, programRoles) {
  app = {
    session: { id: role === "administrator" ? "u-admin" : "u-cm", role },
    data: { programRoles, profiles },
    lang: "en",
    showToast: vi.fn(),
    refetchProgramRoles: vi.fn().mockResolvedValue(undefined)
  };
  return render(
    <MemoryRouter initialEntries={["/snap"]}>
      <Routes>
        <Route path="/snap" element={<SnapOutreach />} />
        <Route path="/dashboard" element={<p>dashboard</p>} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  fetchProgramStaff.mockReset().mockResolvedValue({ "u-cm": { role: "worker", active: true } });
  setProgramRole.mockReset().mockResolvedValue(undefined);
});

describe("SnapOutreach", () => {
  it("shows a worker the overview with their role, and no staff management", () => {
    renderAs("case_manager", { snap: "worker" });
    expect(screen.getByText(en("snapOverviewTitle"))).toBeInTheDocument();
    expect(screen.getByText(en("snapRoleWorker"))).toBeInTheDocument();
    expect(screen.queryByText(en("snapSectionStaff"))).not.toBeInTheDocument();
  });

  it("shows an administrator without a SNAP role only Staff & Access", async () => {
    renderAs("administrator", {});
    expect(screen.queryByText(en("snapOverviewTitle"))).not.toBeInTheDocument();
    expect(await screen.findByText(en("snapStaffTitle"))).toBeInTheDocument();
    // active staff only, with their current SNAP role
    expect(screen.getByText("Cam Manager")).toBeInTheDocument();
    expect(screen.queryByText("Old Account")).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByLabelText(en("snapRoleCol") + ": Cam Manager")).toHaveValue("worker"));
  });

  it("sends people without a role or admin rights back to the dashboard", () => {
    renderAs("case_manager", {});
    expect(screen.getByText("dashboard")).toBeInTheDocument();
  });

  it("writes the chosen role, and revokes with null", async () => {
    renderAs("administrator", {});
    const select = await screen.findByLabelText(en("snapRoleCol") + ": Cam Manager");
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
