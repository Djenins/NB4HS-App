// notificationsData.test.js -- the bell's list is bounded: newest first,
// at most NOTIFICATION_LIMIT rows, so a realtime refetch stays small.
import { describe, expect, it, vi } from "vitest";

const calls = [];
function chain() {
  const q = {};
  ["select", "eq", "order", "limit"].forEach((m) => {
    q[m] = (...args) => { calls.push([m, ...args]); return m === "limit" ? Promise.resolve({ data: [], error: null }) : q; };
  });
  return q;
}
vi.mock("./supabase.js", () => ({ supabase: { from: () => chain() } }));

import { NOTIFICATION_LIMIT, fetchNotifications } from "./notificationsData.js";

describe("fetchNotifications", () => {
  it("asks for the newest rows only, capped", async () => {
    await fetchNotifications("u1");
    expect(calls).toContainEqual(["order", "created_at", { ascending: false }]);
    expect(calls).toContainEqual(["limit", NOTIFICATION_LIMIT]);
    expect(NOTIFICATION_LIMIT).toBe(50);
  });
});
