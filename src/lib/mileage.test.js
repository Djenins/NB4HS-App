import { describe, expect, it, vi } from "vitest";
import { jsPDF } from "jspdf";

vi.mock("./supabase.js", () => ({ supabase: null }));
const {
  emptyTripForm, formToRow, frequentPlaces, monthRange, odometerMiles, orgMileageRate, reimbursement,
  rowToTrip, shiftMonth, totalMiles, tripMiles, tripToForm, validateTrip
} = await import("./mileage.js");
const { buildMileagePdf, mileagePdfName, paginate } = await import("./mileageSheet.js");

const trip = (over) => Object.assign({
  id: "t", tripDate: "2026-11-03", startLocation: "Office", destination: "Pawtucket", purpose: "SNAP help",
  miles: 6.4, roundTrip: false, odometerStart: null, odometerEnd: null, notes: ""
}, over);

describe("mileage months", () => {
  it("gives a month's first and last day, leap years included", () => {
    expect(monthRange("2026-11")).toEqual({ from: "2026-11-01", to: "2026-11-30" });
    expect(monthRange("2028-02")).toEqual({ from: "2028-02-01", to: "2028-02-29" });
  });
  it("steps across years", () => {
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
  });
});

describe("mileage totals", () => {
  it("doubles round trips and keeps one decimal", () => {
    expect(tripMiles(trip({ miles: 6.4, roundTrip: true }))).toBe(12.8);
    expect(totalMiles([trip({ miles: 0.1 }), trip({ miles: 0.2 })])).toBe(0.3);
    expect(totalMiles([])).toBe(0);
  });
  it("prices miles to the cent, or not at all without a rate", () => {
    expect(reimbursement(12.8, 0.7)).toBe(8.96);
    expect(reimbursement(100, null)).toBeNull();
    expect(orgMileageRate({ mileage_rate: 0.7 })).toBe(0.7);
    expect(orgMileageRate({ mileage_rate: "0.7" })).toBeNull();
    expect(orgMileageRate({})).toBeNull();
  });
  it("reads miles off the odometer only when the readings are in order", () => {
    expect(odometerMiles("1000", "1012")).toBe(12);
    expect(odometerMiles("1012", "1000")).toBeNull();
    expect(odometerMiles("", "1000")).toBeNull();
  });
});

describe("trip form", () => {
  it("asks for everything the table requires", () => {
    const errors = validateTrip(emptyTripForm("2026-11-03"));
    expect(Object.keys(errors).sort()).toEqual(["destination", "miles", "purpose", "startLocation"]);
  });
  it("refuses zero, too many miles and a backwards odometer", () => {
    const ok = Object.assign(emptyTripForm("2026-11-03"), { startLocation: "A", destination: "B", purpose: "C", miles: "5" });
    expect(validateTrip(ok)).toEqual({});
    expect(validateTrip(Object.assign({}, ok, { miles: "0" })).miles).toBeTruthy();
    expect(validateTrip(Object.assign({}, ok, { miles: "1000.5" })).miles).toBeTruthy();
    expect(validateTrip(Object.assign({}, ok, { odometerStart: "200", odometerEnd: "100" })).odometerEnd).toBeTruthy();
    expect(validateTrip(Object.assign({}, ok, { odometerStart: "12.5" })).odometerStart).toBeTruthy();
  });
  it("round-trips through the database row", () => {
    const form = Object.assign(emptyTripForm("2026-11-03"), {
      startLocation: " Office ", destination: "Pawtucket", purpose: "Visit", miles: "6.44", roundTrip: true, odometerStart: "100", notes: "  "
    });
    const row = formToRow(form);
    expect(row).toMatchObject({ start_location: "Office", miles: 6.4, round_trip: true, odometer_start: 100, odometer_end: null, notes: null });
    const back = tripToForm(rowToTrip(Object.assign({ id: "x", staff_id: "u" }, row)));
    expect(back).toMatchObject({ startLocation: "Office", miles: "6.4", roundTrip: true, odometerStart: "100", odometerEnd: "" });
  });
  it("suggests the places someone drives to most", () => {
    const places = frequentPlaces([trip({ destination: "Pawtucket" }), trip({ destination: "Pawtucket" }), trip({ destination: "Cranston" })]);
    expect(places[0]).toBe("Office");
    expect(places[1]).toBe("Pawtucket");
  });
});

describe("mileage sheet", () => {
  it("never splits off an empty last page", () => {
    expect(paginate(3)).toEqual([3]);
    for (let n = 1; n <= 80; n++) {
      const pages = paginate(n);
      expect(pages.reduce((a, b) => a + b, 0)).toBe(n);
      expect(pages[pages.length - 1]).toBeGreaterThan(0);
    }
  });
  it("builds a sheet with the trips and totals, and a blank one", () => {
    const trips = Array.from({ length: 30 }, (_, i) => trip({ id: "t" + i, roundTrip: i % 2 === 0 }));
    const doc = buildMileagePdf(jsPDF, { trips, month: "2026-11", staffName: "Marie Joseph", department: "SNAP Outreach", rate: 0.7, logo: null });
    expect(doc.getNumberOfPages()).toBe(paginate(30).length);
    const blank = buildMileagePdf(jsPDF, { trips: [], month: "2026-11", staffName: "", department: "", rate: null, logo: null, blank: true });
    expect(blank.getNumberOfPages()).toBe(1);
    expect(mileagePdfName({ staffName: "Marie Joseph", month: "2026-11" })).toBe("mileage-log-marie-joseph-2026-11.pdf");
  });
});

describe("emailableStaff", () => {
  it("keeps active staff with an email, the signed-in person first", async () => {
    const { emailableStaff } = await import("./mileage.js");
    const list = emailableStaff([
      { id: "b", name: "Bea", email: "bea@x.org" },
      { id: "me", name: "Zed", email: "zed@x.org" },
      { id: "c", name: "Cal", email: "" },
      { id: "d", name: "Dee", email: "dee@x.org", active: false },
      { id: "a", name: "Abe", email: "abe@x.org" }
    ], "me");
    expect(list.map((p) => p.id)).toEqual(["me", "a", "b"]);
  });
});

describe("mileageEmailError", () => {
  it("explains email that isn't set up yet", async () => {
    const { mileageEmailError } = await import("./mileage.js");
    expect(mileageEmailError("email_not_configured")).toMatch(/isn't set up/);
    expect(mileageEmailError("whatever")).toMatch(/Couldn't send/);
  });
});
