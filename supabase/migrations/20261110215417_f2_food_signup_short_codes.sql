-- f2 -- short sign-up links for food distribution events.
-- APPLIED to vkbzarlkqzvhsfdmxyyq 2026-11-10 (version 20261110215417) after a
-- rolled-back dry run on live; public_food_event_code() was then replaced on
-- live with the version below, which defers to public_food_event(). The check
-- script passed against live afterwards (rolled back). Not the same migration as
-- f2_food_programs_snap, which shares the "f2" label.
-- Checks: supabase/tests/f2_food_short_code_check.sql.
-- Undo with supabase/rollback/f2_food_signup_short_codes_down.sql.
--
-- Every event gets a 5-character code, so its public sign-up link is
-- app.nb4hs.org/f/<code> instead of /food-signup/<uuid>. The old uuid links
-- keep working. Codes are lowercase letters and digits without the ones that
-- are easy to misread (0/o, 1/i/l), and are matched case-insensitively, so
-- a link typed in from a flyer still works.

create or replace function public.food_new_short_code()
returns text
language plpgsql volatile set search_path = public
as $$
declare
  alphabet constant text := '23456789abcdefghjkmnpqrstuvwxyz';
  c text;
begin
  loop
    select string_agg(substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1), '')
      into c from generate_series(1, 5);
    exit when not exists (select 1 from public.food_signin_events where short_code = c);
  end loop;
  return c;
end;
$$;
revoke all on function public.food_new_short_code() from public, anon;
grant execute on function public.food_new_short_code() to authenticated;

alter table public.food_signin_events add column short_code text;
update public.food_signin_events set short_code = public.food_new_short_code() where short_code is null;
alter table public.food_signin_events
  alter column short_code set default public.food_new_short_code(),
  alter column short_code set not null,
  add constraint food_signin_events_short_code_format check (short_code ~ '^[2-9a-hjkmnp-z]{5}$'),
  add constraint food_signin_events_short_code_key unique (short_code);

-- The public page opened from a short link: whatever public_food_event()
-- answers for the event (so the two never drift apart), plus the event id the
-- sign-up is sent with. Null for an unknown code.
create or replace function public.public_food_event_code(p_code text)
returns jsonb
language sql volatile security definer set search_path = public
as $$
  select public.public_food_event(e.id) || jsonb_build_object('id', e.id)
  from public.food_signin_events e where e.short_code = lower(btrim(coalesce(p_code, '')));
$$;
revoke all on function public.public_food_event_code(text) from public;
grant execute on function public.public_food_event_code(text) to anon, authenticated;

insert into public.api_rate_limits (rpc, per_hour) values ('public_food_event_code', 1200)
on conflict (rpc) do update set per_hour = excluded.per_hour;
