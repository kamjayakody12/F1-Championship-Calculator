-- Adds a dedicated celebration video field for drivers.
-- Run this in Supabase SQL editor.

alter table public.drivers
  add column if not exists celebration_video text null;

-- Optional backfill: if an older `video` column exists, copy values once.
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'drivers'
      and column_name = 'video'
  ) then
    execute '
      update public.drivers
      set celebration_video = coalesce(celebration_video, video)
      where video is not null
    ';
  end if;
end $$;

