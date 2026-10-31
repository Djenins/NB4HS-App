-- Undo c1_communications. Client messages already queued are cancelled and
-- their rows removed with the new columns' constraints; the log entries they
-- wrote stay in `communications` as ordinary outbound entries.
-- Announcements, their read marks and the templates are dropped.
begin;
alter publication supabase_realtime drop table public.staff_announcements;
drop table public.staff_announcement_reads;
drop table public.staff_announcements;
drop function public.notify_staff_announcement();
drop function public.stamp_announcement_archive();

drop function public.client_messaging_health();
drop function public.cancel_client_message(uuid);
drop function public.client_messages(uuid, int);
drop function public.send_client_message(uuid, text, text, text, text, text, uuid);
drop policy contact_consents_insert_communications on public.contact_consents;
drop policy contact_consents_select_communications on public.contact_consents;
drop table public.message_templates;
drop function public.normalize_phone(text);

drop function public.claim_outbound_messages(int, text[]);
create function public.claim_outbound_messages(p_limit int default 20)
returns setof public.outbound_messages
language plpgsql security definer set search_path = public
as $$
begin
  update public.outbound_messages set status = 'queued'
  where status = 'sending' and updated_at < now() - interval '15 minutes';

  return query
    update public.outbound_messages m
    set status = 'sending', attempts = m.attempts + 1
    where m.id in (
      select id from public.outbound_messages
      where status = 'queued' and next_attempt_at <= now()
      order by next_attempt_at
      limit greatest(1, least(coalesce(p_limit, 20), 100))
      for update skip locked
    )
    returning m.*;
end;
$$;
revoke all on function public.claim_outbound_messages(int) from public, anon, authenticated;
grant execute on function public.claim_outbound_messages(int) to service_role;

update public.communications set outbound_message_id = null where outbound_message_id is not null;
delete from public.outbound_messages where template = 'client_message' or channel <> 'email';
alter table public.outbound_messages drop column queued_by, drop column to_client_id;
alter table public.outbound_messages drop constraint outbound_messages_template_check;
alter table public.outbound_messages add constraint outbound_messages_template_check check (template in (
  'staff_report_submitted', 'staff_report_revision_requested', 'staff_report_acknowledged'));
alter table public.outbound_messages drop constraint outbound_messages_to_address_check;
alter table public.outbound_messages add constraint outbound_messages_to_address_check check (to_address ~ '^[^\s@]+@[^\s@]+\.[^\s@]+$');
alter table public.outbound_messages drop constraint outbound_messages_channel_check;
alter table public.outbound_messages add constraint outbound_messages_channel_check check (channel = 'email');

drop function public.set_communication_follow_up_done(uuid, boolean);
revoke insert (client_id, contact_date, method, direction, summary, follow_up_required, created_by) on public.communications from authenticated;
grant insert, update on public.communications to authenticated;
drop index public.communications_open_follow_ups_idx;
drop index public.communications_contact_date_idx;
alter table public.communications drop column outbound_message_id, drop column follow_up_done_by, drop column follow_up_done_at;

-- Permissions go with their role grants, overrides and effective rows (cascade).
delete from public.permissions where module_key = 'communications';
delete from public.app_modules where key = 'communications';
select public.refresh_all_effective_permissions();

delete from supabase_migrations.schema_migrations where version = '20261030010000';
commit;
