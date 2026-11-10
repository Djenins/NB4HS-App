-- Undo f1_food_signin_events (drops every food sign-up; pickups already
-- logged in food_distributions stay).
alter publication supabase_realtime drop table public.food_signups;
delete from public.api_rate_limits where rpc in ('public_food_event', 'public_food_signup');
drop function if exists public.food_signup_undo_pickup(uuid);
drop function if exists public.food_signup_pickup(uuid, text, text);
drop function if exists public.food_signup_can_record();
drop function if exists public.public_food_signup(uuid, jsonb);
drop function if exists public.public_food_event(uuid);
drop table if exists public.food_signups;
drop table if exists public.food_signin_events;
drop function if exists public.food_address_key(text, text);
