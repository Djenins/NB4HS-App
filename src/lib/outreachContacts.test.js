// Pure rules behind the SNAP contacts screens: search, the find-first client
// lookup, which consent answer is current, and who may edit -- the last two
// mirror the stage2a RLS policies and the "never message without consent" rule.
import { describe, expect, it } from "vitest";
import { contactPermissions, currentConsents, filterContacts, hasConsent, searchClients } from "./outreachContacts.js";

const contacts = [
  { id: "1", firstName: "Marie", lastName: "Joseph", nbId: "NB-00012", phone: "(401) 555-0100", email: "marie@example.org", assignedTo: "w1", status: "active" },
  { id: "2", firstName: "Jean", lastName: "Pierre", nbId: "NB-00013", phone: "", email: "", assignedTo: "w2", status: "inactive" }
];

describe("filterContacts", () => {
  it("matches name, NB ID, email and phone digits", () => {
    expect(filterContacts(contacts, { q: "marie j" }).map((c) => c.id)).toEqual(["1"]);
    expect(filterContacts(contacts, { q: "nb-00013" }).map((c) => c.id)).toEqual(["2"]);
    expect(filterContacts(contacts, { q: "@example" }).map((c) => c.id)).toEqual(["1"]);
    expect(filterContacts(contacts, { q: "5550100" }).map((c) => c.id)).toEqual(["1"]);
  });
  it("narrows to my contacts and to a status", () => {
    expect(filterContacts(contacts, { mineOnly: true, userId: "w2" }).map((c) => c.id)).toEqual(["2"]);
    expect(filterContacts(contacts, { status: "active" }).map((c) => c.id)).toEqual(["1"]);
  });
});

describe("searchClients", () => {
  const clients = contacts.map((c) => Object.assign({}, c, { id: "c" + c.id }));
  it("needs at least two characters", () => {
    expect(searchClients(clients, "m")).toEqual([]);
  });
  it("finds existing clients and caps the list", () => {
    expect(searchClients(clients, "pierre").map((c) => c.id)).toEqual(["c2"]);
    expect(searchClients(clients, "nb-000", 1)).toHaveLength(1);
  });
});

describe("consent", () => {
  const rows = [
    { channel: "sms", purpose: "appointment_reminders", status: "granted", capturedAt: "2026-10-01T10:00:00Z" },
    { channel: "sms", purpose: "appointment_reminders", status: "revoked", capturedAt: "2026-10-20T10:00:00Z" },
    { channel: "email", purpose: "program_updates", status: "granted", capturedAt: "2026-10-05T10:00:00Z" }
  ];
  it("treats the newest answer as current, whatever order rows arrive in", () => {
    const current = currentConsents(rows.slice().reverse());
    expect(current["sms:appointment_reminders"].status).toBe("revoked");
    expect(current["email:program_updates"].status).toBe("granted");
    expect(current["phone:program_updates"]).toBeUndefined();
  });
  it("allows messaging only on a current 'granted'", () => {
    expect(hasConsent(rows, "email", "program_updates")).toBe(true);
    expect(hasConsent(rows, "sms", "appointment_reminders")).toBe(false);
    expect(hasConsent(rows, "phone", "program_updates")).toBe(false);
  });
});

describe("contactPermissions", () => {
  const mine = { assignedTo: "w1" };
  it("lets a worker edit only contacts assigned to them, never reassign", () => {
    expect(contactPermissions(mine, "worker", "w1")).toEqual({ canEdit: true, canReassign: false });
    expect(contactPermissions(mine, "worker", "w2")).toEqual({ canEdit: false, canReassign: false });
  });
  it("lets supervisors and program admins edit and reassign any contact", () => {
    expect(contactPermissions(mine, "supervisor", "s1")).toEqual({ canEdit: true, canReassign: true });
    expect(contactPermissions(mine, "program_admin", "p1")).toEqual({ canEdit: true, canReassign: true });
  });
  it("gives no rights without a SNAP role", () => {
    expect(contactPermissions(mine, null, "w1")).toEqual({ canEdit: false, canReassign: false });
  });
});
