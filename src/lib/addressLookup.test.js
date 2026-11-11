import { afterEach, describe, expect, it, vi } from "vitest";
import { addressLabel, placeLabel, searchAddresses, stateCode } from "./addressLookup.js";

function mockPhoton(features, coords) {
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({
    features: features.map((p, i) => (coords ? { properties: p, geometry: { coordinates: coords[i] } } : { properties: p }))
  }) })));
}

afterEach(() => vi.unstubAllGlobals());

describe("stateCode", () => {
  it("turns full state names into USPS codes", () => {
    expect(stateCode("Rhode Island")).toBe("RI");
    expect(stateCode("massachusetts")).toBe("MA");
    expect(stateCode("CT")).toBe("CT");
    expect(stateCode("")).toBe("");
  });
});

describe("searchAddresses", () => {
  it("waits for at least 3 characters before asking", async () => {
    mockPhoton([]);
    expect(await searchAddresses("12")).toEqual([]);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("keeps the typed house number on a street-level match", async () => {
    mockPhoton([{ type: "street", name: "Elmwood Avenue", city: "Cranston", state: "Rhode Island", postcode: "02901", countrycode: "US" }]);
    const [a] = await searchAddresses("250 Elmwood");
    expect(a).toEqual({ street: "250 Elmwood Avenue", city: "Cranston", state: "RI", zip: "02901" });
    expect(addressLabel(a)).toBe("250 Elmwood Avenue, Cranston, RI 02901");
  });

  it("prefers the result's own house number, uses a shop's street, and skips non-addresses", async () => {
    mockPhoton([
      { type: "house", housenumber: "100", name: "Walgreens", street: "Broad Street", city: "Pawtucket", state: "Rhode Island", postcode: "02866", countrycode: "US" },
      { type: "other", name: "Smith Hill", city: "Providence", state: "Rhode Island", countrycode: "US" },
      { type: "street", name: "Rue Principale", city: "Montréal", countrycode: "CA" }
    ]);
    const rows = await searchAddresses("100 Broad St Pawtucket");
    expect(rows).toEqual([{ street: "100 Broad Street", city: "Pawtucket", state: "RI", zip: "02866", name: "Walgreens" }]);
    expect(placeLabel(rows[0])).toBe("Walgreens, 100 Broad Street, Pawtucket, RI 02866");
  });

  it("drops duplicate addresses", async () => {
    const dup = { type: "street", name: "Ocean Street", city: "Providence", state: "Rhode Island", postcode: "02907", countrycode: "US" };
    mockPhoton([dup, dup]);
    expect(await searchAddresses("12 Ocean St Providence x")).toHaveLength(1);
  });

  it("carries a place's map point, and no name for a street-level match", async () => {
    mockPhoton([
      { type: "other", name: "Providence Public Library", housenumber: "150", street: "Empire Street", city: "Providence", state: "Rhode Island", postcode: "02903", countrycode: "US" },
      { type: "street", name: "Chalkstone Avenue", city: "Providence", state: "Rhode Island", postcode: "02908", countrycode: "US" }
    ], [[-71.4155, 41.8205], [-71.43, 41.83]]);
    const rows = await searchAddresses("library providence");
    expect(rows[0]).toMatchObject({ name: "Providence Public Library", street: "150 Empire Street", lat: 41.8205, lon: -71.4155 });
    expect(rows[1].name).toBeUndefined();
    expect(rows[1]).toMatchObject({ street: "Chalkstone Avenue", lat: 41.83, lon: -71.43 });
  });
});
