import { describe, expect, it } from "vitest";
import { buildResults, searchPlaceholderKey, searchScopes } from "./commandSearch.js";
import { navItemsForRole } from "./nav.js";

const data = {
  students: [{ id: "s1", nbId: "NB-1", studentId: "ST-7", firstName: "Marie", lastName: "Joseph", phone: "", classKey: "am" }],
  classes: [{ key: "am", name: "Morning ESL" }],
  caseClients: [{ id: "c1", nbId: "NB-2", firstName: "Jean", lastName: "Marie", phone: "(401) 555-0101", email: "" }],
  profiles: [{ id: "p1", name: "Marie Staff", email: "marie@nb4hs.org", role: "case_manager" }]
};
const pages = [{ key: "dashboard", label: "Dashboard", to: "/dashboard", section: "Overview" }];
const kinds = (groups) => groups.map((g) => g.key);

describe("searchScopes", () => {
  it("lets administrators search everything", () => {
    const scopes = searchScopes(navItemsForRole("administrator", [], {}), "administrator");
    expect(scopes).toEqual({ students: true, clients: true, staff: true });
    expect(searchPlaceholderKey(scopes)).toBe("cmdkPlaceholderAll");
  });

  it("never lets anyone but an administrator search staff", () => {
    expect(searchScopes(["users", "students"], "case_manager").staff).toBe(false);
  });

  it("follows the nav items: no Case Management, no client search", () => {
    const scopes = searchScopes(navItemsForRole("job_developer", [], {}), "job_developer");
    expect(scopes.clients).toBe(false);
    expect(searchPlaceholderKey(scopes)).toBe("sidebarSearchPlaceholder");
  });
});

describe("buildResults", () => {
  it("lists only pages for an empty query", () => {
    expect(kinds(buildResults({ query: "", scopes: { students: true, clients: true, staff: true }, data, pages }))).toEqual(["pages"]);
  });

  it("returns only the record types in scope", () => {
    expect(kinds(buildResults({ query: "marie", scopes: { students: true, clients: true, staff: true }, data, pages }))).toEqual(["students", "clients", "staff"]);
    expect(kinds(buildResults({ query: "marie", scopes: { students: true, clients: false, staff: false }, data, pages }))).toEqual(["students"]);
  });

  it("links records to their profile and matches clients by phone digits", () => {
    const [clients] = buildResults({ query: "555-0101", scopes: { students: false, clients: true, staff: false }, data, pages });
    expect(clients.results[0]).toMatchObject({ title: "Jean Marie", to: "/clients/NB-2" });
    const [students] = buildResults({ query: "st-7", scopes: { students: true, clients: false, staff: false }, data, pages });
    expect(students.results[0]).toMatchObject({ to: "/clients/NB-1", subtitle: "ST-7 · Morning ESL" });
    const [staff] = buildResults({ query: "marie@", scopes: { students: false, clients: false, staff: true }, data, pages });
    expect(staff.results[0]).toMatchObject({ to: "/users", state: { focusUserId: "p1" } });
  });
});
