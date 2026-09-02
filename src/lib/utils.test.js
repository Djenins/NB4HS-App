import { describe, expect, it } from "vitest";
import {
  csvEscape, escapeHtml, formatAddress, formatPhone, fmtDuration, fmtTime,
  genStudentId, initialsOf, minutesBetween, pad2, parseCSVText, slugify
} from "./utils.js";

describe("pad2", () => {
  it("left-pads single digits", () => { expect(pad2(5)).toBe("05"); });
  it("leaves two-digit numbers alone", () => { expect(pad2(12)).toBe("12"); });
});

describe("slugify", () => {
  it("lowercases and replaces non-alphanumerics with underscores", () => {
    expect(slugify("Adult Education!")).toBe("adult_education");
  });
  it("trims leading/trailing underscores", () => {
    expect(slugify("--Hello--")).toBe("hello");
  });
  it("falls back to \"item\" for empty input", () => {
    expect(slugify("")).toBe("item");
    expect(slugify(undefined)).toBe("item");
  });
});

describe("genStudentId", () => {
  it("formats as NB-##### with zero-padding", () => {
    expect(genStudentId(1)).toBe("NB-00001");
    expect(genStudentId(42)).toBe("NB-00042");
    expect(genStudentId(100000)).toBe("NB-00000");
  });
});

describe("formatPhone", () => {
  it("formats a full 10-digit number", () => {
    expect(formatPhone("4015551234")).toBe("(401) 555-1234");
  });
  it("formats partial input as the user types", () => {
    expect(formatPhone("401")).toBe("(401");
    expect(formatPhone("4015")).toBe("(401) 5");
  });
  it("strips non-digit characters and caps at 10 digits", () => {
    expect(formatPhone("(401) 555-1234 ext 9")).toBe("(401) 555-1234");
  });
  it("returns empty string for empty/undefined input", () => {
    expect(formatPhone("")).toBe("");
    expect(formatPhone(undefined)).toBe("");
  });
});

describe("minutesBetween", () => {
  it("computes whole minutes between two ISO timestamps", () => {
    expect(minutesBetween("2024-01-01T09:00:00Z", "2024-01-01T09:30:00Z")).toBe(30);
  });
  it("returns null when either timestamp is missing", () => {
    expect(minutesBetween(null, "2024-01-01T09:30:00Z")).toBeNull();
    expect(minutesBetween("2024-01-01T09:00:00Z", null)).toBeNull();
  });
});

describe("fmtDuration", () => {
  it("renders minutes-only durations under an hour", () => {
    expect(fmtDuration(45, "en")).toBe("45 min");
  });
  it("renders hours and minutes", () => {
    expect(fmtDuration(90, "en")).toBe("1 hr 30 min");
  });
  it("returns an em dash for null/undefined", () => {
    expect(fmtDuration(null, "en")).toBe("—");
    expect(fmtDuration(undefined, "en")).toBe("—");
  });
});

describe("fmtTime", () => {
  it("returns an em dash for a missing timestamp", () => {
    expect(fmtTime(null)).toBe("—");
  });
  it("formats to 12-hour clock with AM/PM", () => {
    // Use a timestamp with an explicit local-time-independent offset check:
    // just assert the shape rather than pinning to the runner's timezone.
    expect(fmtTime("2024-06-01T09:05:00")).toMatch(/^\d{1,2}:\d{2} (AM|PM)$/);
  });
});

describe("csvEscape", () => {
  it("leaves plain values alone", () => { expect(csvEscape("hello")).toBe("hello"); });
  it("quotes values containing commas", () => { expect(csvEscape("Smith, John")).toBe('"Smith, John"'); });
  it("escapes embedded quotes by doubling them", () => { expect(csvEscape('He said "hi"')).toBe('"He said ""hi"""'); });
  it("treats null/undefined as empty string", () => { expect(csvEscape(null)).toBe(""); expect(csvEscape(undefined)).toBe(""); });
});

describe("parseCSVText", () => {
  it("splits simple comma-separated rows", () => {
    expect(parseCSVText("a,b,c\n1,2,3")).toEqual([["a", "b", "c"], ["1", "2", "3"]]);
  });
  it("handles quoted fields containing commas", () => {
    expect(parseCSVText('"Smith, John",30')).toEqual([["Smith, John", "30"]]);
  });
  it("handles doubled quotes inside a quoted field", () => {
    expect(parseCSVText('"She said ""hi""",ok')).toEqual([['She said "hi"', "ok"]]);
  });
  it("skips blank lines", () => {
    expect(parseCSVText("a,b\n\n1,2")).toEqual([["a", "b"], ["1", "2"]]);
  });
});

describe("escapeHtml", () => {
  it("escapes the five reserved characters", () => {
    expect(escapeHtml(`<a href="x">'&'</a>`)).toBe("&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;");
  });
  it("treats null/undefined as empty string", () => {
    expect(escapeHtml(null)).toBe("");
    expect(escapeHtml(undefined)).toBe("");
  });
});

describe("initialsOf", () => {
  it("combines first initials of first/last name", () => {
    expect(initialsOf({ firstName: "Jane", lastName: "Doe" })).toBe("JD");
  });
  it("falls back to a question mark when both names are missing", () => {
    expect(initialsOf({})).toBe("?");
    expect(initialsOf(null)).toBe("?");
  });
});

describe("formatAddress", () => {
  it("joins street/city/state/zip into one line", () => {
    expect(formatAddress({ street: "1 Main St", city: "Providence", zip: "02903" }))
      .toBe("1 Main St, Providence, RI 02903");
  });
  it("returns empty string when no address fields are present", () => {
    expect(formatAddress({})).toBe("");
    expect(formatAddress(null)).toBe("");
  });
});
