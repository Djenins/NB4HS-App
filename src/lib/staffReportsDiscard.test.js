// staffReportsDiscard.test.js -- discarding a draft removes its uploaded
// files before the report row. Once the row is gone, storage's delete
// policy can no longer match the files, and they'd be stranded.
import { beforeEach, describe, expect, it, vi } from "vitest";

const calls = [];
let attachmentRows = [];
let removeError = null;

function query(table) {
  const q = {
    select() { calls.push(["select", table]); return q; },
    delete() { calls.push(["delete", table]); return q; },
    eq() {
      if (table === "staff_report_attachments") return Promise.resolve({ data: attachmentRows, error: null });
      return Promise.resolve({ error: null });
    }
  };
  return q;
}

vi.mock("./supabase.js", () => ({
  supabase: {
    from: (table) => query(table),
    storage: { from: () => ({ remove: (paths) => { calls.push(["remove", paths]); return Promise.resolve({ error: removeError }); } }) }
  }
}));

import { discardDraft } from "./staffReports.js";

describe("discardDraft", () => {
  beforeEach(() => { calls.length = 0; attachmentRows = []; removeError = null; });

  it("removes the files, then the report", async () => {
    attachmentRows = [{ storage_path: "u/r/a.pdf" }, { storage_path: "u/r/b.png" }];
    await discardDraft("r");
    expect(calls).toEqual([
      ["select", "staff_report_attachments"],
      ["remove", ["u/r/a.pdf", "u/r/b.png"]],
      ["delete", "staff_reports"]
    ]);
  });

  it("skips storage when there are no files", async () => {
    await discardDraft("r");
    expect(calls.map((c) => c[0])).toEqual(["select", "delete"]);
  });

  it("keeps the report when the files can't be removed", async () => {
    attachmentRows = [{ storage_path: "u/r/a.pdf" }];
    removeError = new Error("storage down");
    await expect(discardDraft("r")).rejects.toThrow("storage down");
    expect(calls.some((c) => c[0] === "delete")).toBe(false);
  });
});
