-- Checks for t5_notifications_read_only. Run AFTER the migration; ends by
-- raising 'T5_CHECKS_PASSED', so nothing is committed. Uses throwaway accounts.
create or replace function pg_temp.dryrun_account(p_role text) returns uuid language plpgsql as $f$
declare uid uuid := gen_random_uuid();
begin
  insert into auth.users (id, email, raw_user_meta_data) values (uid, 'dryrun-' || uid || '@example.invalid', '{}');
  update public.profiles set role = p_role, active = true, name = 'Dry run ' || p_role where id = uid;
  return uid;
end $f$;

do $$
declare
  me uuid := pg_temp.dryrun_account('staff');
  other uuid := pg_temp.dryrun_account('staff');
  mine uuid;
  theirs uuid;
  n int;
  msg text;
begin
  insert into public.notifications (user_id, type, title, message, link) values (me, 'staff_report_due', 'Report due', 'T5', '/myreports') returning id into mine;
  insert into public.notifications (user_id, type, title, message) values (other, 'staff_report_due', 'Report due', 'T5') returning id into theirs;

  perform set_config('request.jwt.claims', json_build_object('sub', me, 'role', 'authenticated')::text, true);
  set local role authenticated;
  update public.notifications set read = true where id = mine;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'FAIL: could not mark my own notification read'; end if;
  update public.notifications set read = false where id = mine;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'FAIL: could not mark my own notification unread'; end if;
  msg := null;
  begin update public.notifications set title = 'changed' where id = mine; exception when others then msg := sqlerrm; end;
  if msg is null or msg not like 'permission denied%' then raise exception 'FAIL: changed the title of my notification (%)', msg; end if;
  msg := null;
  begin update public.notifications set link = '/admin' where id = mine; exception when others then msg := sqlerrm; end;
  if msg is null then raise exception 'FAIL: changed the link of my notification'; end if;
  update public.notifications set read = true where id = theirs;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: marked someone else''s notification read'; end if;
  msg := null;
  begin insert into public.notifications (user_id, type, title) values (me, 'x', 'forged'); exception when others then msg := sqlerrm; end;
  if msg is null then raise exception 'FAIL: inserted a notification'; end if;
  reset role;

  -- Server-side writers (security definer) are unaffected.
  if (select title from public.notifications where id = mine) <> 'Report due' then raise exception 'FAIL: title changed'; end if;
  raise exception 'T5_CHECKS_PASSED';
end $$;
