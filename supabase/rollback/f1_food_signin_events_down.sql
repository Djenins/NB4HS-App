-- Undo f1_food_signin_events (drops every online food sign-in).
alter publication supabase_realtime drop table public.food_signins;
delete from public.api_rate_limits where rpc in ('public_food_event', 'public_food_signin');
drop function if exists public.public_food_signin(uuid, jsonb);
drop function if exists public.public_food_event(uuid);
drop table if exists public.food_signins;
drop table if exists public.food_signin_events;
