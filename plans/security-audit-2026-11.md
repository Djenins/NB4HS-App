# Security audit — client data (2026-11-01)

Scope: the final database state on the local stack (tables, row-level
security, grants, every function anonymous callers can run, storage),
the two edge functions, auth settings in `supabase/config.toml`, and how
the app reaches them. Probed live on local with a self-signup account and
the public anon key; probe accounts were deleted afterwards.

Not covered: the hosted Supabase project's dashboard settings (auth, MFA,
signups). `config.toml` only configures the local stack, so check those
in the dashboard, or set them again when NB4HS gets its own project.

## What's already solid

- Row-level security is on for all 84 public tables. Anonymous callers can
  read only `classes` and `courses` (names and schedules, no personal data).
- Internal helper functions are closed to anonymous callers. Only 15 public
  entry points are open, and each one has a per-IP rate limit
  (`api_pre_request`).
- A self-signup account starts inactive, can't activate itself or change
  its role (tested), and sees no client data.
- Storage buckets for client documents and staff reports are private and
  permission-checked.
- `audit_events` is append-only. Edge functions check the caller's
  permission before using the service key, and the cron function rejects
  calls without its secret.
- Outbound staff emails carry no participant details.

## Findings, by risk

### 1. HIGH — Kiosk functions are open to the whole internet

**Status:** fixed in `k1_kiosk_devices` (tablet pairing; phones see no
names). Tested on the local stack, not yet applied to live.

Kiosk mode means "nobody signed in": anyone who opens `/kiosk`, or calls
the API with the public anon key, is the kiosk. The anon key ships in the
app bundle, so this means anyone at all.

- `kiosk_roster()` returns **every active student's first and last name and
  class**, all in one call.
- `kiosk_visits(date)` returns **the names of everyone currently checked in
  and not yet checked out**, from any date.
- `kiosk_create_visit`, `kiosk_student_check_in` and `check_out_visit` let
  anyone create fake visits or check real people out. That corrupts visit
  records and inflates reports. The student ids `check_in` needs come
  straight from `kiosk_roster`.

**Fix:** give the kiosk tablet its own sign-in, a "Kiosk device" account
whose only permission is front-desk check-in/check-out. Revoke `anon`
execute on the five kiosk functions, grant them to `authenticated`, and
check that permission inside each one. `/kiosk` then needs that sign-in
once per device; the session persists.
`public_register_case_client`'s `check_in` option should only be accepted
from the kiosk account.

### 2. MEDIUM — Appointment lookup reveals what clients wrote

`lookup_client_appointments(last_name, email|phone)` returns date, time,
who the appointment is with, **and the `reason` text the client typed**,
which can be sensitive (immigration, housing, benefits). Last name plus
phone number is often known to family members, landlords or employers.
Limit: 60 attempts an hour per IP.

**Fix:** drop `reason` from the result. Better still, send a short
confirmation code by SMS or email when the appointment is booked and
require it for lookup. Lower the limit to about 10 an hour.

### 3. MEDIUM — Staff accounts: no MFA, weak passwords

MFA (TOTP) is disabled, and the minimum password is 6 characters with no
other requirements. A stolen staff password is the most likely way client
data gets out.

**Fix:** enable TOTP MFA and require it for staff (check `aal2` in the
app, and on the most sensitive tables in RLS). Set minimum password length
to 12, add lower/upper/digit requirements, and turn on the leaked-password
check where the hosted plan offers it. Add an inactivity sign-out for
shared front-desk computers.

### 4. MEDIUM — Open self-signup

`enable_signup = true`, but the app no longer uses it: `signUpStaff` in
`src/lib/supabaseAuth.js` has no callers, and staff are invited through
`admin-users`. New accounts are inactive and harmless today, but they can
read `staff_directory` (case manager and job developer names and emails).
And any future policy that only checks "signed in" would be open to
strangers.

**Fix:** turn signups off (invites through the admin API keep working)
and delete `signUpStaff`. Optionally make `staff_directory`
`security_invoker`, or require an active profile.

### 5. LOW — Public forms can be spammed

`request_appointment`, `book_staff_appointment` and
`public_register_case_client` allow 30 calls an hour per IP. Each
registration creates a real client record. When name and phone match an
existing client, it also flips `needs_intake` and can change that client's
preferred language.

**Fix:** add a bot check (e.g. Cloudflare Turnstile) to the three public
forms, verified server-side. For an existing client, don't overwrite
`preferred_language`; leave it for staff to confirm.

### 6. LOW — Defense in depth

- `anon` still holds Supabase's default ALL privileges on every public
  table. RLS blocks it today, but it only needs `SELECT` on
  `classes`/`courses`. Revoke the rest, and set default privileges so new
  tables don't grant `anon` anything.
- `vercel.json` sets no security headers. Add Content-Security-Policy,
  `X-Frame-Options: DENY` (or `frame-ancestors`), `Referrer-Policy`,
  `Permissions-Policy` and HSTS.
- Client documents are readable organisation-wide by anyone with
  `participants.documents.view` (table and bucket agree). That's
  consistent, but confirm it's intended rather than per-program.

## Suggested order

1. Kiosk device account and revoking anon on the kiosk functions (#1).
2. Lookup hardening (#2) and turning signups off (#4); both are small.
3. MFA and password policy (#3), together with the domain split.
4. Bot check on public forms (#5) and the hardening items (#6).

Every fix should land as a migration, so it carries over to NB4HS's own
Supabase project.
