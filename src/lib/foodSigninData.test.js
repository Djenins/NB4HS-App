import { describe, expect, it } from "vitest";
import { eventFromRow, parseSignupLimit, signupAddress, signupFromRow, signupMatches, signupName } from "./foodSigninData.js";

const s = { firstName: "Marie", lastName: "Jean-Baptiste", phone: "(401) 555-0182", street: "12 Main St", unit: "2", city: "Providence", zip: "02905" };

describe("food sign-up helpers", () => {
  it("formats the name and address", () => {
    expect(signupName(s)).toBe("Marie Jean-Baptiste");
    expect(signupAddress(s)).toBe("12 Main St, Apt 2, Providence 02905");
    expect(signupAddress({ street: "9 Elm St", unit: "Floor 3" })).toBe("9 Elm St, Floor 3");
  });

  it("finds a client by any part of the name or by phone digits", () => {
    expect(signupMatches(s, "")).toBe(true);
    expect(signupMatches(s, "marie")).toBe(true);
    expect(signupMatches(s, "jean marie")).toBe(true);
    expect(signupMatches(s, "401-555-0182")).toBe(true);
    expect(signupMatches(s, "0182")).toBe(true);
    expect(signupMatches(s, "pierre")).toBe(false);
    expect(signupMatches(s, "999")).toBe(false);
  });

  it("reads a sign-up limit typed by staff", () => {
    expect(parseSignupLimit("")).toBe(null);
    expect(parseSignupLimit("  ")).toBe(null);
    expect(parseSignupLimit("150")).toBe(150);
    expect(parseSignupLimit("1,000")).toBe(1000);
    expect(parseSignupLimit("0")).toBe(undefined);
    expect(parseSignupLimit("10001")).toBe(undefined);
    expect(parseSignupLimit("12.5")).toBe(undefined);
    expect(parseSignupLimit("abc")).toBe(undefined);
  });

  it("maps program, limit and SNAP answers", () => {
    const ev = eventFromRow({ id: "e", occasion: "general", lang: "en", is_open: true, program: "cdbg", signup_limit: 40, is_full: true });
    expect([ev.program, ev.signupLimit, ev.isFull]).toEqual(["cdbg", 40, true]);
    expect(eventFromRow({ id: "e", occasion: "general", lang: "en", is_open: true }).program).toBe("regular");
    const su = signupFromRow({ id: "s", first_name: "A", last_name: "B", has_snap: "no", wants_snap_help: "yes", snap_task_id: "t" });
    expect([su.hasSnap, su.wantsSnapHelp, su.snapTaskId]).toEqual(["no", "yes", "t"]);
  });
});
