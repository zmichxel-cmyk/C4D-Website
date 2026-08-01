-- Run this once in the Supabase SQL Editor for your project.
-- Adds the "Connect" forum: posts, replies, and post likes.
-- Same lockdown pattern as supabase-community-schema.sql: anon can only
-- read, insert posts/replies, and call toggle_post_like() -- never edit
-- likes_count or another visitor's row directly.

create table community_posts (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 40),
  category text not null check (category in ('lfg', 'game_chat', 'general')),
  title text not null check (char_length(title) between 1 and 100),
  body text not null check (char_length(body) between 1 and 1000),
  likes_count int not null default 0,
  created_at timestamptz not null default now()
);

create table community_post_likes (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references community_posts(id) on delete cascade,
  visitor_id text not null,
  created_at timestamptz not null default now(),
  unique (post_id, visitor_id)
);

create table community_post_replies (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references community_posts(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  body text not null check (char_length(body) between 1 and 500),
  created_at timestamptz not null default now()
);

alter table community_posts enable row level security;
alter table community_post_likes enable row level security;
alter table community_post_replies enable row level security;

create policy "public read posts" on community_posts
  for select using (true);
create policy "public insert posts" on community_posts
  for insert with check (true);

create policy "public read replies" on community_post_replies
  for select using (true);
create policy "public insert replies" on community_post_replies
  for insert with check (true);

-- No policies at all on community_post_likes for anon -- only touched
-- from inside toggle_post_like(), which runs as the table owner
-- (SECURITY DEFINER) and bypasses RLS.

create or replace function toggle_post_like(p_post_id uuid, p_visitor_id text)
returns table (likes_count int, liked boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  existing uuid;
begin
  select id into existing
  from community_post_likes
  where post_id = p_post_id and visitor_id = p_visitor_id;

  if existing is null then
    insert into community_post_likes (post_id, visitor_id)
    values (p_post_id, p_visitor_id);
    update community_posts set likes_count = community_posts.likes_count + 1
      where id = p_post_id;
  else
    delete from community_post_likes where id = existing;
    update community_posts set likes_count = greatest(community_posts.likes_count - 1, 0)
      where id = p_post_id;
  end if;

  return query
    select p.likes_count, existing is null as liked
    from community_posts p
    where p.id = p_post_id;
end;
$$;

grant execute on function toggle_post_like(uuid, text) to anon;
