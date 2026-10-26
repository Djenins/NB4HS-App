// Workforce stage and status lists translate for display only: every entry
// carries Kreyòl and French, lookups fall back to English for a missing
// language, and an unknown stored key shows as itself.
import { describe, expect, it } from "vitest";
import { EMPLOYER_PARTNERSHIP_STAGES, partnershipStageLabel } from "./employerProfile.js";
import { JOB_OPENING_STATUSES, statusLabel } from "./jobOpenings.js";
import {
  APPLICATION_STATUSES, applicationStatusLabel, EMPLOYMENT_STATUSES, employmentStatusLabel,
  JOB_PIPELINE_STAGES, WORK_AUTH_STATUSES, workAuthLabel
} from "./jobProfile.js";
import { PLACEMENT_STATUSES, placementStatusLabel } from "./placements.js";
import { REFERRAL_STAGES, stageLabel } from "./referrals.js";

const LISTS = {
  EMPLOYMENT_STATUSES, JOB_PIPELINE_STAGES, APPLICATION_STATUSES, EMPLOYER_PARTNERSHIP_STAGES,
  JOB_OPENING_STATUSES, PLACEMENT_STATUSES, REFERRAL_STAGES,
  // TPS is a proper name and stays as-is in every language.
  WORK_AUTH_STATUSES: WORK_AUTH_STATUSES.filter((s) => s.key !== "tps")
};

describe("Workforce stage and status labels", () => {
  it.each(Object.entries(LISTS))("%s has Kreyòl and French for every entry", (_, list) => {
    for (const s of list) {
      expect(s.ht, s.key).toBeTruthy();
      expect(s.fr, s.key).toBeTruthy();
    }
  });

  it("looks labels up in the requested language", () => {
    expect(employmentStatusLabel("job_ready", "ht")).toBe("Pare pou Travay");
    expect(applicationStatusLabel("not_selected", "fr")).toBe("Non retenu");
    expect(partnershipStageLabel("partner", "ht")).toBe("Patnè");
    expect(statusLabel("filled", "fr")).toBe("Pourvue");
    expect(placementStatusLabel("ended", "ht")).toBe("Fini");
    expect(stageLabel("hired", "fr")).toBe("Embauché");
  });

  it("falls back to English, and to the raw key when unknown", () => {
    expect(employmentStatusLabel("job_ready")).toBe("Job Ready");
    expect(employmentStatusLabel("job_ready", "es")).toBe("Job Ready");
    expect(workAuthLabel("tps", "ht")).toBe("TPS");
    expect(stageLabel("legacy_stage", "ht")).toBe("legacy_stage");
    expect(stageLabel(undefined, "ht")).toBe("");
  });
});
