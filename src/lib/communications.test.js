import { describe, expect, it, vi } from "vitest";

vi.mock("./supabase.js", () => ({ supabase: null }));
const {
  composeProblem, currentAnnouncements, newsletterErrorKey, fillTemplate, filterLog, logEntryFromRow, logSummaryCounts, messageAddress,
  openFollowUps, sendErrorKey, smsSegments, textablePhone, unreadCount
} = await import("./communications.js");

const TODAY = "2026-10-30";
const entry = (over) => Object.assign({
  id: "e1", clientId: "c1", date: TODAY, createdAt: TODAY + "T10:00:00Z", staffName: "Ana", method: "phone",
  direction: "outbound", summary: "Called about ESL", followUpRequired: false, followUpDoneAt: null
}, over);

describe("logEntryFromRow", () => {
  it("maps the follow-up and queue columns", () => {
    const e = logEntryFromRow({ id: "x", client_id: "c", contact_date: TODAY, follow_up_required: true, follow_up_done_at: "t", outbound_message_id: "m", profiles: { name: "Ana" } });
    expect(e).toMatchObject({ followUpRequired: true, followUpDoneAt: "t", outboundMessageId: "m", staffName: "Ana", summary: "" });
  });
});

describe("filterLog", () => {
  const clients = { c1: { id: "c1", firstName: "Marie", lastName: "Joseph", nbId: "NB-00012" }, c2: { id: "c2", firstName: "Paul", lastName: "Jean", nbId: "NB-00013" } };
  const list = [
    entry({ id: "a" }),
    entry({ id: "b", clientId: "c2", method: "sms", direction: "inbound", staffName: "Ben", followUpRequired: true, date: "2026-09-01" }),
    entry({ id: "c", followUpRequired: true, followUpDoneAt: "2026-10-29T12:00:00Z", date: "2026-10-25" })
  ];
  const ids = (f) => filterLog(list, f, clients, TODAY).map((e) => e.id);

  it("searches the client's name and NB ID, which the log row doesn't carry", () => {
    expect(ids({ q: "joseph" })).toEqual(["a", "c"]);
    expect(ids({ q: "nb-00013" })).toEqual(["b"]);
    expect(ids({ q: "esl" })).toEqual(["a", "b", "c"]);
    expect(ids({ q: "ben" })).toEqual(["b"]);
  });
  it("filters by method, direction, staff, follow-up state and recency", () => {
    expect(ids({ method: "sms" })).toEqual(["b"]);
    expect(ids({ direction: "inbound" })).toEqual(["b"]);
    expect(ids({ staff: "Ana" })).toEqual(["a", "c"]);
    expect(ids({ followUp: "open" })).toEqual(["b"]);
    expect(ids({ followUp: "done" })).toEqual(["c"]);
    expect(ids({ days: "7" })).toEqual(["a", "c"]);
    expect(ids({})).toEqual(["a", "b", "c"]);
  });
  it("counts and orders open follow-ups oldest first", () => {
    const more = list.concat([entry({ id: "d", followUpRequired: true, date: "2026-08-01" })]);
    expect(openFollowUps(more).map((e) => e.id)).toEqual(["d", "b"]);
    expect(logSummaryCounts(more, TODAY)).toEqual({ total: 4, lastWeek: 2, openFollowUps: 2, inbound: 1 });
  });
});

describe("addresses", () => {
  it("normalizes phones the way the database does", () => {
    expect(textablePhone("(401) 555-0142")).toBe("+14015550142");
    expect(textablePhone("1 401 555 0142")).toBe("+14015550142");
    expect(textablePhone("+509 3712 3456")).toBe("+50937123456");
    expect(textablePhone("555-0142")).toBeNull();
    expect(textablePhone("")).toBeNull();
  });
  it("picks the address for the channel", () => {
    const c = { phone: "401-555-0142", email: " Marie@Example.org " };
    expect(messageAddress(c, "sms")).toBe("+14015550142");
    expect(messageAddress(c, "email")).toBe("marie@example.org");
    expect(messageAddress({ email: "nope" }, "email")).toBeNull();
    expect(messageAddress(null, "sms")).toBeNull();
  });
});

describe("composing", () => {
  const client = { firstName: "Marie", phone: "4015550142", email: "m@example.org" };
  const sms = { channel: "sms", body: "Bonjou {first_name}", subject: "" };

  it("fills {first_name} everywhere", () => {
    expect(fillTemplate("Hi {first_name}, {first_name}!", client)).toBe("Hi Marie, Marie!");
    expect(fillTemplate("Hi {first_name}", null)).toBe("Hi ");
  });
  it("says what blocks sending, in order", () => {
    expect(composeProblem(sms, null, true)).toBe("commsProblemClient");
    expect(composeProblem(sms, { firstName: "X" }, true)).toBe("commsProblemNoPhone");
    expect(composeProblem({ channel: "email", body: "x" }, { phone: "4015550142" }, true)).toBe("commsProblemNoEmail");
    expect(composeProblem(sms, client, false)).toBe("commsProblemConsent");
    expect(composeProblem({ channel: "email", body: "x", subject: " " }, client, true)).toBe("commsProblemSubject");
    expect(composeProblem({ channel: "sms", body: "  " }, client, true)).toBe("commsProblemBody");
    expect(composeProblem({ channel: "sms", body: "x".repeat(481) }, client, true)).toBe("commsProblemTooLong");
    expect(composeProblem(sms, client, true)).toBeNull();
  });
  it("counts SMS parts, with Unicode for Kreyòl and French accents", () => {
    expect(smsSegments("")).toBe(0);
    expect(smsSegments("x".repeat(160))).toBe(1);
    expect(smsSegments("x".repeat(161))).toBe(2);
    expect(smsSegments("Randevou ou demen" + "ò")).toBe(1);
    expect(smsSegments("ò".repeat(71))).toBe(2);
  });
  it("turns database refusals into messages", () => {
    expect(sendErrorKey({ hint: "consent_required" })).toBe("commsProblemConsent");
    expect(sendErrorKey({ hint: "no_address" })).toBe("commsProblemNoAddress");
    expect(sendErrorKey({ hint: "rate_limited" })).toBe("commsRateLimited");
    expect(sendErrorKey({ code: "42501" })).toBe("commsNoPermission");
    expect(sendErrorKey(new Error("x"))).toBe("commsSendFailed");
  });
});

describe("announcements", () => {
  const a = (over) => Object.assign({ id: "a", pinned: false, priority: "normal", archivedAt: null, expiresOn: "", createdAt: "2026-10-01T00:00:00Z" }, over);
  const list = [
    a({ id: "old" }),
    a({ id: "new", createdAt: "2026-10-20T00:00:00Z" }),
    a({ id: "imp", priority: "important", createdAt: "2026-09-01T00:00:00Z" }),
    a({ id: "pin", pinned: true, createdAt: "2026-08-01T00:00:00Z" }),
    a({ id: "gone", archivedAt: "2026-10-02T00:00:00Z" }),
    a({ id: "expired", expiresOn: "2026-10-29" }),
    a({ id: "lastday", expiresOn: TODAY })
  ];
  it("shows current ones pinned first, then important, then newest", () => {
    expect(currentAnnouncements(list, TODAY).map((x) => x.id)).toEqual(["pin", "imp", "new", "old", "lastday"]);
  });
  it("counts unread among current ones only", () => {
    expect(unreadCount(list, new Set(["pin", "imp", "gone"]), TODAY)).toBe(3);
  });
});

describe("newsletters", () => {
  it("turns send refusals into messages", () => {
    expect(newsletterErrorKey({ hint: "no_mailing_address" })).toBe("nlNoAddress");
    expect(newsletterErrorKey({ hint: "no_recipients" })).toBe("nlNoRecipients");
    expect(newsletterErrorKey({ hint: "too_many" })).toBe("nlTooMany");
    expect(newsletterErrorKey({ hint: "already_sent" })).toBe("nlAlreadySent");
    expect(newsletterErrorKey(new Error("x"))).toBe("userActionError");
  });
});
