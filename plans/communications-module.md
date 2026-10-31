# Communications module

Status: **live since 2026-10-30.** Migration `c1_communications` was applied to live after a rolled-back dry run (checks passed before and after), then PR #75 was merged and deployed to production. Texting is off until Twilio is decided, and client emails wait until email (Resend) is set up.

One sidebar entry, **Communications** (`/communications/:section`), with four sections. Each section shows only for the permission behind it, and the database enforces the same permissions on its own.

| Section | Who | What |
|---|---|---|
| Log | `communications.view` | Every client's communications log (the `communications` table the client profile already shows), with filters, open follow-ups counted at the top, and **Mark done / Reopen** on each follow-up |
| Messages | `communications.messages.send` (or `.view` to read) | Texts and emails to clients, with their queue status. Waiting messages can be cancelled by the sender. A warning appears when messages wait longer than one send cycle, which means the provider isn't connected |
| Templates | `communications.templates.manage` | Reusable messages per channel, purpose and language (en / ht / fr). `{first_name}` is filled in when the message is sent. Templates are switched off, never deleted |
| Announcements | `communications.announcements.view` / `.post` | Notices to all staff. Posting one sends everyone an in-app notification that links here. Announcements can be pinned, marked Important, given an end date, and archived |

The client profile's Communications tab also gets **Send message**, follow-up closing, and the queue status on each message sent from the app.

## Rules the database enforces (`c1_communications`)

- **Consent first.** `send_client_message()` refuses unless the client's newest `contact_consents` row for that channel and purpose is `granted`. These are the same append-only rows SNAP records. Staff who can send can now read and record consent too (as themselves).
- A usable address is required: email, or a phone that normalises to E.164 (`normalize_phone`). Texts are limited to 480 characters, emails to 2,000.
- Each staff member can send at most 60 messages an hour.
- Each message is queued in `outbound_messages` and logged in `communications` in the same transaction. The queue table stays closed to staff, who read it only through `client_messages()`.
- Direct writes to `communications` are limited to the columns the log form has always written. "Done" and the link to a sent message can only be set by the functions.
- Grants match who reads the log today (administrator, staff, case manager, job developer). Every account type reads announcements. Administrators and Executive Oversight post. **Custom roles get nothing** until someone adds the permissions under Administration → Roles.

## Sending

`send-outbound` (Edge Function) now claims only the channels it has a provider for:

- **Email:** Resend, as already planned (D9). It uses the same secrets as the staff report emails.
- **Text:** Twilio, through `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` and `TWILIO_FROM` (a number or a Messaging Service SID). **This is a paid service and needs the owner's decision** (`launch-budget.md`, "SMS reminders"). Until it's set, texts wait as "queued", and the Messages page says texting isn't connected.

The deployed function keeps working unchanged after the migration, because the new `claim_outbound_messages` defaults to email only. To send texts, redeploy the function with the Twilio secrets.

## Still open

1. ~~Dry-run and apply `c1_communications` on live.~~ Done 2026-10-30: the dry run (`begin;` + migration + `supabase/tests/c1_communications_check.sql`, ending in `C1_CHECKS_PASSED`) passed, the migration was applied with its `schema_migrations` row in one transaction, and the checks passed again on live. The rollback is `supabase/rollback/c1_communications_down.sql`; on the local stack it restored the schema exactly.
2. Decide on Twilio, or leave texting off. Email needs only Resend, which goes live with the staff report emails.
3. Native-speaker check of the Kreyòl and French footer in client emails (`CLIENT_FOOTER` in `send-outbound/handler.ts`). Templates are written by staff in each language.
4. Follow-up, not built: replies such as STOP. Twilio blocks texts to numbers that replied STOP and the send then fails, but nothing writes a `revoked` consent row yet. That needs an inbound webhook.
