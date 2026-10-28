# Launch budget: required vs optional

This lists what NB4HS will need to pay for, and what it can skip, to run the app. **There are no prices here on purpose:**
- Plans and prices change.
- Several providers offer nonprofit discounts that only NB4HS can apply for.

Fill in the "Quoted" column from each provider's pricing page when deciding, and note the date you checked. Plan names and limits below come from the providers' public plans as last known. Confirm each one on the pricing page.

## Required

The app does not launch properly without these.

| Item | Why it's needed | Lowest option that works | When you'd need more | Quoted (fill in) |
|---|---|---|---|---|
| **Domain name** (e.g. `nb4hs.org`) | Email can only be sent from a domain NB4HS owns. Password resets, invites and report emails depend on it | Probably already owned. Check renewal and ownership | — | |
| **Supabase** (database, sign-in, file storage, scheduled jobs) | The whole app runs on it | A free plan exists. **Decide whether it's enough for participant data:** check what the free plan includes for backups and whether inactive projects are paused | Daily backups or point-in-time recovery, more storage for client documents, or no pausing. These usually mean the paid plan | |
| **Vercel** (hosts the web app) | Serves the app | **Check the terms:** Vercel's free Hobby plan is for personal, non-commercial use. An organization account may need the paid team plan. Ask Vercel about nonprofit terms | More team members or commercial-use terms | |
| **Transactional email** (Resend, decision D9) | Password resets and invites need a real mail sender: Supabase's built-in mailer is for testing and has a low hourly limit. Staff report emails go through it too | A free tier exists. `staff-reporting-architecture.md` noted 3,000 emails a month on 2026-10-26; recheck | Monthly volume over the free tier, or more than one sending domain | |

## Optional

The app runs without these.

| Item | What it adds | Without it | Quoted (fill in) |
|---|---|---|---|
| **Custom app address** (e.g. `app.nb4hs.org`) | A trusted, memorable address on posters and QR codes | Keep `nb4hs-app.vercel.app`. No cost if the domain is already owned; it's a DNS record | |
| **Supabase paid add-ons:** point-in-time recovery, larger compute, branching | Restore to any minute; more headroom; full rehearsal databases | Daily backups (if the plan includes them) plus the local stack for rehearsals (decision D12) | |
| **Vercel paid features** beyond the base plan | Analytics, more preview protection | The app works without them | |
| **Password manager** for NB4HS (accounts checklist) | Shared, recoverable access to every account | A shared vault in a tool NB4HS already pays for | |
| **Error monitoring** (e.g. Sentry) | Alerts when staff hit errors | Errors are seen only when someone reports them | |
| **SMS reminders** | Text reminders to clients | In-app and email only. Not built: `outbound_messages` has a channel for it, but no provider is chosen | |
| **Rate limiting / bot protection** for public pages (S13 in `goals.md`) | Protects the 13 functions that work without sign-in from abuse | Today's behavior. Some providers' plans include it | |

## Not needed

- **Paid scheduler:** `pg_cron` and `pg_net` are free Supabase extensions, already in use.
- **Separate file storage:** Supabase Storage holds client documents and report attachments.
- **A separate test environment:** the local stack (`README-Dev.md`) covers development and rehearsals, at no cost.

## Decisions for NB4HS

1. Supabase plan: free, or paid for backups. This is the main money decision. It depends on how NB4HS weighs losing participant data.
2. Vercel plan: confirm whether the free plan's terms allow an organization's use.
3. Email: confirm the free tier covers expected volume (staff × reports × notices per month, plus password resets).
4. Apply for nonprofit discounts where offered, before choosing plans.
