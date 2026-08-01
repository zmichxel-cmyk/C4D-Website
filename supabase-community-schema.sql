-- Run this once in the Supabase SQL Editor for your project.
-- Creates the community comments/ratings/likes schema with row-level
-- security locked down so the public anon key can only insert comments,
-- read comments, and call toggle_like() -- it can never edit likes_count
-- or another visitor's row directly.

create extension if not exists pgcrypto;

create table community_comments (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 40),
  comment text not null check (char_length(comment) between 1 and 500),
  rating smallint check (rating between 1 and 5),
  likes_count int not null default 0,
  created_at timestamptz not null default now()
);

create table community_comment_likes (
  id uuid primary key default gen_random_uuid(),
  comment_id uuid not null references community_comments(id) on delete cascade,
  visitor_id text not null,
  created_at timestamptz not null default now(),
  unique (comment_id, visitor_id)
);

alter table community_comments enable row level security;
alter table community_comment_likes enable row level security;

-- Anyone can read and post comments; nobody can update/delete via the API
-- (likes_count is only ever changed by the SECURITY DEFINER function below).
create policy "public read comments" on community_comments
  for select using (true);

create policy "public insert comments" on community_comments
  for insert with check (true);

-- No select/insert/update/delete policies on community_comment_likes for
-- anon -- it's only touched from inside toggle_like(), which runs as the
-- table owner (SECURITY DEFINER) and bypasses RLS.

create or replace function toggle_like(p_comment_id uuid, p_visitor_id text)
returns table (likes_count int, liked boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  existing uuid;
begin
  select id into existing
  from community_comment_likes
  where comment_id = p_comment_id and visitor_id = p_visitor_id;

  if existing is null then
    insert into community_comment_likes (comment_id, visitor_id)
    values (p_comment_id, p_visitor_id);
    -- Table column is qualified below because `likes_count` is ALSO the
    -- name of this function's RETURNS TABLE output column, which PL/pgSQL
    -- treats as an implicitly-declared variable in scope here -- an
    -- unqualified reference is ambiguous between the two.
    update community_comments set likes_count = community_comments.likes_count + 1
      where id = p_comment_id;
  else
    delete from community_comment_likes where id = existing;
    update community_comments set likes_count = greatest(community_comments.likes_count - 1, 0)
      where id = p_comment_id;
  end if;

  return query
    select c.likes_count, existing is null as liked
    from community_comments c
    where c.id = p_comment_id;
end;
$$;

grant execute on function toggle_like(uuid, text) to anon;
