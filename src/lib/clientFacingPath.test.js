import { describe, expect, it } from "vitest";
import { isClientFacingPath } from "./i18n.js";

describe("isClientFacingPath", () => {
  it("treats the public and kiosk screens as client-facing", () => {
    ["/kiosk", "/checkin", "/checkin/visitor", "/checkout", "/checkout/scan-success", "/appointments/request",
      "/appointments/lookup", "/register", "/register/success", "/unsubscribe", "/food-signup/abc", "/f/7kq2m"].forEach((p) => expect(isClientFacingPath(p)).toBe(true));
  });

  it("keeps every staff screen English-only", () => {
    ["/", "/dashboard", "/casemanagement/clients", "/students/classrooms", "/staff-login", "/settings", "/registerx", "/checkins", "/food/distributions"]
      .forEach((p) => expect(isClientFacingPath(p)).toBe(false));
  });
});
