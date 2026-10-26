-- Run before p3c_case_management_policies (after p3_policy_parity_before.sql):
-- remembers every intake form so p3c_s8_check.sql can confirm none was lost.
create temp table p3c_intake_before on commit drop as
select id, intake_form, intake_form_saved_at from public.clients where intake_form is not null;
