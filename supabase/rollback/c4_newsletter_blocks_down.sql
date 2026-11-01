-- Undo c4_newsletter_blocks. Drafts built from blocks become plain-text
-- drafts (their body already holds the plain-text version; the blocks stay
-- in content, unused). Sent ones keep their layout in the queued payload.
begin;
update public.newsletters set layout = 'plain' where layout = 'custom';
alter table public.newsletters drop constraint newsletters_layout_check;
alter table public.newsletters add constraint newsletters_layout_check
  check (layout in ('plain', 'single', 'f_pattern', 'zigzag', 'multi', 'pyramid', 'hybrid', 'double'));
delete from supabase_migrations.schema_migrations where version = '20261031030000';
commit;
