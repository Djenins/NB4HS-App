// The personal strip on Home: what it counts, and that it only shows tiles
// for pages the person can open.
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { t as translate } from "../../lib/i18n.js";

let app;
vi.mock("../../context/AppContext.jsx", async () => {
  const { useCallback } = await import("react");
  return { useApp: () => app, useT: () => useCallback((k) => translate(k, "en"), []) };
});
vi.mock("../../lib/staffReports.js", async (orig) => Object.assign({}, await orig(), {
  fetchMyExpectations: vi.fn(async () => [
    { periodId: "p1", periodStart: "2026-10-19", periodEnd: "2026-11-01", submittedAt: null, overdue: false },
    { periodId: "p0", periodStart: "2026-10-05", periodEnd: "2026-10-18", submittedAt: null, overdue: true },
    { periodId: "p2", periodStart: "2026-11-02", periodEnd: "2026-11-15", submittedAt: null, overdue: false }
  ])
}));
vi.mock("../../lib/snapTasks.js", async (orig) => Object.assign({}, await orig(), { fetchTasks: vi.fn(async () => []) }));
vi.mock("../../lib/utils.js", async (orig) => Object.assign({}, await orig(), { todayStr: () => "2026-10-26" }));

const { default: ForYouPanel, forYouCounts } = await import("./ForYouPanel.jsx");

describe("forYouCounts", () => {
  it("counts overdue reports from any period plus this period's due ones", () => {
    const c = forYouCounts({
      expectations: [
        { periodId: "now", periodStart: "2026-10-19", periodEnd: "2026-11-01", submittedAt: null, overdue: false },
        { periodId: "now", periodStart: "2026-10-19", periodEnd: "2026-11-01", submittedAt: "2026-10-25", overdue: false },
        { periodId: "old", periodStart: "2026-10-05", periodEnd: "2026-10-18", submittedAt: null, overdue: true },
        { periodId: "next", periodStart: "2026-11-02", periodEnd: "2026-11-15", submittedAt: null, overdue: false }
      ],
      tasks: [
        { status: "open", dueDate: "2026-10-20" }, { status: "open", dueDate: "2026-10-28" },
        { status: "open", dueDate: "2026-12-01" }, { status: "done", dueDate: "2026-10-01" }
      ],
      appointments: [
        { assignedEmail: "Me@NB4HS.org", date: "2026-10-26", status: "scheduled" },
        { assignedEmail: "me@nb4hs.org", date: "2026-10-26", status: "cancelled" },
        { assignedEmail: "me@nb4hs.org", date: "2026-10-27", status: "scheduled" },
        { assignedEmail: "other@nb4hs.org", date: "2026-10-26", status: "scheduled" }
      ],
      email: "me@nb4hs.org", today: "2026-10-26"
    });
    expect(c).toEqual({ reports: { overdue: 1, due: 1 }, followUps: { overdue: 1, dueSoon: 1 }, appointments: 1 });
  });

  it("leaves out what it wasn't given", () => {
    expect(forYouCounts({ today: "2026-10-26" })).toEqual({ reports: null, followUps: null, appointments: null });
  });
});

describe("ForYouPanel", () => {
  const base = { session: { id: "u", role: "case_manager", currentUserEmail: "me@nb4hs.org" }, permissions: [], permissionsLoaded: true, permissionsFailed: true }; // account-type pages
  it("shows tiles only for pages the person can open", async () => {
    app = Object.assign({}, base, { data: { programRoles: {}, appointments: [], workforceRoleAccess: [] } });
    render(<MemoryRouter><ForYouPanel /></MemoryRouter>);
    expect(await screen.findByText(translate("forYouReports", "en"))).toBeInTheDocument();
    expect(screen.getByText(translate("forYouAppointments", "en"))).toBeInTheDocument();
    expect(screen.queryByText(translate("forYouFollowUps", "en"))).toBeNull(); // no SNAP role
    await waitFor(() => expect(screen.getByText("1 overdue")).toBeInTheDocument());
  });

  it("renders nothing for someone with none of those pages", () => {
    app = Object.assign({}, base, { session: Object.assign({}, base.session, { role: "unknown" }), data: { programRoles: {}, appointments: [], workforceRoleAccess: [] } });
    const { container } = render(<MemoryRouter><ForYouPanel /></MemoryRouter>);
    expect(container).toBeEmptyDOMElement();
  });
});
