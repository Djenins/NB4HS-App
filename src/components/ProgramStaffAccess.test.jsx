// ProgramStaffAccess.test.jsx -- a program's Staff & Access page: each
// person's level here, a dropdown for people on access levels, and a link to
// the account for people still on their account type.
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { t as translate } from "../lib/i18n.js";

const tr = (k) => translate(k, "en");
let held = ["admin.users.view", "admin.permissions.assign"];
const showToast = vi.fn();

vi.mock("../context/AppContext.jsx", async () => {
  const { useCallback } = await import("react");
  return {
    useApp: () => ({
      session: { id: "me" }, lang: "en", showToast, can: (k) => held.indexOf(k) !== -1,
      data: { profiles: [
        { id: "a", name: "Ana Levels", email: "ana@nb4hs.org", role: "staff", active: true },
        { id: "b", name: "Ben Type", email: "ben@nb4hs.org", role: "case_manager", active: true },
        { id: "me", name: "Me", email: "me@nb4hs.org", role: "administrator", active: true },
        { id: "z", name: "Zed Off", email: "zed@nb4hs.org", role: "staff", active: false }
      ] }
    }),
    useT: () => useCallback((key) => translate(key, "en"), [])
  };
});

const lvl = vi.hoisted(() => ({}));
vi.mock("../lib/accessLevels.js", async (importOriginal) => {
  const real = await importOriginal();
  const access = (levels, frontDesk) => Object.assign(real.emptyAccess(), { frontDesk: !!frontDesk, levels: Object.assign(real.emptyAccess().levels, levels) });
  Object.assign(lvl, {
    fetchAccessLevels: vi.fn(() => Promise.resolve({
      a: { access: access({ students: "staff", food_distribution: "manager" }, true), mode: "levels" },
      b: { access: access({ students: "manager", case_management: "manager" }, true), mode: "account_type" },
      me: { access: access({ students: "manager" }), mode: "levels" }
    })),
    saveAccessLevels: vi.fn(() => Promise.resolve())
  });
  return Object.assign({}, real, lvl);
});

import ProgramStaffAccess from "./ProgramStaffAccess.jsx";

beforeEach(() => {
  held = ["admin.users.view", "admin.permissions.assign"];
  showToast.mockClear();
  lvl.saveAccessLevels.mockClear();
});

function renderPage() {
  return render(<MemoryRouter><ProgramStaffAccess program="students" programName="Adult Education" /></MemoryRouter>);
}

describe("ProgramStaffAccess", () => {
  it("lists active staff with their level here", async () => {
    renderPage();
    await screen.findAllByText("Ana Levels");
    expect(screen.queryAllByText("Zed Off")).toHaveLength(0);
    expect(screen.getAllByText((_, el) => el.textContent.startsWith(tr("accessFollowsTypeShort").replace("{type}", "Case Manager")) && el.tagName === "DIV").length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: tr("accessChangeOnAccount") })[0].getAttribute("href")).toBe("/admin/users/b");
  });

  it("changes one program's level and keeps the rest", async () => {
    renderPage();
    const select = (await screen.findAllByLabelText(tr("programStaffAccessCol") + ": Ana Levels"))[0];
    expect(select.value).toBe("staff");
    // Your own row is never a dropdown.
    expect(screen.queryAllByLabelText(tr("programStaffAccessCol") + ": Me")).toHaveLength(0);
    fireEvent.change(select, { target: { value: "manager" } });
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: tr("accessSave") }));
    await waitFor(() => expect(lvl.saveAccessLevels).toHaveBeenCalledWith("a",
      expect.objectContaining({ frontDesk: true, levels: expect.objectContaining({ students: "manager", food_distribution: "manager" }) }), ""));
  });

  it("is read-only without the right to assign access", async () => {
    held = ["admin.users.view"];
    renderPage();
    await screen.findAllByText("Ana Levels");
    expect(screen.queryAllByLabelText(tr("programStaffAccessCol") + ": Ana Levels")).toHaveLength(0);
    expect(screen.queryAllByRole("link", { name: tr("accessChangeOnAccount") })).toHaveLength(0);
  });
});
