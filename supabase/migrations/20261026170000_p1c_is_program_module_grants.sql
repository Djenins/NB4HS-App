-- Phase 1, part C -- one grant p1b missed. NOT YET APPLIED.
--
-- is_program_module() was created without a revoke, so the default PUBLIC
-- grant let anonymous visitors call it (Supabase security advisor). It only
-- says whether a key names a program, but nothing outside the app needs it.
-- Signed-in users keep EXECUTE: validate_access_row() runs with the caller's
-- rights and calls it whenever an admin writes an access row.
revoke all on function public.is_program_module(text) from public, anon;
grant execute on function public.is_program_module(text) to authenticated;
