// workforceSorters.test.js -- the Workforce module's sort orders.
//
// Sorting looks too simple to test until you ask what happens to the records
// that don't fit: the opening with no posted date, the placement with no
// wage, the referral whose status isn't a known stage. Those are the cases
// below, alongside the two behaviours that are easy to mistake for accidents
// -- imported job openings pinned last whatever sort is chosen, and the two
// people-lists in this module ordering "Name A-Z" differently.
import { describe, expect, it } from "vitest";
import {
  sortCandidates, sortEmployers, sortJobClients, sortJobOpenings,
  sortPlacements, sortReferrals
} from "./workforceSorters.js";

const ids = (list) => list.map((x) => x.id);

// ------------------------------------------------------------- Job Openings

describe("sortJobOpenings", () => {
  const OPENINGS = [
    { id: "a", title: "Warehouse Associate", employerName: "Bay State", postedDate: "2026-08-01", source: "staff_added" },
    { id: "b", title: "CNA", employerName: "Hope Healthcare", postedDate: "2026-08-28", source: "direct_employer" },
    { id: "c", title: "Housekeeping", employerName: "Ocean Grove", postedDate: "2026-08-15", source: "public_job_board" },
    { id: "d", title: "Aide", employerName: "Anchor", postedDate: "", source: "staff_added" }
  ];

  it("orders by posted date, newest first", () => {
    expect(ids(sortJobOpenings(OPENINGS, "recent"))).toEqual(["b", "a", "d", "c"]);
  });
  it("orders by posted date, oldest first", () => {
    // The undated opening leads an oldest-first list -- see the note below.
    expect(ids(sortJobOpenings(OPENINGS, "oldest"))).toEqual(["d", "a", "b", "c"]);
  });
  it("orders by title and by employer alphabetically", () => {
    expect(ids(sortJobOpenings(OPENINGS, "title"))).toEqual(["d", "b", "a", "c"]);
    expect(ids(sortJobOpenings(OPENINGS, "employer"))).toEqual(["d", "a", "b", "c"]);
  });

  it("keeps imported-feed openings last under EVERY sort", () => {
    // A product rule from the module spec, not a sort option: direct-employer
    // opportunities come before imported ones. Opening "c" is the only
    // public_job_board record and is last in all four orders above.
    ["recent", "oldest", "title", "employer"].forEach((key) => {
      expect(ids(sortJobOpenings(OPENINGS, key)).pop()).toBe("c");
    });
  });
  it("still orders imported openings among themselves", () => {
    const IMPORTED = [
      { id: "x", title: "Z", postedDate: "2026-01-01", source: "public_job_board" },
      { id: "y", title: "A", postedDate: "2026-06-01", source: "government_source" }
    ];
    expect(ids(sortJobOpenings(IMPORTED, "recent"))).toEqual(["y", "x"]);
  });
  it("returns a new array and leaves the input order alone", () => {
    const before = ids(OPENINGS);
    sortJobOpenings(OPENINGS, "title");
    expect(ids(OPENINGS)).toEqual(before);
  });
  it("is stable, so equal keys keep the order the filter produced", () => {
    const SAME_DATE = [
      { id: "1", postedDate: "2026-08-01", source: "staff_added" },
      { id: "2", postedDate: "2026-08-01", source: "staff_added" },
      { id: "3", postedDate: "2026-08-01", source: "staff_added" }
    ];
    expect(ids(sortJobOpenings(SAME_DATE, "recent"))).toEqual(["1", "2", "3"]);
  });
});

// -------------------------------------------------------- Candidate Matching

describe("sortCandidates", () => {
  const ENTRIES = [
    { id: "a", score: 58, jobClient: { firstName: "Jean", lastName: "Baptiste", intakeDate: "2026-07-05" } },
    { id: "b", score: 100, jobClient: { firstName: "Marie", lastName: "Joseph", intakeDate: "2026-08-20" } },
    { id: "c", score: 30, jobClient: { firstName: "Alice", lastName: "Zephyr", intakeDate: "2026-08-28" } }
  ];
  it("orders by match score, best first", () => {
    expect(ids(sortCandidates(ENTRIES, "match"))).toEqual(["b", "a", "c"]);
  });
  it("orders by intake date both ways", () => {
    expect(ids(sortCandidates(ENTRIES, "newest"))).toEqual(["c", "b", "a"]);
    expect(ids(sortCandidates(ENTRIES, "oldest"))).toEqual(["a", "b", "c"]);
  });
  it("orders by FIRST name, because clientDisplayName is 'First Last'", () => {
    // Alice Zephyr leads despite the Z surname. Contrast sortJobClients below.
    expect(ids(sortCandidates(ENTRIES, "name"))).toEqual(["c", "a", "b"]);
  });
});

// ----------------------------------------------------------------- Referrals

describe("sortReferrals", () => {
  const REFERRALS = [
    { id: "a", participantName: "Marie Joseph", employerName: "Hope", status: "hired", referralDate: "2026-08-10" },
    { id: "b", participantName: "Jean Baptiste", employerName: "Bay State", status: "ready", referralDate: "2026-08-30" },
    { id: "c", participantName: "Rose Pierre", employerName: "Anchor", status: "interview", referralDate: "2026-08-20" }
  ];
  it("orders by referral date both ways", () => {
    expect(ids(sortReferrals(REFERRALS, "newest"))).toEqual(["b", "c", "a"]);
    expect(ids(sortReferrals(REFERRALS, "oldest"))).toEqual(["a", "c", "b"]);
  });
  it("orders by pipeline stage, not alphabetically by status", () => {
    // ready -> interview -> hired is pipeline order; alphabetically it would
    // be hired, interview, ready.
    expect(ids(sortReferrals(REFERRALS, "stage"))).toEqual(["b", "c", "a"]);
  });
  it("sorts an unrecognised status as the first stage rather than throwing", () => {
    const ODD = [{ id: "x", status: "not_a_stage" }, { id: "y", status: "hired" }];
    expect(ids(sortReferrals(ODD, "stage"))).toEqual(["x", "y"]);
  });
  it("orders by participant and by employer alphabetically", () => {
    expect(ids(sortReferrals(REFERRALS, "participant"))).toEqual(["b", "a", "c"]);
    expect(ids(sortReferrals(REFERRALS, "employer"))).toEqual(["c", "b", "a"]);
  });
});

// ---------------------------------------------------------------- Placements

describe("sortPlacements", () => {
  const PLACEMENTS = [
    { id: "a", participantName: "Marie Joseph", employerName: "Hope", startDate: "2026-08-20", hourlyWage: 21 },
    { id: "b", participantName: "Jean Baptiste", employerName: "Bay State", startDate: "2026-07-10", hourlyWage: 17.5 },
    { id: "c", participantName: "Rose Pierre", employerName: "Anchor", startDate: "2026-01-15", hourlyWage: null }
  ];
  it("orders by start date both ways", () => {
    expect(ids(sortPlacements(PLACEMENTS, "newest"))).toEqual(["a", "b", "c"]);
    expect(ids(sortPlacements(PLACEMENTS, "oldest"))).toEqual(["c", "b", "a"]);
  });
  it("orders by wage, highest first, with no wage recorded at the bottom", () => {
    expect(ids(sortPlacements(PLACEMENTS, "wage"))).toEqual(["a", "b", "c"]);
  });
  it("treats an unparseable wage as no wage rather than as NaN", () => {
    // NaN comparisons return false in both directions and would leave the
    // order undefined; `|| 0` keeps it at the bottom deterministically.
    const ODD = [{ id: "x", hourlyWage: "not a number" }, { id: "y", hourlyWage: 12 }];
    expect(ids(sortPlacements(ODD, "wage"))).toEqual(["y", "x"]);
  });
  it("orders by participant and by employer alphabetically", () => {
    expect(ids(sortPlacements(PLACEMENTS, "participant"))).toEqual(["b", "a", "c"]);
    expect(ids(sortPlacements(PLACEMENTS, "employer"))).toEqual(["c", "b", "a"]);
  });
});

// ----------------------------------------------------------------- Employers

describe("sortEmployers", () => {
  const EMPLOYERS = [
    { id: "e1", businessName: "Hope Healthcare", partnerSince: "2025-03-01", lastMeetingDate: "2026-08-28" },
    { id: "e2", businessName: "Bay State Logistics", partnerSince: "2026-01-15", lastMeetingDate: "2026-07-20" },
    { id: "e3", businessName: "Ocean Grove Hotel", partnerSince: "", lastMeetingDate: "" }
  ];
  const COUNTS = { e1: 2, e2: 5 };

  it("orders by business name both ways", () => {
    expect(ids(sortEmployers(EMPLOYERS, "name_az", COUNTS))).toEqual(["e2", "e1", "e3"]);
    expect(ids(sortEmployers(EMPLOYERS, "name_za", COUNTS))).toEqual(["e3", "e1", "e2"]);
  });
  it("orders by newest partner and by most recent contact", () => {
    expect(ids(sortEmployers(EMPLOYERS, "newest_partner", COUNTS))).toEqual(["e2", "e1", "e3"]);
    expect(ids(sortEmployers(EMPLOYERS, "last_contact", COUNTS))).toEqual(["e1", "e2", "e3"]);
  });
  it("orders by a count map rather than a record field", () => {
    expect(ids(sortEmployers(EMPLOYERS, "open_positions", COUNTS))).toEqual(["e2", "e1", "e3"]);
  });
  it("treats an employer missing from the count map as zero", () => {
    expect(ids(sortEmployers(EMPLOYERS, "open_positions", {}))).toEqual(["e1", "e2", "e3"]);
    expect(ids(sortEmployers(EMPLOYERS, "open_positions", undefined))).toEqual(["e1", "e2", "e3"]);
  });
  it("puts an employer with no partner-since date last under newest-partner", () => {
    expect(ids(sortEmployers(EMPLOYERS, "newest_partner", COUNTS)).pop()).toBe("e3");
  });
});

// ------------------------------------------------------- Job Developer caseload

describe("sortJobClients", () => {
  const CLIENTS = [
    { id: "a", firstName: "Marie", lastName: "Joseph", intakeDate: "2026-08-20", pipelineStage: "applying" },
    { id: "b", firstName: "Jean", lastName: "Baptiste", intakeDate: "2026-07-05", pipelineStage: "interview" },
    { id: "c", firstName: "Alice", lastName: "Zephyr", intakeDate: "2026-08-28", pipelineStage: "resume" }
  ];
  it("orders by LAST name, the way the rest of the app orders people", () => {
    // Baptiste, Joseph, Zephyr. Note this is the OPPOSITE convention from
    // sortCandidates above, which orders by first name -- two lists of people
    // in one module answering "Name A-Z" differently. Pinned here so the
    // discrepancy is visible and any decision to unify them is deliberate.
    expect(ids(sortJobClients(CLIENTS, "name_az"))).toEqual(["b", "a", "c"]);
  });
  it("reverses that same order for Z-A rather than collating separately", () => {
    expect(ids(sortJobClients(CLIENTS, "name_za"))).toEqual(["c", "a", "b"]);
  });
  it("orders by intake date both ways", () => {
    expect(ids(sortJobClients(CLIENTS, "newest_intake"))).toEqual(["c", "a", "b"]);
    expect(ids(sortJobClients(CLIENTS, "oldest_intake"))).toEqual(["b", "a", "c"]);
  });
  it("orders by pipeline stage, not alphabetically", () => {
    // resume -> applying -> interview is pipeline order.
    expect(ids(sortJobClients(CLIENTS, "stage"))).toEqual(["c", "a", "b"]);
  });
  it("does not mutate the caller's array, including on the name path", () => {
    const before = ids(CLIENTS);
    sortJobClients(CLIENTS, "name_za");
    sortJobClients(CLIENTS, "newest_intake");
    expect(ids(CLIENTS)).toEqual(before);
  });
});

// --------------------------------------------------------- shared behaviours

describe("undated records", () => {
  it("sort last under newest-first and first under oldest-first", () => {
    // Not a bug so much as what comparing "" does, but it is a real
    // asymmetry: an undated record leads an "oldest first" list. Pinned so a
    // decision to change it has to be made on purpose.
    const LIST = [{ id: "dated", startDate: "2026-01-01" }, { id: "undated", startDate: "" }];
    expect(ids(sortPlacements(LIST, "newest"))).toEqual(["dated", "undated"]);
    expect(ids(sortPlacements(LIST, "oldest"))).toEqual(["undated", "dated"]);
  });
});

describe("every sorter", () => {
  // Each entry carries its own record factory, because candidate entries are
  // the { jobClient, score } shape rather than a bare record -- leaving them
  // out of these shared checks is exactly how sortCandidates escaped the
  // non-mutation assertion until mutation-testing caught it.
  const plain = (id) => ({ id: id });
  const candidate = (id) => ({ id: id, score: Number(id), jobClient: { firstName: "F" + id, lastName: "L" + id, intakeDate: "2026-01-0" + id } });
  const CASES = [
    ["sortJobOpenings", sortJobOpenings, ["recent", "oldest", "title", "employer"], undefined, plain],
    ["sortCandidates", sortCandidates, ["match", "name", "newest", "oldest"], undefined, candidate],
    ["sortReferrals", sortReferrals, ["newest", "oldest", "stage", "participant", "employer"], undefined, plain],
    ["sortPlacements", sortPlacements, ["newest", "oldest", "participant", "employer", "wage"], undefined, plain],
    ["sortEmployers", sortEmployers, ["name_az", "name_za", "newest_partner", "last_contact", "open_positions"], {}, plain],
    ["sortJobClients", sortJobClients, ["name_az", "name_za", "newest_intake", "oldest_intake", "stage"], undefined, plain]
  ];

  function eachOption(fn) {
    CASES.forEach(function (c) {
      c[2].forEach(function (key) { fn(c[1], key, c[3], c[4], c[0] + ":" + key); });
    });
  }

  it("handles an empty list and a missing list for every option", () => {
    eachOption(function (fn, key, ctx) {
      expect(fn([], key, ctx)).toEqual([]);
      expect(fn(undefined, key, ctx)).toEqual([]);
    });
  });

  it("never mutates the caller's array", () => {
    // Found by mutation-testing: non-mutation was only asserted on two of the
    // six sorters, so dropping .slice() elsewhere went unnoticed. The pages
    // render from the returned list while the filtered list stays as it was,
    // so a sorter reaching back into its input would reorder someone else's
    // data.
    eachOption(function (fn, key, ctx, make, label) {
      const input = [make("3"), make("1"), make("2")];
      const before = ids(input);
      const out = fn(input, key, ctx);
      expect(ids(input), label).toEqual(before);
      expect(out, label).not.toBe(input);
    });
  });

  it("returns every input record exactly once", () => {
    eachOption(function (fn, key, ctx, make, label) {
      const out = fn([make("1"), make("2"), make("3")], key, ctx);
      expect(out, label).toHaveLength(3);
      expect(ids(out).slice().sort(), label).toEqual(["1", "2", "3"]);
    });
  });
});
