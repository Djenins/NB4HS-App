-- Undo t3_receptionist_check_in_only: receptionists get participants.view
-- and participants.edit back at org scope, as p3a granted them.
begin;
insert into public.role_permissions (role_id, permission_key, scope)
select r.id, k, 'org' from public.roles r
cross join unnest(array['participants.view', 'participants.edit']) k
where r.key = 'legacy_receptionist'
on conflict do nothing;
delete from supabase_migrations.schema_migrations where version = '20261028030000';
commit;
