import { describe, expect, it, vi } from "vitest";

vi.mock("../lib/supabase.js", () => ({ supabase: null }));
const { communicationsSectionsFor } = await import("./Communications.jsx");
const { navItemsFromPermissions } = await import("../lib/modules.js");

const holding = (...keys) => (key) => keys.indexOf(key) !== -1;

describe("Communications sections", () => {
  it("gives each permission its own section, in order", () => {
    expect(communicationsSectionsFor(holding(
      "communications.view", "communications.messages.send", "communications.templates.manage", "communications.announcements.view"
    ))).toEqual(["log", "messages", "templates", "announcements"]);
  });
  it("lands someone who only reads announcements straight on them", () => {
    expect(communicationsSectionsFor(holding("communications.announcements.view"))).toEqual(["announcements"]);
    expect(communicationsSectionsFor(holding("communications.announcements.post"))).toEqual(["announcements"]);
  });
  it("shows the messages list to log readers who can't send", () => {
    expect(communicationsSectionsFor(holding("communications.view"))).toEqual(["log", "messages"]);
  });
  it("puts Communications in the sidebar for any of its permissions, and only then", () => {
    expect(navItemsFromPermissions([{ permissionKey: "communications.announcements.view" }])).toEqual(["communications"]);
    expect(navItemsFromPermissions([{ permissionKey: "calendar.view" }])).not.toContain("communications");
  });
});
