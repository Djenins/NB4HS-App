-- Recovered verbatim from supabase_migrations.schema_migrations (already applied to project vkbzarlkqzvhsfdmxyyq).

alter publication supabase_realtime add table
  public.clients,
  public.case_clients,
  public.job_clients,
  public.food_clients,
  public.appointments,
  public.custom_options,
  public.disabled_options,
  public.sessions,
  public.past_session_students,
  public.profiles,
  public.notifications,
  public.calendar_events;
