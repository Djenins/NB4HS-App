// The intake form is translated for display only: in Kreyòl the labels
// change, but what gets saved -- and what an already-saved form re-checks --
// must stay the org's English option values.
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { t as translate } from "../lib/i18n.js";

vi.mock("../context/AppContext.jsx", () => ({ useT: () => (key) => translate(key, "ht") }));
vi.mock("../lib/pdfLibs.js", () => ({ loadPdfLibs: vi.fn() }));
const updateClientRecord = vi.fn(async () => ({}));
const saveClientIntake = vi.fn(async () => "2026-10-26T18:00:00Z");
let storedIntake = null;
vi.mock("../lib/clientsData.js", () => ({
  updateClientRecord: (...args) => updateClientRecord(...args),
  saveClientIntake: (...args) => saveClientIntake(...args),
  fetchClientIntake: async () => storedIntake,
  fetchClientDocuments: async () => [],
  getFileSignedUrl: vi.fn(),
  uploadClientFile: vi.fn(),
  createClientDocument: vi.fn()
}));

const { default: IntakeFormCard } = await import("./IntakeFormCard.jsx");

const savedClient = {
  id: "c1",
  firstName: "Marie",
  lastName: "Joseph",
  intakeForm: { gender: "Female", barriers: ["Housing"], primaryLanguage: "Creole", needTranslator: "YES" }
};

describe("IntakeFormCard in Kreyòl", () => {
  it("shows translated labels and re-checks a form saved with English values", () => {
    render(<IntakeFormCard bare client={savedClient} />);
    expect(screen.getByText("Enfòmasyon Pèsonèl")).toBeInTheDocument();
    expect(screen.getAllByRole("radio", { name: "Fi" })[0]).toBeChecked();
    // "Housing" is both a barrier and a referral; Barriers renders first.
    const housing = screen.getAllByRole("checkbox", { name: "Lojman" });
    expect(housing[0]).toBeChecked();
    expect(housing[1]).not.toBeChecked();
    expect(screen.getByRole("radio", { name: "Kreyòl" })).toBeChecked();
    // Proper names show untranslated.
    expect(screen.getByRole("radio", { name: "TPS" })).toBeInTheDocument();
  });

  it("saves the English option value, not the Kreyòl label", async () => {
    render(<IntakeFormCard bare client={savedClient} />);
    fireEvent.click(screen.getByRole("checkbox", { name: "Transpò" }));
    fireEvent.click(screen.getByRole("button", { name: /Sove Fòm nan/ }));
    await waitFor(() => expect(saveClientIntake).toHaveBeenCalled());
    const form = saveClientIntake.mock.calls[0][1];
    expect(form.barriers).toEqual(["Housing", "Transportation"]);
    expect(form.primaryLanguage).toBe("Creole");
    // Demographics also go on the client record; the form itself never does.
    await waitFor(() => expect(updateClientRecord).toHaveBeenCalled());
    const patch = updateClientRecord.mock.calls[0][1];
    expect(patch.gender).toBe("Female");
    expect(patch.intakeForm).toBeUndefined();
  });

  it("loads the saved form from client_intakes", async () => {
    storedIntake = { form: { gender: "Male", primaryLanguage: "French" }, savedAt: "2026-10-20T10:00:00Z" };
    render(<IntakeFormCard bare client={{ id: "c2", firstName: "Jean", lastName: "Pierre" }} />);
    await waitFor(() => expect(screen.getAllByRole("radio", { name: "Gason" })[0]).toBeChecked());
    storedIntake = null;
  });
});
