-- The policy answers p3d_snap_policies changes on purpose. Run after
-- p3_policy_parity_before.sql.
--
-- contact_consents used has_any_program_role(worker, supervisor,
-- program_admin), which a Staff Reports schedule admin (program role
-- 'program_admin' in program 'staff_reports') also passed -- so they could
-- read and record SNAP clients' contact consents. Consents now need a SNAP
-- permission. Nobody on the live database holds that Staff Reports role
-- (checked 2026-10-26), so no real person loses anything.
insert into p3_expected (role, wf, tbl, was, now, persona_like)
select '*', w, 'contact_consents', true, false, '%/staff_reports:program_admin'
from unnest(array['off', 'on', 'live']) w;
