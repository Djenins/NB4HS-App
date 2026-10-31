-- c4 -- newsletter blocks: a "custom" layout (Build your own) whose content
-- is a list of blocks staff drag in and arrange -- title, header, text,
-- image, link. Builds on c3. The blocks live in newsletters.content
-- ({ "blocks": [...] }, already capped at 60 KB by c3) and are rendered by
-- send-outbound/newsletterLayout.js like the other layouts.
-- NOT APPLIED to live. Needs a rolled-back dry run of
-- supabase/tests/c4_newsletter_blocks_check.sql against live, then the
-- owner's approval, like every migration (plans/goals.md).
--
-- Rollback: supabase/rollback/c4_newsletter_blocks_down.sql.

alter table public.newsletters drop constraint newsletters_layout_check;
alter table public.newsletters add constraint newsletters_layout_check
  check (layout in ('plain', 'single', 'f_pattern', 'zigzag', 'multi', 'pyramid', 'hybrid', 'double', 'custom'));
