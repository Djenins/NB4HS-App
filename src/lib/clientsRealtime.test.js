import { describe, expect, it, vi } from "vitest";

const names = [];
vi.mock("./supabase.js", () => {
  const channel = (name) => {
    names.push(name);
    const ch = { on: () => ch, subscribe: () => ch };
    return ch;
  };
  return { supabase: { channel, removeChannel: vi.fn() } };
});

const { subscribeClientsTable } = await import("./clientsData.js");

describe("subscribeClientsTable", () => {
  it("opens a separate channel each time, even for the same table", () => {
    const a = subscribeClientsTable("food_signups", () => {});
    const b = subscribeClientsTable("food_signups", () => {});
    expect(names).toHaveLength(2);
    expect(names[0]).not.toBe(names[1]);
    expect(names.every((n) => n.startsWith("food_signups-"))).toBe(true);
    a(); b();
  });
});
