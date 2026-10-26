-- The policy answers p3b_workforce_policies changes on purpose (audit finding
-- S7: the database now follows the Workforce Development Access setting).
-- Run after p3_policy_parity_before.sql; p3_policy_parity_after.sql then
-- fails on any change NOT listed here. With the setting as it is on the live
-- database ('live'), nothing is listed, so nothing may change.

-- Setting on: staff, receptionists and case managers get the Workforce data.
insert into p3_expected (role, wf, tbl, was, now)
select r, 'on', t, false, true
from unnest(array['staff', 'receptionist', 'case_manager']) r,
     unnest(array['employers', 'employer_activity', 'employer_notes', 'employer_documents', 'job_openings',
                   'referrals', 'placements', 'placement_checkins', 'job_clients']) t;

-- Setting off: job developers lose employer, job, referral and placement
-- data (they keep their job seekers and applications).
insert into p3_expected (role, wf, tbl, was, now)
select 'job_developer', 'off', t, true, false
from unnest(array['employers', 'employer_activity', 'employer_notes', 'employer_documents', 'job_openings',
                  'referrals', 'placements', 'placement_checkins']) t;
