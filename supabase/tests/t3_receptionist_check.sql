-- Checks for t3_receptionist_check_in_only. Run AFTER the migration; ends by
-- raising 'T3_CHECKS_PASSED', so nothing is committed. Needs an active
-- receptionist with no other role (supabase/seed.sql has one).
do $$
declare
  rec uuid := (select p.id from public.profiles p where p.active and p.role = 'receptionist'
               and not exists (select 1 from public.program_staff ps where ps.user_id = p.id and ps.active) limit 1);
  v_class text;
  v_student uuid;
  v_visit public.visits;
  n int;
  msg text;
begin
  if rec is null then raise exception 'need an active receptionist'; end if;
  insert into public.clients (first_name, last_name) values ('T3', 'Client');
  select key into v_class from public.classes order by key limit 1;
  if v_class is null then
    insert into public.classes (key, name) values ('t3-class', 'T3 Class') returning key into v_class;
  end if;
  insert into public.students (first_name, last_name, class_key) values ('T3', 'Student', v_class) returning id into v_student;
  if exists (select 1 from public.user_effective_permissions where user_id = rec and permission_key like 'participants.%') then
    raise exception 'FAIL: the receptionist still holds a participants permission';
  end if;

  perform set_config('request.jwt.claims', json_build_object('sub', rec, 'role', 'authenticated')::text, true);
  set local role authenticated;
  -- Records: shut.
  if exists (select 1 from public.clients) or exists (select 1 from public.students) then
    raise exception 'FAIL: the receptionist can read clients or students';
  end if;
  msg := null;
  begin insert into public.clients (first_name, last_name) values ('T3', 'Denied'); exception when others then msg := sqlerrm; end;
  if msg is null then raise exception 'FAIL: the receptionist created a client'; end if;
  update public.classes set name = name where key = v_class;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: the receptionist edited a class'; end if;
  -- Check-in: still works.
  if not exists (select 1 from public.kiosk_roster() r where r.id = v_student) then
    raise exception 'FAIL: the kiosk roster does not list the student';
  end if;
  v_visit := public.kiosk_create_visit(jsonb_build_object('first_name', 'T3', 'last_name', 'Visitor',
                                                         'service', 'Case Management', 'phone', '4015550100'));
  if v_visit.id is null then raise exception 'FAIL: visitor check-in failed'; end if;
  perform public.kiosk_student_check_in(v_student, current_date);
  if (select count(*) from public.visits where visit_date = current_date) < 2 then
    raise exception 'FAIL: the receptionist cannot read today''s visits';
  end if;
  perform public.check_out_visit(v_visit.id);
  if (select time_out from public.visits where id = v_visit.id) is null then
    raise exception 'FAIL: the receptionist could not check a visitor out';
  end if;
  reset role;
  raise exception 'T3_CHECKS_PASSED';
end $$;
