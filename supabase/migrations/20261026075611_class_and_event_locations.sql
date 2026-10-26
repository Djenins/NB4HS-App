-- Where a class meets, and where an office visit / appointment happens --
-- shown on the shared calendar's event cards ("Computer Lab").
-- APPLIED to vkbzarlkqzvhsfdmxyyq 2026-10-26 (version 20261026075611).
-- Additive and nullable: existing rows and the current client are
-- unaffected; the client from this branch writes the new columns.
--
-- * classes.location is set per class on the Manage page. The calendar shows
--   one class-group card per day, so a group whose classes share a room
--   shows that room once.
-- * calendar_events.location is optional on every visit/appointment.
-- No new policies: both tables' existing row policies already cover every
-- column.

alter table public.classes add column if not exists location text;
alter table public.calendar_events add column if not exists location text;
