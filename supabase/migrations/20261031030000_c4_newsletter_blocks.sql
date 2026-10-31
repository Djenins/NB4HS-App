-- c4 -- newsletter blocks: a "custom" layout (Build your own) whose content
-- is a list of blocks staff drag in and arrange -- title, header, text,
-- image, link. Builds on c3. The blocks live in newsletters.content
-- ({ "blocks": [...] }, already capped at 60 KB by c3) and are rendered by
-- send-outbound/newsletterLayout.js like the other layouts.
-- APPLIED to vkbzarlkqzvhsfdmxyyq 2026-10-31 (version 20261031030000) with
-- the owner's approval, after a rolled-back dry run of
-- supabase/tests/c4_newsletter_blocks_check.sql passed on live; the checks
-- passed again against live afterwards. send-outbound version 4 (with block
-- rendering) was deployed the same day.
--
-- Rollback: supabase/rollback/c4_newsletter_blocks_down.sql.

alter table public.newsletters drop constraint newsletters_layout_check;
alter table public.newsletters add constraint newsletters_layout_check
  check (layout in ('plain', 'single', 'f_pattern', 'zigzag', 'multi', 'pyramid', 'hybrid', 'double', 'custom'));
