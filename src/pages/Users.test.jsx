// Users.test.jsx -- arriving from a staff result in the ⌘K search
// (location.state.focusUserId) pages to that person's row and highlights it.
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { t as translate } from "../lib/i18n.js";

// 12 staff, so with 10 per page the last two sit on page 2.
const profiles = Array.from({ length: 12 }, (_, i) => ({
  id: "u" + i, name: "Staff " + String(i).padStart(2, "0"), email: "staff" + i + "@example.test", role: "staff", active: i !== 11
}));

vi.mock("../context/AppContext.jsx", () => ({
  useApp: () => ({ data: { profiles }, lang: "en", session: { currentUserEmail: "staff0@example.test" }, showToast: vi.fn() }),
  useT: () => (key) => translate(key, "en")
}));

import Users from "./Users.jsx";

function renderAt(state) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: "/users", state }]}>
      <Routes><Route path="/users" element={<Users />} /></Routes>
    </MemoryRouter>
  );
}

describe("Users focus from search", () => {
  it("pages to the person's row, highlights it and moves focus there", () => {
    renderAt({ focusUserId: "u11" });
    const row = screen.getByText("Staff 11").closest("tr");
    expect(row).toHaveClass("bg-primary-tint");
    expect(document.activeElement).toBe(row);
    expect(screen.queryByText("Staff 00")).not.toBeInTheDocument();
  });

  it("opens on the first page with nothing highlighted otherwise", () => {
    renderAt(undefined);
    expect(screen.getByText("Staff 00")).toBeInTheDocument();
    expect(document.querySelector("tr.bg-primary-tint")).toBeNull();
  });
});
