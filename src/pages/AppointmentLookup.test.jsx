// AppointmentLookup.test.jsx -- covers the four outcomes the public lookup
// page has to keep apart: a validation problem, matching appointments, an
// empty result, and a failed request (which must never be reported to a
// visitor as "no appointments found"). The RPC itself is mocked; what's
// under test is the page's handling of what comes back.
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { t as translate } from "../lib/i18n.js";

const showToast = vi.fn();
vi.mock("../context/AppContext.jsx", () => ({
  useApp: () => ({ setKiosk: vi.fn(), lang: "en", showToast }),
  useT: () => (key) => translate(key, "en")
}));
vi.mock("../lib/clientsData.js", () => ({ lookupClientAppointments: vi.fn() }));

import { lookupClientAppointments } from "../lib/clientsData.js";
import AppointmentLookup from "./AppointmentLookup.jsx";

function renderPage() {
  return render(<MemoryRouter><AppointmentLookup /></MemoryRouter>);
}
const findBtn = () => screen.getByRole("button", { name: /find my appointments/i });
// fireEvent.input rather than .change: the phone field reformats itself in an
// onInput handler, the same one the live page uses.
const type = (label, value) => fireEvent.input(screen.getByLabelText(label), { target: { value } });
const submit = () => fireEvent.click(findBtn());

describe("AppointmentLookup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("requires a last name and one contact field before searching", async () => {
    renderPage();
    submit();
    expect(screen.getByText("Enter your last name.")).toBeInTheDocument();
    expect(screen.getByText("Enter an email address or phone number.")).toBeInTheDocument();
    expect(lookupClientAppointments).not.toHaveBeenCalled();
  });

  it("still asks for a contact when only the last name is filled in", async () => {
    renderPage();
    type(/last name/i, "Pierre");
    submit();
    expect(screen.getByText("Enter an email address or phone number.")).toBeInTheDocument();
    expect(lookupClientAppointments).not.toHaveBeenCalled();
  });

  it("passes last name + email straight through to the lookup and lists what comes back", async () => {
    lookupClientAppointments.mockResolvedValue([
      { date: "2026-09-15", time: "10:30", meetingWith: "case_manager", status: "scheduled", reason: "Housing paperwork" }
    ]);
    renderPage();
    type(/last name/i, "Pierre");
    type(/email/i, "pierre@example.com");
    submit();

    await waitFor(() => expect(lookupClientAppointments).toHaveBeenCalledWith("Pierre", "pierre@example.com", ""));
    expect(await screen.findByText("Housing paperwork")).toBeInTheDocument();
    expect(screen.getByText("Case Manager")).toBeInTheDocument();
    expect(screen.getByText("Scheduled")).toBeInTheDocument();
    expect(screen.getByText("10:30")).toBeInTheDocument();
  });

  it("searches on the phone number alone", async () => {
    lookupClientAppointments.mockResolvedValue([]);
    renderPage();
    type(/last name/i, "Pierre");
    type(/phone number/i, "4015551234");
    submit();
    await waitFor(() => expect(lookupClientAppointments).toHaveBeenCalledWith("Pierre", "", "(401) 555-1234"));
  });

  it("shows the no-match state when the lookup returns nothing", async () => {
    lookupClientAppointments.mockResolvedValue([]);
    renderPage();
    type(/last name/i, "Pierre");
    type(/email/i, "pierre@example.com");
    submit();
    expect(await screen.findByText("No appointments found")).toBeInTheDocument();
  });

  it("distinguishes a failed request from having no appointments", async () => {
    lookupClientAppointments.mockRejectedValue(new Error("network"));
    renderPage();
    type(/last name/i, "Pierre");
    type(/email/i, "pierre@example.com");
    submit();
    expect(await screen.findByText("We couldn't check your appointments")).toBeInTheDocument();
    expect(screen.queryByText("No appointments found")).not.toBeInTheDocument();
  });

  it("does not fire a second lookup while one is in flight", async () => {
    let release;
    lookupClientAppointments.mockReturnValue(new Promise((res) => { release = res; }));
    renderPage();
    type(/last name/i, "Pierre");
    type(/email/i, "pierre@example.com");
    submit();
    // While the lookup is in flight the button reads "Searching..." and is
    // disabled, so a second tap can't fire a duplicate request.
    const busyBtn = screen.getByRole("button", { name: /searching/i });
    expect(busyBtn).toBeDisabled();
    fireEvent.click(busyBtn);
    expect(lookupClientAppointments).toHaveBeenCalledTimes(1);
    release([]);
    await waitFor(() => expect(findBtn()).not.toBeDisabled());
  });
});
