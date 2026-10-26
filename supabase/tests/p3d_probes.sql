-- Probe rows for the SNAP / Outreach policy parity check (p3d). Run BEFORE
-- p3_policy_parity_before.sql, which switches to row mode when p3_probes
-- exists. Every combination of who a record is assigned to (the person,
-- someone else, nobody) and who created / logged / captured it (the person,
-- someone else); '$me' is replaced by each simulated person in turn.
--
-- One throwaway outreach contact is created so the case policies' "must
-- belong to a real contact" check has something to match. Rolled back with
-- everything else.
create temp table p3_probe_ctx on commit drop as
select c.id as client_id, gen_random_uuid() as contact_id, gen_random_uuid() as other_id
from public.clients c order by c.created_at limit 1;

insert into public.outreach_contacts (id, program, client_id, assigned_to, created_by)
select contact_id, 'snap', client_id, null, null from p3_probe_ctx;

create temp table p3_probes (label text primary key, data jsonb) on commit drop;
insert into p3_probes (label, data)
select format('assigned=%s,by=%s', a.label, b.label),
       jsonb_build_object(
         'program', 'snap', 'client_id', x.client_id, 'outreach_contact_id', x.contact_id,
         'assigned_to', a.val, 'created_by', b.val, 'staff_id', b.val, 'captured_by', b.val,
         'occurred_at', now(), 'source', 'manual', 'automation_key', null, 'case_id', null)
from p3_probe_ctx x
cross join (values ('me', to_jsonb('$me'::text)), ('other', to_jsonb((select other_id from p3_probe_ctx)::text)), ('nobody', 'null'::jsonb)) a(label, val)
cross join (values ('me', to_jsonb('$me'::text)), ('other', to_jsonb((select other_id from p3_probe_ctx)::text))) b(label, val);
