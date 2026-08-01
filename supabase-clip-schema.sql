-- Run this once in the Supabase SQL Editor for your project.
-- Adds the "Clip of the Week" table. Anon can only read -- you add/change
-- the featured clip by inserting a new row directly in the Table Editor
-- (Table Editor -> community_clips -> Insert row). The site always shows
-- the most recently inserted row.

create table community_clips (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 100),
  url text not null,
  created_at timestamptz not null default now()
);

alter table community_clips enable row level security;

create policy "public read clips" on community_clips
  for select using (true);

-- No insert/update/delete policy for anon -- clips are only ever added
-- by you, directly in the Supabase Table Editor.
