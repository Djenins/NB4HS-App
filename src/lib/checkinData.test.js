// Pins the kiosk's data paths to the stage0a kiosk_* RPCs: the
// anonymous kiosk has no table access to visits/students any more, so these
// must never fall back to supabase.from("visits"/"students").
import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
const from = vi.fn();
vi.mock("./supabase.js", () => ({ supabase: { rpc: (...a) => rpc(...a), from: (...a) => from(...a) } }));

const { checkInStudentVisit, createVisit, fetchKioskRoster, fetchKioskVisits, fetchVisitCount } = await import("./checkinData.js");

beforeEach(() => { rpc.mockReset(); from.mockReset(); });

describe("kiosk data paths", () => {
  it("createVisit inserts through kiosk_create_visit and maps the returned row", async () => {
    rpc.mockResolvedValue({ data: { id: "v1", first_name: "Marie", last_name: "Joseph", visit_date: "2026-10-26", time_in: "2026-10-26T14:00:00Z" }, error: null });
    const created = await createVisit({ firstName: "Marie", lastName: "Joseph", date: "2026-10-26", timeIn: "2026-10-26T14:00:00Z" });
    expect(rpc).toHaveBeenCalledWith("kiosk_create_visit", { p_visit: expect.objectContaining({ first_name: "Marie", visit_date: "2026-10-26" }) });
    expect(created).toMatchObject({ id: "v1", firstName: "Marie", date: "2026-10-26" });
    expect(from).not.toHaveBeenCalled();
  });

  it("checkInStudentVisit sends only the student id and date", async () => {
    rpc.mockResolvedValue({ data: "v2", error: null });
    await expect(checkInStudentVisit("s1", "2026-10-26")).resolves.toEqual({ id: "v2" });
    expect(rpc).toHaveBeenCalledWith("kiosk_student_check_in", { p_student_id: "s1", p_visit_date: "2026-10-26" });
  });

  it("checkInStudentVisit surfaces the unique-violation code for repeat check-ins", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "23505", message: "duplicate key" } });
    await expect(checkInStudentVisit("s1", "2026-10-26")).rejects.toMatchObject({ code: "23505" });
  });

  it("fetchKioskVisits and fetchKioskRoster map RPC rows to the app shapes", async () => {
    rpc.mockResolvedValueOnce({ data: [{ id: "v3", first_name: "Jean", last_name: "Pierre", visit_date: "2026-10-26", time_in: "t", time_out: null, student_id: null }], error: null });
    rpc.mockResolvedValueOnce({ data: [{ id: "s2", first_name: "Rose", last_name: "Louis", class_key: "esl_am" }], error: null });
    const [visit] = await fetchKioskVisits("2026-10-26");
    const [student] = await fetchKioskRoster();
    expect(rpc).toHaveBeenNthCalledWith(1, "kiosk_visits", { p_visit_date: "2026-10-26" });
    expect(visit).toMatchObject({ id: "v3", firstName: "Jean", timeOut: null, phone: "" });
    expect(student).toMatchObject({ id: "s2", firstName: "Rose", classKey: "esl_am", phone: "" });
  });

  it("fetchVisitCount degrades to 0 on error", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "nope" } });
    vi.spyOn(console, "warn").mockImplementation(() => {});
    await expect(fetchVisitCount()).resolves.toBe(0);
  });
});
