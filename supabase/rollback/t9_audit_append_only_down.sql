-- Undo t9_audit_append_only: audit_events is guarded as p1a left it.
-- The foreign keys come back NOT VALID, because rows written after t9 may
-- name an account that has since been deleted; new rows are checked again.
begin;
grant update, delete, truncate on public.audit_events to postgres;
grant insert on public.audit_events to service_role;
alter table public.profiles enable trigger profiles_audit;
alter table public.audit_events enable trigger audit_events_no_truncate;
alter table public.audit_events enable trigger audit_events_no_update_delete;
alter table public.audit_events add constraint audit_events_subject_user_id_fkey
  foreign key (subject_user_id) references public.profiles(id) on delete set null not valid;
alter table public.audit_events add constraint audit_events_actor_id_fkey
  foreign key (actor_id) references public.profiles(id) on delete set null not valid;
delete from supabase_migrations.schema_migrations where version = '20261030010000';
commit;
