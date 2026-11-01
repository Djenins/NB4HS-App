-- Undo c2_newsletters. Newsletter emails still waiting are removed from the
-- queue; their log entries stay in `communications` as ordinary outbound
-- emails. Opt-outs recorded through unsubscribe links stay in
-- contact_consents: they are the clients' answers, not newsletter data.
begin;
delete from public.api_rate_limits where rpc = 'unsubscribe_newsletter';
drop function public.unsubscribe_newsletter(text);
drop function public.newsletter_stats();
drop function public.cancel_newsletter(uuid);
drop function public.send_newsletter(uuid);
drop function public.newsletter_audience_count(text);
drop function public.newsletter_audience_clients(text);

update public.communications set outbound_message_id = null
where outbound_message_id in (select id from public.outbound_messages where template = 'newsletter');
drop table public.newsletter_recipients;
drop table public.newsletters;
delete from public.outbound_messages where template = 'newsletter';
alter table public.outbound_messages drop constraint outbound_messages_template_check;
alter table public.outbound_messages add constraint outbound_messages_template_check check (template in (
  'staff_report_submitted', 'staff_report_revision_requested', 'staff_report_acknowledged', 'client_message'));

-- admin_set_setting as p5a left it; the saved address goes with it.
create or replace function public.admin_set_setting(p_key text, p_value jsonb, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.admin_require('admin.settings.manage');
  if p_key = 'closing_time' then
    if jsonb_typeof(p_value) <> 'string' or (p_value #>> '{}') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then
      raise exception 'the closing time must look like 17:00' using errcode = '22023';
    end if;
  else
    raise exception 'unknown setting %', p_key using errcode = '22023';
  end if;
  perform set_config('nb4hs.audit_reason', coalesce(btrim(p_reason), ''), true);
  insert into public.app_settings (key, value, updated_by) values (p_key, p_value, auth.uid())
  on conflict (key) do update set value = excluded.value, updated_by = excluded.updated_by
  where app_settings.value is distinct from excluded.value;
end;
$$;
delete from public.app_settings where key = 'mailing_address';

delete from public.permissions where key = 'communications.newsletters.send';
select public.refresh_all_effective_permissions();

delete from supabase_migrations.schema_migrations where version = '20261031010000';
commit;
