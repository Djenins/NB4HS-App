// accessLevels.test.js -- reading levels from permissions, and the account
// type kept in step with them (mirrors access_levels_account_type() in a1).
import { describe, expect, it } from "vitest";
import {
  MARKER_KEYS, accessForAccountType, accessFromPermissionRows, accessSummary, accountTypeForAccess, emptyAccess,
  hasAnyAccess, sameAccess
} from "./accessLevels.js";

const row = (k, p) => ({ user_id: "u", permission_key: k, program_key: p || "" });
const withLevels = (levels, extra) => Object.assign(emptyAccess(), extra || {}, { levels: Object.assign(emptyAccess().levels, levels) });

describe("accessFromPermissionRows", () => {
  it("reads Staff, Manager, Front desk and Administrator per person", () => {
    const out = accessFromPermissionRows([
      row("case_management.view", "case_management"), row("case_management.reports.view", "case_management"),
      row("students.view", "students"),
      row("front_desk.checkin"), row("admin.permissions.assign"),
      { user_id: "v", permission_key: "snap.view", program_key: "snap" }
    ]);
    expect(out.u.levels).toEqual({ case_management: "manager", students: "staff", workforce: "none", food_distribution: "none", snap: "none" });
    expect(out.u.frontDesk).toBe(true);
    expect(out.u.admin).toBe(true);
    expect(out.v.levels.snap).toBe("staff");
    expect(out.v.frontDesk).toBe(false);
  });

  it("only counts a permission in its own program", () => {
    const out = accessFromPermissionRows([row("students.view", "workforce")]);
    expect(out.u.levels.students).toBe("none");
  });

  it("asks only for the permissions it reads", () => {
    expect(MARKER_KEYS).toContain("front_desk.checkin");
    expect(MARKER_KEYS).toContain("students.delete");
    expect(MARKER_KEYS).toHaveLength(12);
  });
});

describe("accountTypeForAccess", () => {
  it("follows the order the database uses", () => {
    expect(accountTypeForAccess(withLevels({ students: "staff" }, { admin: true }))).toBe("administrator");
    expect(accountTypeForAccess(withLevels({ case_management: "staff", workforce: "manager" }))).toBe("case_manager");
    expect(accountTypeForAccess(withLevels({ workforce: "staff" }))).toBe("job_developer");
    expect(accountTypeForAccess(withLevels({ students: "manager" }, { frontDesk: true }))).toBe("staff");
    expect(accountTypeForAccess(withLevels({}, { frontDesk: true }))).toBe("receptionist");
    expect(accountTypeForAccess(emptyAccess())).toBe("staff");
  });
});

describe("accessForAccountType", () => {
  it("gives what each account type gives today", () => {
    expect(accessForAccountType("receptionist")).toEqual(withLevels({}, { frontDesk: true }));
    expect(accessForAccountType("staff").levels.food_distribution).toBe("staff");
    const admin = accessForAccountType("administrator");
    expect(admin.admin).toBe(true);
    expect(admin.levels.snap).toBe("none"); // administrators hold no SNAP case data
    expect(accessForAccountType("nonsense")).toEqual(emptyAccess());
  });
});

describe("summary and comparison", () => {
  it("lists programs in order, then Front desk, then Administrator", () => {
    const a = withLevels({ snap: "staff", case_management: "manager" }, { frontDesk: true, admin: true });
    expect(accessSummary(a).map((p) => p.key)).toEqual(["case_management", "snap", "frontDesk", "admin"]);
    expect(accessSummary(emptyAccess())).toEqual([]);
    expect(hasAnyAccess(emptyAccess())).toBe(false);
    expect(hasAnyAccess(a)).toBe(true);
  });

  it("compares levels and switches", () => {
    expect(sameAccess(withLevels({ students: "staff" }), withLevels({ students: "staff" }))).toBe(true);
    expect(sameAccess(withLevels({ students: "staff" }), withLevels({ students: "manager" }))).toBe(false);
    expect(sameAccess(emptyAccess(), withLevels({}, { frontDesk: true }))).toBe(false);
    expect(sameAccess(null, emptyAccess())).toBe(false);
  });
});
