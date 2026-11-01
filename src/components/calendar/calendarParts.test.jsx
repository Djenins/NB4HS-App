// The calendar pieces batch 3f moved onto shared components: the load-error
// state (its icon used to be invisible, tint on tint), the month view's
// phone list, and the tone each event kind draws with.
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CalendarError } from "./CalendarStatus.jsx";
import AgendaView from "./AgendaView.jsx";
import { blockStyle, FILTERS, KIND_STYLE } from "./kindStyle.js";

const t = (key) => key;

describe("CalendarError", () => {
  it("is an alert whose icon sits on the danger chip, with a working retry", () => {
    const onRetry = vi.fn();
    const { container } = render(<CalendarError t={t} onRetry={onRetry} />);
    expect(screen.getByRole("alert")).toHaveTextContent("calendarLoadError");
    const disc = container.querySelector("svg").parentElement;
    expect(disc.className).toContain("bg-tone-danger-chip");
    expect(disc.className).toContain("text-tone-danger-ink");
    fireEvent.click(screen.getByRole("button", { name: /calendarRetry/ }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});

describe("AgendaView skipEmpty", () => {
  const day = (dateStr, blocks) => ({ date: new Date(dateStr + "T00:00:00"), dateStr, blocks });
  const busy = day("2026-10-26", [{ key: "a", kind: "visit", title: "Intake", startTime: "10:00", endTime: "11:00" }]);
  const empty = day("2026-10-27", []);
  const holiday = day("2026-10-12", []);

  it("lists only days with an event or a holiday", () => {
    render(<AgendaView dayBlocks={[holiday, busy, empty]} skipEmpty todayStr="2026-10-30" holidaysByDate={{ "2026-10-12": { name: "Indigenous Peoples' Day" } }} t={t} onOpenEvent={() => {}} />);
    expect(screen.getAllByRole("heading", { level: 2 })).toHaveLength(2);
    expect(screen.getByText("Intake")).toBeInTheDocument();
    expect(screen.getByText("Indigenous Peoples' Day")).toBeInTheDocument();
    // The holiday has no events of its own, so it says so; the empty
    // weekday is gone.
    expect(screen.getAllByText("calendarNoEvents")).toHaveLength(1);
  });

  it("keeps empty days without it", () => {
    render(<AgendaView dayBlocks={[busy, empty]} todayStr="2026-10-30" holidaysByDate={{}} t={t} onOpenEvent={() => {}} />);
    expect(screen.getAllByRole("heading", { level: 2 })).toHaveLength(2);
    expect(screen.getByText("calendarNoEvents")).toBeInTheDocument();
  });

  it("sets times in tabular figures", () => {
    render(<AgendaView dayBlocks={[busy]} todayStr="2026-10-30" holidaysByDate={{}} t={t} onOpenEvent={() => {}} />);
    expect(screen.getByText("10:00 – 11:00 AM").className).toContain("tabular-nums");
  });
});

describe("kind tones", () => {
  it("draws each kind from its design-system tone", () => {
    expect(KIND_STYLE.class.tone).toBe("info");
    expect(KIND_STYLE.visit.tone).toBe("success");
    expect(KIND_STYLE.appointment.tone).toBe("violet");
    expect(KIND_STYLE.holiday.tone).toBe("danger");
    expect(blockStyle({ kind: "visit" }).cardBg).toBe("bg-tone-success-bg");
    expect(FILTERS.map((f) => f.style && f.style.tone)).toEqual([null, "info", "success", "violet", "danger"]);
  });
});
