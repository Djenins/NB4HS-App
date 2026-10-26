// Intake forms read and save through client_intakes (S8), and fall back to
// the old columns on clients while that table doesn't exist yet, so the app
// works on either side of the p3c migration.
import { beforeEach, describe, expect, it, vi } from "vitest";

const calls = [];
let intakeResult;
let upsertResult;
const chain = (result) => {
  const q = {
    select: () => q, eq: () => q, maybeSingle: async () => result, single: async () => result,
    upsert: (row) => { calls.push(["upsert", row]); return q; },
    update: (row) => { calls.push(["update", row]); return q; }
  };
  return q;
};
vi.mock("./supabase.js", () => ({
  supabase: {
    from: (table) => {
      calls.push(["from", table]);
      if (table === "client_intakes") return chain(calls.some((c) => c[0] === "upsert-mode") ? upsertResult : intakeResult);
      return chain({ data: { id: "c1", intake_form: { a: 1 }, intake_form_saved_at: "2026-10-26T00:00:00Z" }, error: null });
    }
  }
}));
const { fetchClientIntake, saveClientIntake } = await import("./clientsData.js");

const MISSING = { code: "PGRST205", message: "Could not find the table 'public.client_intakes' in the schema cache" };

beforeEach(() => { calls.length = 0; });

describe("client intake", () => {
  it("reads the saved form", async () => {
    intakeResult = { data: { form: { gender: "Female" }, saved_at: "2026-10-26T12:00:00Z" }, error: null };
    expect(await fetchClientIntake("c1")).toEqual({ form: { gender: "Female" }, savedAt: "2026-10-26T12:00:00Z" });
  });

  it("says when there is no form, and when the table isn't there yet", async () => {
    intakeResult = { data: null, error: null };
    expect(await fetchClientIntake("c1")).toBeNull();
    intakeResult = { data: null, error: MISSING };
    expect(await fetchClientIntake("c1")).toEqual({ useClientRecord: true });
  });

  it("saves to client_intakes", async () => {
    calls.push(["upsert-mode"]);
    upsertResult = { data: { saved_at: "2026-10-26T13:00:00Z" }, error: null };
    expect(await saveClientIntake("c1", { gender: "Male" })).toBe("2026-10-26T13:00:00Z");
    const up = calls.find((c) => c[0] === "upsert");
    expect(up[1].client_id).toBe("c1");
    expect(up[1].form).toEqual({ gender: "Male" });
    expect(calls.some((c) => c[0] === "update")).toBe(false);
  });

  it("falls back to the client record before the migration", async () => {
    calls.push(["upsert-mode"]);
    upsertResult = { data: null, error: MISSING };
    await saveClientIntake("c1", { gender: "Male" });
    const update = calls.find((c) => c[0] === "update");
    expect(update[1].intake_form).toEqual({ gender: "Male" });
  });

  it("does not hide a refusal behind the fallback", async () => {
    calls.push(["upsert-mode"]);
    upsertResult = { data: null, error: { code: "42501", message: "new row violates row-level security policy" } };
    await expect(saveClientIntake("c1", {})).rejects.toMatchObject({ code: "42501" });
    expect(calls.some((c) => c[0] === "update")).toBe(false);
  });
});
