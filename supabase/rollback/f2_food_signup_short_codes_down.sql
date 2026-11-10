-- Undo f2_food_signup_short_codes (short /f/<code> links stop working; the
-- /food-signup/<uuid> links are unaffected).
delete from public.api_rate_limits where rpc = 'public_food_event_code';
drop function if exists public.public_food_event_code(text);
alter table public.food_signin_events drop column if exists short_code;
drop function if exists public.food_new_short_code();
