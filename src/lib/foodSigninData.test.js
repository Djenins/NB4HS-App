import { describe, expect, it } from "vitest";
import { signupAddress, signupMatches, signupName } from "./foodSigninData.js";

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
});
