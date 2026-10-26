-- Adult Education courses: the subjects a classroom teaches (Computer
-- Literacy, ESL, ...). Staff can add or remove courses from the Adult
-- Education > Classrooms section. A classroom points at one course; deleting
-- a course leaves its classrooms in place, just unassigned.
create table if not exists public.courses (
  key text primary key,
  name text not null,
  created_at timestamptz not null default now()
);

alter table public.courses enable row level security;

-- Same shape as classes: course names aren't personal data, so reads stay public.
create policy courses_select on public.courses for select using (true);
create policy courses_insert on public.courses for insert to authenticated with check (is_staff());
create policy courses_update on public.courses for update to authenticated using (is_staff()) with check (is_staff());
create policy courses_delete on public.courses for delete to authenticated using (is_staff());

insert into public.courses (key, name) values
  ('computer_literacy', 'Computer Literacy'),
  ('esl', 'ESL')
on conflict (key) do nothing;

alter table public.classes add column if not exists course_key text references public.courses(key) on delete set null;

-- Existing classrooms: the levels are ESL (taught by the ESL instructor),
-- Online is the computer instructor's class.
update public.classes set course_key = 'esl' where course_key is null and staff = 'esl_instructor';
update public.classes set course_key = 'computer_literacy' where course_key is null and staff = 'computer_instructor';

alter publication supabase_realtime add table public.courses;
