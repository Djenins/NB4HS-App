-- Phase 1, part C -- one grant p1b missed.
-- APPLIED to vkbzarlkqzvhsfdmxyyq 2026-10-26 (version 20261026170000), after a
-- rolled-back dry run. Verified afterwards: anon can no longer execute it,
-- authenticated still can, and no Phase 1 security-definer function is
-- executable by anon.
--
-- is_program_module() was created without a revoke, so the default PUBLIC
-- grant let anonymous visitors call it (Supabase security advisor). It only
-- says whether a key names a program, but nothing outside the app needs it.
-- Signed-in users keep EXECUTE: validate_access_row() runs with the caller's
-- rights and calls it whenever an admin writes an access row.
revoke all on function public.is_program_module(text) from public, anon;
grant execute on function public.is_program_module(text) to authenticated;
