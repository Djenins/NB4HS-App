// Pins the public appointment-request paths to the Phase 0 RPCs: once p0b is
// applied, anonymous callers can no longer insert into `appointments` or read
// `staff_directory`, so these must never fall back to supabase.from(...).
import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
const from = vi.fn();
vi.mock("./supabase.js", () => ({ supabase: { rpc: (...a) => rpc(...a), from: (...a) => from(...a) } }));

const { fetchStaffDirectory, requestAppointment } = await import("./clientsData.js");

beforeEach(() => { rpc.mockReset(); from.mockReset(); });

describe("public appointment request", () => {
  it("fetchStaffDirectory reads public_appointment_staff (no emails)", async () => {
    rpc.mockResolvedValue({ data: [{ id: "u1", name: "Jasmine", role: "case_manager" }], error: null });
    await expect(fetchStaffDirectory()).resolves.toEqual([{ id: "u1", name: "Jasmine", role: "case_manager" }]);
    expect(rpc).toHaveBeenCalledWith("public_appointment_staff");
    expect(from).not.toHaveBeenCalled();
  });

  it("fetchStaffDirectory returns an empty list when the RPC fails", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "boom" } });
    vi.spyOn(console, "warn").mockImplementation(() => {});
    await expect(fetchStaffDirectory()).resolves.toEqual([]);
  });

  it("requestAppointment sends the picked staff id, never an email address", async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    await requestAppointment({
      firstName: "Marie", lastName: "Joseph", phone: "401-555-0100", email: "", date: "2026-11-02",
      time: "10:00", reason: "Housing", staffId: "u1", meetingWith: "case_manager"
    });
    expect(rpc).toHaveBeenCalledWith("request_appointment", {
      p_first_name: "Marie", p_last_name: "Joseph", p_phone: "401-555-0100", p_email: "", p_date: "2026-11-02",
      p_time: "10:00", p_reason: "Housing", p_staff_id: "u1", p_meeting_with: "case_manager"
    });
    expect(from).not.toHaveBeenCalled();
  });

  it("requestAppointment without a person sends a null staff id and the chosen role", async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    await requestAppointment({ firstName: "A", lastName: "B", phone: "1", date: "2026-11-02", time: "9:00", meetingWith: "job_developer" });
    expect(rpc).toHaveBeenCalledWith("request_appointment", expect.objectContaining({ p_staff_id: null, p_meeting_with: "job_developer", p_email: "", p_reason: "" }));
  });

  it("requestAppointment rethrows a server error so the page can show it", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "22023", message: "unknown staff member" } });
    await expect(requestAppointment({ firstName: "A", lastName: "B", phone: "1", date: "2026-11-02", time: "9:00" }))
      .rejects.toMatchObject({ code: "22023" });
  });
});
