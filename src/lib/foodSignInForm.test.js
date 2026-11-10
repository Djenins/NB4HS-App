import { describe, expect, it } from "vitest";
import { jsPDF } from "jspdf";
import { buildFoodFormPdf, formTitle, formTitles, formatFormDate, label, pdfFileName } from "./foodSignInForm.js";

describe("food distribution form", () => {
  it("names the form after the occasion in each language", () => {
    expect(formTitle("thanksgiving", "", "en")).toBe("Thanksgiving Food Distribution Form");
    expect(formTitle("christmas", "", "ht")).toBe("Fòm Distribisyon Manje pou Nwèl");
    expect(formTitle("general", "", "fr")).toBe("Formulaire de distribution alimentaire");
    expect(formTitle("custom", "  Summer ", "en")).toBe("Summer Food Distribution Form");
    expect(formTitle("custom", "", "en")).toBe("Food Distribution Form");
    expect(formTitles({ occasion: "easter", lang: "en+ht" })).toEqual(["Easter Food Distribution Form", "Fòm Distribisyon Manje pou Pak"]);
  });

  it("labels fields bilingually", () => {
    expect(label("ffName", "en+ht")).toBe("Name / Non");
    expect(label("ffPhone", "fr")).toBe("Téléphone");
  });

  it("formats the date in the form's first language without slipping a day", () => {
    expect(formatFormDate("2026-11-26", "en+ht")).toBe("November 26, 2026");
    expect(formatFormDate("2026-11-26", "ht")).toBe("26 novanm 2026");
    expect(formatFormDate("", "en")).toBe("");
  });

  it("builds a file name from the English title and date", () => {
    expect(pdfFileName({ occasion: "thanksgiving", date: "2026-11-26" })).toBe("thanksgiving-food-distribution-form-2026-11-26.pdf");
    expect(pdfFileName({ occasion: "custom", customOccasion: "Fête des Mères" })).toBe("fete-des-meres-food-distribution-form.pdf");
  });

  it("builds the requested number of pages in each layout", () => {
    const sheet = buildFoodFormPdf(jsPDF, { layout: "sheet", lang: "en+ht", occasion: "thanksgiving", pages: 3, logo: null });
    expect(sheet.getNumberOfPages()).toBe(3);
    expect(sheet.internal.pageSize.getWidth()).toBeGreaterThan(sheet.internal.pageSize.getHeight());
    const single = buildFoodFormPdf(jsPDF, { layout: "individual", lang: "fr", occasion: "general", pages: 2, logo: null });
    expect(single.getNumberOfPages()).toBe(2);
    expect(single.internal.pageSize.getHeight()).toBeGreaterThan(single.internal.pageSize.getWidth());
  });

  it("puts typeable fields on the blank lines", () => {
    const sheet = buildFoodFormPdf(jsPDF, { layout: "sheet", lang: "en", occasion: "general", pages: 1, logo: null });
    const out = sheet.output();
    expect(out).toContain("/AcroForm");
    expect(out).toContain("(row1_name)");
    expect(out).toContain("(row12_signature)");
    const single = buildFoodFormPdf(jsPDF, { layout: "individual", lang: "en", occasion: "general", pages: 2, logo: null });
    const singleOut = single.output();
    expect(singleOut).toContain("(form1_phone)");
    expect(singleOut).toContain("(form2_phone)");
    expect(singleOut).not.toContain("(form3_phone)");
  });

  it("prints online answers into the sheet and grows it to fit", () => {
    const entries = Array.from({ length: 14 }, (_, i) => ({ name: "Client " + (i + 1), address: "1 Main St", phone: "401-555-0100" }));
    const doc = buildFoodFormPdf(jsPDF, { layout: "sheet", lang: "en", occasion: "general", pages: 1, logo: null, entries });
    expect(doc.getNumberOfPages()).toBe(2);
    const out = doc.output();
    expect(out).not.toContain("(row1_name)");
    expect(out).toContain("(row15_name)");
  });

  it("gives each program its own form", () => {
    expect(formTitles({ occasion: "thanksgiving", lang: "en", program: "cdbg" })).toEqual(["Thanksgiving Food Distribution Form – CDBG"]);
    expect(formTitles({ occasion: "thanksgiving", lang: "en", program: "regular" })).toEqual(["Thanksgiving Food Distribution Form"]);
    expect(pdfFileName({ occasion: "general", program: "cdbg" })).toBe("food-distribution-form-cdbg.pdf");
    // The Regular form asks about SNAP; CDBG doesn't.
    const regular = buildFoodFormPdf(jsPDF, { layout: "individual", program: "regular", lang: "en", occasion: "general", pages: 1, logo: null }).output();
    expect(regular).toContain("(form1_snap_yes)");
    expect(regular).toContain("(form1_apply_no)");
    const cdbg = buildFoodFormPdf(jsPDF, { layout: "individual", program: "cdbg", lang: "en", occasion: "general", pages: 1, logo: null }).output();
    expect(cdbg).not.toContain("_snap_");
    const sheet = buildFoodFormPdf(jsPDF, { layout: "sheet", program: "regular", lang: "en+ht", occasion: "general", pages: 1, logo: null }).output();
    expect(sheet).toContain("(row12_apply_yes)");
    expect(sheet).toContain("(row1_signature)");
  });

  it("prints a label once when it's the same in both languages", () => {
    expect(label("ffSnapCol", "en+ht")).toBe("SNAP?");
    expect(label("ffYes", "en+ht")).toBe("Yes / Wi");
  });
});
