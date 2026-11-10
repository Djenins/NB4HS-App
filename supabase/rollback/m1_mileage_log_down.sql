-- Undo m1_mileage_log: drop the mileage log and put admin_set_setting back
-- to c2_newsletters' version. Trips are lost (export them first); the
-- 'mileage_rate' row in app_settings is removed too.
drop table if exists public.mileage_trips;
drop function if exists public.mileage_trips_guard();
drop function if exists public.mileage_team();
drop function if exists public.mileage_can_view(uuid);
delete from public.app_settings where key = 'mileage_rate';

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
  elsif p_key = 'mailing_address' then
    if jsonb_typeof(p_value) <> 'string' or char_length(btrim(p_value #>> '{}')) not between 10 and 300 then
      raise exception 'the mailing address must be 10 to 300 characters' using errcode = '22023';
    end if;
    p_value := to_jsonb(btrim(p_value #>> '{}'));
  else
    raise exception 'unknown setting %', p_key using errcode = '22023';
  end if;
  perform set_config('nb4hs.audit_reason', coalesce(btrim(p_reason), ''), true);
  insert into public.app_settings (key, value, updated_by) values (p_key, p_value, auth.uid())
  on conflict (key) do update set value = excluded.value, updated_by = excluded.updated_by
  where app_settings.value is distinct from excluded.value;
end;
$$;
