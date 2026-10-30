import { describe, expect, it, vi } from "vitest";
import { checkOutInOrder, keepOnFailure } from "./kioskSync.js";

describe("keepOnFailure", () => {
  it("passes a list through, including an empty one", () => {
    const set = vi.fn();
    keepOnFailure(set)([{ id: "a" }]);
    keepOnFailure(set)([]);
    expect(set.mock.calls).toEqual([[[{ id: "a" }]], [[]]]);
  });

  it("leaves the state alone when the fetch failed (null)", () => {
    const set = vi.fn();
    keepOnFailure(set)(null);
    expect(set).not.toHaveBeenCalled();
  });
});

describe("checkOutInOrder", () => {
  it("checks visits out one at a time, never two at once", async () => {
    let inFlight = 0;
    let most = 0;
    const checkOut = vi.fn(async () => {
      inFlight += 1; most = Math.max(most, inFlight);
      await new Promise((r) => setTimeout(r, 1));
      inFlight -= 1;
    });
    await expect(checkOutInOrder([{ id: "1" }, { id: "2" }, { id: "3" }], checkOut)).resolves.toBe(3);
    expect(checkOut.mock.calls.map((c) => c[0])).toEqual(["1", "2", "3"]);
    expect(most).toBe(1);
  });

  it("stops at the first refusal (e.g. HTTP 429) and leaves the rest for the next sweep", async () => {
    const checkOut = vi.fn()
      .mockResolvedValueOnce(null)
      .mockRejectedValueOnce(Object.assign(new Error("Too many requests"), { code: "PT429" }))
      .mockResolvedValue(null);
    await expect(checkOutInOrder([{ id: "1" }, { id: "2" }, { id: "3" }], checkOut)).resolves.toBe(1);
    expect(checkOut).toHaveBeenCalledTimes(2);
  });
});
