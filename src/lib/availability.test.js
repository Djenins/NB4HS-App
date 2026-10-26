import { describe, expect, it } from "vitest";
import { cellKey, cellsToRanges, fmtSlotTime, rangesToCells } from "./availability.js";

describe("availability cells <-> ranges", () => {
  it("merges back-to-back 30-minute blocks into one range per stretch", () => {
    const cells = new Set([cellKey(1, 540), cellKey(1, 570), cellKey(1, 600), cellKey(1, 720), cellKey(3, 840)]);
    expect(cellsToRanges(cells)).toEqual([
      { weekday: 1, start_time: "09:00", end_time: "10:30" },
      { weekday: 1, start_time: "12:00", end_time: "12:30" },
      { weekday: 3, start_time: "14:00", end_time: "14:30" }
    ]);
  });

  it("round-trips ranges through cells", () => {
    const ranges = [{ weekday: 0, start_time: "13:00", end_time: "15:00" }, { weekday: 5, start_time: "09:30", end_time: "10:00" }];
    expect(cellsToRanges(rangesToCells(ranges))).toEqual(ranges);
    expect(rangesToCells(ranges).size).toBe(5);
  });

  it("returns nothing for an empty calendar", () => {
    expect(cellsToRanges(new Set())).toEqual([]);
  });
});

describe("fmtSlotTime", () => {
  it("formats 24-hour slot times for people", () => {
    expect(fmtSlotTime("09:30")).toBe("9:30 AM");
    expect(fmtSlotTime("12:00")).toBe("12:00 PM");
    expect(fmtSlotTime("15:00")).toBe("3:00 PM");
  });
});
