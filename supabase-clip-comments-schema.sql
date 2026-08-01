-- Run this once in the Supabase SQL Editor, AFTER supabase-clip-schema.sql.
-- Adds streamer_name to community_clips, plus a comment+like thread scoped
-- to whichever clip is currently featured.

alter table community_clips add column streamer_name text;

create table community_clip_comments (
  id uuid primary key default gen_random_uuid(),
  clip_id uuid not null references community_clips(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  comment text not null check (char_length(comment) between 1 and 500),
  likes_count int not null default 0,
  created_at timestamptz not null default now()
);

create table community_clip_comment_likes (
  id uuid primary key default gen_random_uuid(),
  comment_id uuid not null references community_clip_comments(id) on delete cascade,
  visitor_id text not null,
  created_at timestamptz not null default now(),
  unique (comment_id, visitor_id)
);

alter table community_clip_comments enable row level security;
alter table community_clip_comment_likes enable row level security;

create policy "public read clip comments" on community_clip_comments
  for select using (true);
create policy "public insert clip comments" on community_clip_comments
  for insert with check (true);

-- No policies at all on community_clip_comment_likes for anon -- only
-- touched from inside toggle_clip_comment_like(), which runs as the table
-- owner (SECURITY DEFINER) and bypasses RLS.

create or replace function toggle_clip_comment_like(p_comment_id uuid, p_visitor_id text)
returns table (likes_count int, liked boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  existing uuid;
begin
  select id into existing
  from community_clip_comment_likes
  where comment_id = p_comment_id and visitor_id = p_visitor_id;

  if existing is null then
    insert into community_clip_comment_likes (comment_id, visitor_id)
    values (p_comment_id, p_visitor_id);
    update community_clip_comments set likes_count = community_clip_comments.likes_count + 1
      where id = p_comment_id;
  else
    delete from community_clip_comment_likes where id = existing;
    update community_clip_comments set likes_count = greatest(community_clip_comments.likes_count - 1, 0)
      where id = p_comment_id;
  end if;

  return query
    select c.likes_count, existing is null as liked
    from community_clip_comments c
    where c.id = p_comment_id;
end;
$$;

grant execute on function toggle_clip_comment_like(uuid, text) to anon;
