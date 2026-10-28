// MyReportsAction.test.jsx -- My Reports offers to start a report only once
// its period has begun; the database refuses earlier ones (t4).
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("../context/AppContext.jsx", () => ({ useApp: () => ({ lang: "en" }), useT: () => (k) => k }));
vi.mock("../lib/supabase.js", () => ({ supabase: null }));

import { ActionFor } from "./MyReports.jsx";

const t = (k) => k;
const row = { periodId: "p1", reportId: null, status: "not_started" };

describe("ActionFor", () => {
  it("offers to start a report in a period that has begun", () => {
    render(<ActionFor row={row} onCreate={() => {}} onOpen={() => {}} busy={false} t={t} />);
    expect(screen.getByRole("button", { name: /srCreateReport/ })).toBeInTheDocument();
  });
  it("offers nothing before the period begins", () => {
    const { container } = render(<ActionFor row={row} onCreate={() => {}} onOpen={() => {}} busy={false} t={t} notStarted />);
    expect(container).toBeEmptyDOMElement();
  });
  it("still opens an existing draft", () => {
    render(<ActionFor row={{ ...row, reportId: "r1", status: "draft" }} onCreate={() => {}} onOpen={() => {}} busy={false} t={t} notStarted />);
    expect(screen.getByRole("button", { name: /srContinueDraft/ })).toBeInTheDocument();
  });
});
