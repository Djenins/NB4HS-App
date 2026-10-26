// SnapContacts.test.jsx -- the add flow searches existing clients first,
// links rather than duplicates, warns before creating a likely duplicate,
// and the detail view respects who may edit and records consent.
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { t as translate } from "../../lib/i18n.js";
import { withProgram } from "../../test/outreachProgram.jsx";

let app;
vi.mock("../../context/AppContext.jsx", () => ({
  useApp: () => app,
  useT: () => (key) => translate(key, "en")
}));
const api = vi.hoisted(() => ({
  fetchOutreachContacts: vi.fn(), createOutreachContact: vi.fn(), updateOutreachContact: vi.fn(),
  fetchConsents: vi.fn(), recordConsent: vi.fn(), fetchInteractions: vi.fn(), logInteraction: vi.fn()
}));
vi.mock("../../lib/outreachContacts.js", async (importOriginal) => {
  const actual = await importOriginal();
  const wrapped = {};
  Object.keys(api).forEach((k) => { wrapped[k] = (...a) => api[k](...a); });
  return { ...actual, ...wrapped };
});

import SnapContacts from "./SnapContacts.jsx";

const en = (key) => translate(key, "en");
const clients = [
  { id: "c1", nbId: "NB-00001", firstName: "Marie", lastName: "Joseph", phone: "4015550100", email: "", dob: "" },
  { id: "c2", nbId: "NB-00002", firstName: "Jean", lastName: "Pierre", phone: "4015550199", email: "", dob: "" }
];
const existingContact = {
  id: "k1", clientId: "c2", nbId: "NB-00002", firstName: "Jean", lastName: "Pierre", phone: "4015550199", email: "",
  preferredLanguage: "ht", preferredContactMethod: "sms", outreachSource: "", assignedTo: "w-other", status: "active", followUpStatus: "needed"
};

function renderAs(programRole, userId) {
  app = {
    session: { id: userId, role: "staff" },
    data: { programRoles: { snap: programRole }, clients, profiles: [{ id: userId, name: "Me", active: true }, { id: "w-other", name: "Other Worker", active: true }] },
    showToast: vi.fn()
  };
  return render(<MemoryRouter>{withProgram(<SnapContacts />, { programRole })}</MemoryRouter>);
}

beforeEach(() => {
  Object.values(api).forEach((fn) => fn.mockReset());
  api.fetchOutreachContacts.mockResolvedValue([existingContact]);
  api.fetchConsents.mockResolvedValue([]);
  api.fetchInteractions.mockResolvedValue([]);
  api.createOutreachContact.mockResolvedValue({ id: "k2", clientId: "c1" });
  api.recordConsent.mockResolvedValue(undefined);
});

describe("SnapContacts", () => {
  it("lists contacts with their language, method and follow-up", async () => {
    renderAs("worker", "w-me");
    expect(await screen.findByText("Jean Pierre")).toBeInTheDocument();
    expect(screen.getByText(en("snapLang_ht"))).toBeInTheDocument();
    expect(screen.getByText(en("snapFollow_needed"))).toBeInTheDocument();
  });

  it("finds an existing client first and links them instead of creating a record", async () => {
    renderAs("worker", "w-me");
    await screen.findByText("Jean Pierre");
    fireEvent.click(screen.getByRole("button", { name: en("snapAddContact") }));
    fireEvent.change(screen.getByLabelText(en("snapFindPersonPlaceholder")), { target: { value: "marie" } });
    fireEvent.click(await screen.findByRole("button", { name: en("snapAddExisting") }));
    await waitFor(() => expect(api.createOutreachContact).toHaveBeenCalled());
    expect(api.createOutreachContact.mock.calls[0][0]).toBe("snap");
    expect(api.createOutreachContact.mock.calls[0][3]).toBe("c1");
  });

  it("shows when a found client is already a SNAP contact", async () => {
    renderAs("worker", "w-me");
    await screen.findByText("Jean Pierre");
    fireEvent.click(screen.getByRole("button", { name: en("snapAddContact") }));
    fireEvent.change(screen.getByLabelText(en("snapFindPersonPlaceholder")), { target: { value: "pierre" } });
    expect(await screen.findByRole("button", { name: en("snapAlreadyContact") })).toBeInTheDocument();
  });

  it("requires a name and a way to reach them, then warns about a likely duplicate", async () => {
    renderAs("worker", "w-me");
    await screen.findByText("Jean Pierre");
    fireEvent.click(screen.getByRole("button", { name: en("snapAddContact") }));
    fireEvent.click(screen.getByRole("button", { name: en("snapNewPerson") }));
    const dialog = screen.getByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: en("snapAddContact") }));
    expect(await screen.findByRole("alert")).toHaveTextContent(en("snapNameRequired"));

    fireEvent.change(screen.getByLabelText(en("firstName")), { target: { value: "Marie" } });
    fireEvent.change(screen.getByLabelText(en("lastName")), { target: { value: "Joseph" } });
    fireEvent.click(within(dialog).getByRole("button", { name: en("snapAddContact") }));
    expect(await screen.findByRole("alert")).toHaveTextContent(en("snapContactNeedsWay"));

    fireEvent.change(screen.getByLabelText(en("phoneLabel")), { target: { value: "401-555-0100" } });
    fireEvent.click(within(dialog).getByRole("button", { name: en("snapAddContact") }));
    expect(await screen.findByText(en("duplicateWarningTitle"))).toBeInTheDocument();
    expect(api.createOutreachContact).not.toHaveBeenCalled();
  });

  it("opens a colleague's contact read-only for a worker, but lets them record consent", async () => {
    renderAs("worker", "w-me");
    fireEvent.click(await screen.findByRole("button", { name: "Jean Pierre" }));
    expect(await screen.findByText(en("snapContactReadOnly"))).toBeInTheDocument();
    expect(screen.getByLabelText(en("snapPreferredLanguage"))).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: en("snapConsentRecordYes") + ": " + en("snapMethod_sms") + " — " + en("snapPurpose_appointment_reminders") }));
    await waitFor(() => expect(api.recordConsent).toHaveBeenCalledWith("c2", { channel: "sms", purpose: "appointment_reminders", status: "granted", method: "verbal" }));
  });

  it("lets a supervisor edit and reassign", async () => {
    renderAs("supervisor", "s-me");
    fireEvent.click(await screen.findByRole("button", { name: "Jean Pierre" }));
    expect(await screen.findByLabelText(en("snapPreferredLanguage"))).not.toBeDisabled();
    expect(screen.getByLabelText(en("snapAssignedTo")).tagName).toBe("SELECT");
  });
});
