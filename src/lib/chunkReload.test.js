import { describe, expect, it, vi } from "vitest";
import { isChunkLoadError, reloadOnceForNewDeploy } from "./chunkReload.js";

function memoryStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, v) };
}

describe("chunk reload", () => {
  it("recognises the browsers' failed-import errors", () => {
    expect(isChunkLoadError(new TypeError("Failed to fetch dynamically imported module: https://x/assets/Food-abc.js"))).toBe(true);
    expect(isChunkLoadError(new TypeError("Importing a module script failed."))).toBe(true);
    expect(isChunkLoadError(new Error("error loading dynamically imported module"))).toBe(true);
    expect(isChunkLoadError(new Error("Cannot read properties of undefined"))).toBe(false);
  });

  it("reloads once, then not again within 30 seconds", () => {
    const storage = memoryStorage();
    const reload = vi.fn();
    expect(reloadOnceForNewDeploy(storage, 1000000, reload)).toBe(true);
    expect(reloadOnceForNewDeploy(storage, 1010000, reload)).toBe(false);
    expect(reload).toHaveBeenCalledTimes(1);
    expect(reloadOnceForNewDeploy(storage, 1040001, reload)).toBe(true);
  });
});
