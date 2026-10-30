# Production deploy runbook: PR #64 (done, superseded)

PR #64 merged as `16a1cc7` and was deployed to production on 2026-10-28 as `dpl_4Cx9ZLXAFZE39Y8tfTL1MTLdRbLf`. PR #66 (`f947437`), PR #68 (`14ac494`) and PR #69 (`02319ad`) have been deployed since. The step-by-step merge instructions and the rollback target that used to be here are out of date, so they were removed on 2026-10-29: following them now would roll production back three releases.

What's current:
- **How production deploys, how to roll the app back, and the acceptance checks:** [launch-readiness-2026-10-29.md](launch-readiness-2026-10-29.md), "Production deploy and rollback" and "Production acceptance checklist".
- **Migrations, database rollbacks, backups, who owns what:** [deploy-and-operations.md](deploy-and-operations.md).
- **The PR #64 history** (dry runs, what was applied, the live security checks): [launch-audit-2026-10-28.md](launch-audit-2026-10-28.md).

The original text is in git history (`git show 7d718a8:plans/deploy-runbook-pr64.md`).
