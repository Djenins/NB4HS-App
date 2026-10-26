-- Probe rows for the shared-tables policy parity check (p3f). Run BEFORE
-- p3_policy_parity_before.sql (which switches to row mode). Covers each
-- note visibility (private / department / everyone) x department (job /
-- case / general) x author (the person / someone else) x appointment owner
-- (the person's email / someone else's), in the client-documents bucket.
create temp table p3_probes (label text primary key, data jsonb) on commit drop;
insert into p3_probes (label, data)
select format('vis=%s,dept=%s,by=%s,appt=%s', v.label, d.label, b.label, a.label),
       jsonb_build_object('visibility', v.val, 'department', d.val, 'created_by', b.val,
                          'assigned_email', a.val, 'bucket_id', 'client-documents')
from (values ('private', '"private"'::jsonb), ('department', '"department"'::jsonb), ('everyone', 'null'::jsonb)) v(label, val)
cross join (values ('job', '"job"'::jsonb), ('case', '"case"'::jsonb), ('general', 'null'::jsonb)) d(label, val)
cross join (values ('me', '"$me"'::jsonb), ('other', to_jsonb(gen_random_uuid()::text))) b(label, val)
cross join (values ('me', '"$myemail"'::jsonb), ('other', '"someone.else@example.invalid"'::jsonb)) a(label, val);
