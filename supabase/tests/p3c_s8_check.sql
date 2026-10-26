-- S8 is fixed: run after p3_policy_parity_before.sql (for its personas),
-- p3c_intake_before.sql, the p3c migration and p3_policy_parity_after.sql
-- (with p3.keep_going on). Ends by raising P3C_S8_FIXED; nothing commits.
do $$
declare
  per record;
  visible int;
  total int;
  cm uuid := (select user_id from p3_personas where persona = 'case_manager');
  staff uuid := (select user_id from p3_personas where persona = 'staff');
  target uuid := (select id from public.clients order by created_at limit 1);
  msg text;
  n_ok int := 0;
begin
  -- Every intake form moved, unchanged, and nothing is left on clients.
  if (select count(*) from p3c_intake_before) <> (select count(*) from public.client_intakes) then
    raise exception 'FAIL: % intake forms before, % moved', (select count(*) from p3c_intake_before), (select count(*) from public.client_intakes);
  end if;
  if exists (select 1 from p3c_intake_before b left join public.client_intakes i on i.client_id = b.id
             where i.form is distinct from b.intake_form) then
    raise exception 'FAIL: an intake form changed in the move';
  end if;
  if exists (select 1 from public.clients where intake_form is not null or intake_form_saved_at is not null) then
    raise exception 'FAIL: intake data still on clients';
  end if;

  -- Make sure there's something to see.
  if target is null then raise exception 'need at least one client to run these checks'; end if;
  insert into public.client_intakes (client_id, form) values (target, '{"household":"check"}')
  on conflict (client_id) do nothing;
  total := (select count(*) from public.client_intakes);

  -- Only people the screen shows intake to can read it.
  for per in select * from p3_personas where user_id is not null loop
    perform set_config('request.jwt.claims', json_build_object('sub', per.user_id, 'role', 'authenticated')::text, true);
    set local role authenticated;
    select count(*) into visible from public.client_intakes;
    reset role;
    if split_part(per.persona, '/', 1) in ('administrator', 'case_manager') and per.persona not like 'inactive%' then
      if visible <> total then raise exception 'FAIL: % sees % of % intake forms', per.persona, visible, total; end if;
    elsif visible <> 0 then
      raise exception 'FAIL: % can read intake forms (S8)', per.persona;
    end if;
    n_ok := n_ok + 1;
  end loop;

  -- An old-style save by a case manager lands in client_intakes...
  perform set_config('request.jwt.claims', json_build_object('sub', cm, 'role', 'authenticated')::text, true);
  set local role authenticated;
  update public.clients set intake_form = '{"household":"saved the old way"}', intake_form_saved_at = now() where id = target;
  reset role;
  if (select form ->> 'household' from public.client_intakes where client_id = target) <> 'saved the old way'
     or (select intake_form from public.clients where id = target) is not null then
    raise exception 'FAIL: an old-style intake save was not routed to client_intakes';
  end if;
  if (select saved_by from public.client_intakes where client_id = target) is distinct from cm then
    raise exception 'FAIL: saved_by is not the case manager';
  end if;

  -- ...and the same save by a staff member is refused.
  perform set_config('request.jwt.claims', json_build_object('sub', staff, 'role', 'authenticated')::text, true);
  set local role authenticated;
  msg := null;
  begin
    update public.clients set intake_form = '{"household":"staff"}' where id = target;
  exception when others then msg := sqlerrm;
  end;
  reset role;
  if msg is null then raise exception 'FAIL: a staff member saved an intake form'; end if;

  raise exception 'P3C_S8_FIXED: % intake forms moved intact; only administrators and case managers read them (% people checked); old-style saves rerouted, staff refused',
    (select count(*) from p3c_intake_before), n_ok;
end $$;
