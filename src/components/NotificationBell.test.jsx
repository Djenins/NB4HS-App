// NotificationBell.test.jsx -- every notification type the database writes
// in English has a title in each app language, so the bell never falls back
// to the stored English text for a known type.
import { describe, expect, it } from "vitest";
import { STR } from "../lib/i18n.js";
import { TYPE_TITLE } from "./NotificationBell.jsx";

// Types written by DB code: send_task_reminders() (t1), the staff report
// RPCs (R1) and staff_reports_tick() (R2).
const SERVER_TYPES = [
  "snap_task_due", "task_overdue",
  "staff_report_submitted", "staff_report_revision_requested", "staff_report_acknowledged",
  "staff_report_due", "staff_report_overdue", "staff_report_overdue_digest"
];

describe("notification titles", () => {
  it("has a translated title for every server-written type", () => {
    SERVER_TYPES.forEach((type) => {
      const key = TYPE_TITLE[type];
      expect(key, type).toBeTruthy();
      ["en", "ht", "fr"].forEach((lang) => expect(STR[key] && STR[key][lang], type + " " + lang).toBeTruthy());
    });
  });
});
