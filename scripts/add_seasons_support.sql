-- Adds multi-season support
-- Run this in your Supabase SQL editor before using the seasons features.

create table if not exists public.seasons (
  id uuid primary key default gen_random_uuid(),
  season_number int8 not null unique,
  winning_driver text null,
  winning_constructor text null,
  is_finalized boolean not null default false,
  finalized_at timestamptz null,
  created_at timestamptz not null default now()
);

alter table public.seasons
  add column if not exists is_finalized boolean not null default false;

alter table public.seasons
  add column if not exists finalized_at timestamptz null;

alter table public.selected_tracks
  add column if not exists season_id uuid null references public.seasons(id) on delete set null;

alter table public.schedules
  add column if not exists season_id uuid null references public.seasons(id) on delete set null;

alter table public.results
  add column if not exists season_id uuid null references public.seasons(id) on delete set null;
alter table public.results
  add column if not exists team_id uuid null references public.teams(id) on delete set null;

alter table public.qualifying
  add column if not exists season_id uuid null references public.seasons(id) on delete set null;

create index if not exists idx_selected_tracks_season_id on public.selected_tracks(season_id);
create index if not exists idx_schedules_season_id on public.schedules(season_id);
create index if not exists idx_results_season_id on public.results(season_id);
create index if not exists idx_results_team_id on public.results(team_id);
create index if not exists idx_qualifying_season_id on public.qualifying(season_id);

create table if not exists public.season_driver_entries (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons(id) on delete cascade,
  driver_id uuid not null references public.drivers(id) on delete cascade,
  team_id uuid null references public.teams(id) on delete set null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique(season_id, driver_id)
);

create index if not exists idx_season_driver_entries_season_id on public.season_driver_entries(season_id);
create index if not exists idx_season_driver_entries_driver_id on public.season_driver_entries(driver_id);

update public.results r
set team_id = d.team
from public.drivers d
where r.driver = d.id
  and r.team_id is null;

create table if not exists public.season_teams (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  name text not null,
  logo text null,
  car_image text null,
  points numeric null,
  unique(season_id, team_id)
);

create table if not exists public.season_drivers (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons(id) on delete cascade,
  driver_id uuid not null references public.drivers(id) on delete cascade,
  team_id uuid null references public.teams(id) on delete set null,
  name text not null,
  driver_number int null,
  image text null,
  points numeric null,
  unique(season_id, driver_id)
);

create table if not exists public.season_selected_tracks (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons(id) on delete cascade,
  selected_track_id uuid not null references public.selected_tracks(id) on delete cascade,
  track_id uuid null references public.tracks(id) on delete set null,
  type text not null,
  unique(season_id, selected_track_id)
);

create table if not exists public.season_schedules (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons(id) on delete cascade,
  schedule_id uuid not null references public.schedules(id) on delete cascade,
  selected_track_id uuid not null references public.selected_tracks(id) on delete cascade,
  date date null,
  unique(season_id, schedule_id)
);

create table if not exists public.season_results (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons(id) on delete cascade,
  result_id uuid not null references public.results(id) on delete cascade,
  selected_track_id uuid not null references public.selected_tracks(id) on delete cascade,
  driver_id uuid not null references public.drivers(id) on delete cascade,
  team_id uuid null references public.teams(id) on delete set null,
  finishing_position int null,
  qualified_position int null,
  pole boolean null,
  fastestlap boolean null,
  racefinished boolean null,
  unique(season_id, result_id)
);

create index if not exists idx_season_teams_season_id on public.season_teams(season_id);
create index if not exists idx_season_drivers_season_id on public.season_drivers(season_id);
create index if not exists idx_season_selected_tracks_season_id on public.season_selected_tracks(season_id);
create index if not exists idx_season_schedules_season_id on public.season_schedules(season_id);
create index if not exists idx_season_results_season_id on public.season_results(season_id);

