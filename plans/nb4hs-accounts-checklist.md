# NB4HS-owned accounts: setup checklist

Today the app runs on personal accounts:
- **Code:** GitHub `Djenins/NB4HS-App`
- **Hosting:** Vercel, at `nb4hs-app.vercel.app`
- **Database:** Supabase project `vkbzarlkqzvhsfdmxyyq`

For launch, NB4HS should own every account, so the organization keeps access whoever does the development. This is a checklist for NB4HS staff to work through. **Nothing on it has been done.** None of it is a step for a developer to take on a personal account, and no account has been transferred.

Costs are in [launch-budget.md](launch-budget.md). The variables each service needs are in [deploy-and-operations.md](deploy-and-operations.md).

## Before anything else

- [ ] **Choose two NB4HS owners**, for example the executive director and one other staff member. Every account below gets both as owners, so one departure never locks NB4HS out.
- [ ] **Create a shared admin mailbox** on the NB4HS domain, for example `it@nb4hs.org`, and use it to sign up for each service. Avoid personal emails.
- [ ] **Turn on two-factor authentication** for both owners on every account.
- [ ] **Pick a password manager** NB4HS controls, and keep the recovery codes for each account there.

## Domain and email (needed first: the other services verify against it)

- [ ] **Registrar:** the domain (for example `nb4hs.org`) is registered to NB4HS, with auto-renew on and both owners able to sign in.
- [ ] **Choose the app address:** for example `app.nb4hs.org`, or keep the `vercel.app` address for now. A custom domain is optional (see the budget).
- [ ] **Email sending account** (Resend, decision D9 in `unified-access-architecture.md`):
  - Created with the shared mailbox.
  - Sending domain verified: the provider gives DNS records that NB4HS adds at the registrar.
  - An API key created for the app.
- [ ] **DNS changes are made by NB4HS** at the registrar: the email verification records and, if used, the app subdomain record.

## GitHub (code)

- [ ] Create a GitHub **organization** for NB4HS, owned by both owners.
- [ ] **Move the repository into it.** Whoever owns `Djenins/NB4HS-App` starts the transfer; an NB4HS owner accepts it. GitHub keeps redirects from the old address.
- [ ] Add developers as **members with write access**, not owners.
- [ ] Protect `main`: changes arrive by pull request with a review.

## Supabase (database, sign-in, files, scheduled jobs)

- [ ] Create a Supabase **organization** for NB4HS, with both owners as Owners.
- [ ] **Choose:**
  - **(a) Transfer the existing project** into it. Supabase supports moving a project between organizations, which keeps the data, the URL and the keys.
  - **(b) Build a new project** from the migrations (`deploy-and-operations.md` §2). A new project starts empty, and moving the real data in is a separate, planned step.

  Option (a) is simpler and keeps participant data where it already is.
- [ ] **Choose the plan** with the budget in mind. Backups and the plan's limits matter more for participant data than raw capacity.
- [ ] Set the Auth settings: site URL, redirect URLs and custom SMTP (`deploy-and-operations.md` §1).
- [ ] Set the Edge Function secrets and Vault secrets (§1), then deploy both functions.
- [ ] Add developers as **Developers**, not Owners.

## Vercel (hosting)

- [ ] Create a Vercel **team** for NB4HS with both owners. Check the plan terms first: see the budget.
- [ ] Import the repository from the NB4HS GitHub organization.
- [ ] Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` for Production (and Preview, if previews are used).
- [ ] If a custom domain is used: add it to the project, add the DNS record at the registrar, then:
  - set `SITE_URL` (`admin-users`) and `APP_URL` (`send-outbound`) to it
  - add it to Supabase's redirect URLs
- [ ] Retire the old personal project once the new address works.

## After the move: confirm it works

- [ ] Sign in as a staff member on the new address, and run a password reset end to end. The reset email must arrive and the link must open the app.
- [ ] Submit a test staff report and confirm the reviewer receives the in-app notice and the email.
- [ ] The kiosk check-in and the public appointment request work on a phone.
- [ ] `supabase migration list` shows every migration in the repo as applied.
- [ ] Write down who owns what, and where the recovery codes are kept.

## Data rules for the move

- Participant data stays in the production database. Never copy it to a laptop, a preview deployment or a test project.
- Test and development work uses the local stack and its fake accounts (`README-Dev.md`).
