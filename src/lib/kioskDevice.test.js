import { beforeEach, describe, expect, it } from "vitest";
import {
  forgetKioskDeviceKey, isKioskPaired, kioskDeviceKey, markMyVisitOut, myVisits, rememberMyVisit, saveKioskDeviceKey
} from "./kioskDevice.js";

// Node's own experimental localStorage shadows jsdom's here, so give each
// test a plain in-memory one.
beforeEach(() => {
  const store = new Map();
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => { store.set(k, String(v)); },
      removeItem: (k) => { store.delete(k); },
      clear: () => store.clear()
    }
  });
});

describe("kiosk device key", () => {
  it("is unpaired until a well-formed key is saved", () => {
    expect(isKioskPaired()).toBe(false);
    saveKioskDeviceKey("not-a-key");
    expect(kioskDeviceKey()).toBe(null);
    const key = "ab".repeat(32);
    saveKioskDeviceKey(key);
    expect(kioskDeviceKey()).toBe(key);
    forgetKioskDeviceKey();
    expect(isKioskPaired()).toBe(false);
  });
});

describe("a phone's own visits", () => {
  it("remembers a visit once and marks it checked out", () => {
    const visit = { id: "v1", firstName: "Ana", lastName: "Pierre", date: "2026-11-01", timeIn: new Date().toISOString() };
    rememberMyVisit(visit);
    rememberMyVisit(visit);
    expect(myVisits()).toHaveLength(1);
    expect(myVisits()[0].timeOut).toBe(null);
    markMyVisitOut("v1", "2026-11-01T15:00:00Z");
    expect(myVisits()[0].timeOut).toBe("2026-11-01T15:00:00Z");
  });

  it("drops visits older than a day and a half", () => {
    rememberMyVisit({ id: "old", firstName: "Old", timeIn: new Date(Date.now() - 40 * 3600 * 1000).toISOString() });
    rememberMyVisit({ id: "new", firstName: "New", timeIn: new Date().toISOString() });
    expect(myVisits().map((v) => v.id)).toEqual(["new"]);
  });
});
