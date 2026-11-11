import { afterEach, describe, expect, it, vi } from "vitest";
import { drivingMiles, hasPoint, metersToMiles, routeUrl } from "./drivingDistance.js";

afterEach(() => vi.unstubAllGlobals());

const office = { lat: 41.8205, lon: -71.4155 };
const clinic = { lat: 41.7801, lon: -71.4372 };

describe("metersToMiles", () => {
  it("rounds to a tenth and never goes below 0.1", () => {
    expect(metersToMiles(1609.344)).toBe(1);
    expect(metersToMiles(8046.72)).toBe(5);
    expect(metersToMiles(20)).toBe(0.1);
    expect(metersToMiles(NaN)).toBeNull();
  });
});

describe("routeUrl", () => {
  it("sends lon,lat pairs only", () => {
    expect(routeUrl(office, clinic)).toBe(
      "https://routing.openstreetmap.de/routed-car/route/v1/driving/-71.415500,41.820500;-71.437200,41.780100?overview=false&alternatives=false&steps=false"
    );
  });
});

describe("drivingMiles", () => {
  it("needs both points", async () => {
    vi.stubGlobal("fetch", vi.fn());
    expect(hasPoint({ lat: 1 })).toBe(false);
    expect(await drivingMiles(office, null)).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("returns the route's miles", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ code: "Ok", routes: [{ distance: 6759.24 }] }) })));
    expect(await drivingMiles(office, clinic)).toBe(4.2);
  });

  it("gives null when there's no route or the router fails", async () => {
    const far = { lat: 42.0, lon: -71.0 };
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ code: "NoRoute", routes: [] }) })));
    expect(await drivingMiles(office, far)).toBeNull();
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("offline"); }));
    expect(await drivingMiles(clinic, far)).toBeNull();
  });
});
