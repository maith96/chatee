-- Persona database schema.
-- Run this once in Supabase: Dashboard -> SQL Editor -> New query -> paste -> Run.

create table if not exists public.conversations (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade default auth.uid(),
  title       text not null default 'New conversation',
  model       text not null default 'terra-fast',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.messages (
  id               uuid primary key default gen_random_uuid(),
  conversation_id  uuid not null references public.conversations(id) on delete cascade,
  user_id          uuid not null references auth.users(id) on delete cascade default auth.uid(),
  role             text not null check (role in ('user', 'assistant')),
  content          text not null,
  model            text,
  created_at       timestamptz not null default now()
);

create index if not exists conversations_user_updated_idx on public.conversations (user_id, updated_at desc);
create index if not exists messages_conversation_created_idx on public.messages (conversation_id, created_at);
create index if not exists messages_user_created_idx on public.messages (user_id, created_at desc);

-- Table privileges for signed-in users. Newer Supabase projects don't grant these
-- automatically for tables created in SQL. Anonymous visitors get no access.
-- (RLS below still limits each user to their own rows.)
grant usage on schema public to authenticated;
grant select, insert, update, delete on public.conversations to authenticated;
grant select, insert, update, delete on public.messages to authenticated;

-- Row Level Security: every user can only see and change their own rows.
-- This is what keeps the public API safe: requests run as the signed-in user.
alter table public.conversations enable row level security;
alter table public.messages enable row level security;

drop policy if exists "own conversations" on public.conversations;
create policy "own conversations" on public.conversations
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own messages" on public.messages;
create policy "own messages" on public.messages
  for all using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.conversations c
      where c.id = conversation_id and c.user_id = auth.uid()
    )
  );

-- Bump conversations.updated_at whenever a message is added, so "Recent" stays sorted.
create or replace function public.touch_conversation() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.conversations set updated_at = now() where id = new.conversation_id;
  return new;
end;
$$;

drop trigger if exists messages_touch_conversation on public.messages;
create trigger messages_touch_conversation
  after insert on public.messages
  for each row execute function public.touch_conversation();

-- =====================================================================
-- v2: 18+ confirmation and personas. Safe to re-run.
-- After running this file, also run supabase/personas-seed.sql to load the built-in personas.
-- =====================================================================

-- One row per user. Only the confirmation time is stored, never the birthdate.
create table if not exists public.profiles (
  user_id             uuid primary key references auth.users(id) on delete cascade default auth.uid(),
  adult_confirmed_at  timestamptz,
  created_at          timestamptz not null default now()
);
alter table public.profiles enable row level security;
grant select, insert, update on public.profiles to authenticated;
drop policy if exists "own profile" on public.profiles;
create policy "own profile" on public.profiles
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Personas. owner_id null = built-in (shipped with the app).
create table if not exists public.personas (
  id            uuid primary key default gen_random_uuid(),
  slug          text,                       -- stable id for built-in personas
  owner_id      uuid references auth.users(id) on delete cascade,
  name          text not null check (char_length(name) between 1 and 40),
  tagline       text,
  avatar_emoji  text,
  avatar_url    text,
  visibility    text not null default 'private' check (visibility in ('private', 'unlisted', 'public')),
  definition    jsonb not null,
  -- Derived from the sheet so lists can filter without parsing JSON.
  is_romantic   boolean generated always as
                  (coalesce(definition->'relationship'->>'romance', 'off') <> 'off') stored,
  remixed_from  uuid references public.personas(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  -- Defence in depth: the app validates the full sheet, the database guarantees adults.
  constraint personas_adult check (coalesce((definition->'identity'->>'age')::int, 0) >= 18)
);
create unique index if not exists personas_builtin_slug on public.personas (slug) where owner_id is null;
create index if not exists personas_owner_idx on public.personas (owner_id);
create index if not exists personas_public_idx on public.personas (visibility) where visibility = 'public';

alter table public.personas enable row level security;
grant select on public.personas to authenticated;
grant insert, update, delete on public.personas to authenticated;

-- Anyone signed in can read public/unlisted personas (unlisted = by link) and their own.
drop policy if exists "read personas" on public.personas;
create policy "read personas" on public.personas
  for select using (visibility in ('public', 'unlisted') or owner_id = auth.uid());
-- Users can only create/edit/delete their own; built-in personas are managed with SQL only.
drop policy if exists "insert own personas" on public.personas;
create policy "insert own personas" on public.personas
  for insert with check (owner_id = auth.uid());
drop policy if exists "update own personas" on public.personas;
create policy "update own personas" on public.personas
  for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists "delete own personas" on public.personas;
create policy "delete own personas" on public.personas
  for delete using (owner_id = auth.uid());

-- Each conversation is with one persona (null = the plain assistant, used by older chats).
alter table public.conversations
  add column if not exists persona_id uuid references public.personas(id) on delete set null;
create index if not exists conversations_persona_idx on public.conversations (persona_id);

-- =====================================================================
-- v3: memory, relationships and check-ins. Safe to re-run.
-- =====================================================================

-- What each persona remembers. kind 'user' = facts about the user; 'self' = details the persona
-- has said about itself (so it stays consistent). Users can view and delete these in the app.
create table if not exists public.memories (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade default auth.uid(),
  persona_id  uuid not null references public.personas(id) on delete cascade,
  kind        text not null check (kind in ('user', 'self')),
  content     text not null check (char_length(content) between 1 and 300),
  created_at  timestamptz not null default now()
);
create index if not exists memories_user_persona_idx on public.memories (user_id, persona_id, created_at desc);
alter table public.memories enable row level security;
grant select, insert, delete on public.memories to authenticated;
drop policy if exists "own memories" on public.memories;
create policy "own memories" on public.memories
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- How well each user and persona know each other. Grows with real conversation over time.
create table if not exists public.relationships (
  user_id               uuid not null references auth.users(id) on delete cascade default auth.uid(),
  persona_id            uuid not null references public.personas(id) on delete cascade,
  user_messages         integer not null default 0,
  first_chat_at         timestamptz not null default now(),
  last_user_message_at  timestamptz,
  last_checkin_at       timestamptz,
  primary key (user_id, persona_id)
);
alter table public.relationships enable row level security;
grant select, insert, update on public.relationships to authenticated;
drop policy if exists "own relationships" on public.relationships;
create policy "own relationships" on public.relationships
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Counts one user message atomically and returns the updated relationship.
create or replace function public.bump_relationship(p_persona_id uuid)
returns public.relationships
language sql security invoker set search_path = public as $$
  insert into public.relationships (user_id, persona_id, user_messages, last_user_message_at)
  values (auth.uid(), p_persona_id, 1, now())
  on conflict (user_id, persona_id) do update
    set user_messages = public.relationships.user_messages + 1,
        last_user_message_at = now()
  returning *;
$$;
grant execute on function public.bump_relationship(uuid) to authenticated;

-- Messages a persona sends first (check-ins) are marked so they're never stacked.
alter table public.messages
  add column if not exists kind text not null default 'reply' check (kind in ('reply', 'checkin'));

-- =====================================================================
-- v4: learning from interaction (reply style, engagement, feedback). Safe to re-run.
-- Only metadata is measured; the stats functions never read message text.
-- =====================================================================

-- Style and context of each message. A reply's bubbles share one reply_id.
alter table public.messages
  add column if not exists reply_id       uuid,
  add column if not exists prompt_version text,
  add column if not exists variant        text,
  add column if not exists words          integer,
  add column if not exists emoji          integer,
  add column if not exists has_question   boolean,
  add column if not exists bubble_index   smallint,
  add column if not exists bubble_count   smallint,
  add column if not exists latency_ms     integer,
  -- On user messages: the crisis detector fired. Excluded from all metrics (and the 24h after).
  add column if not exists crisis         boolean not null default false;
create index if not exists messages_reply_idx on public.messages (reply_id) where reply_id is not null;
create index if not exists messages_created_idx on public.messages (created_at);

-- Thumbs up/down on a persona reply. Fixed reasons only (no free text, so no personal content).
create table if not exists public.feedback (
  user_id          uuid not null references auth.users(id) on delete cascade default auth.uid(),
  conversation_id  uuid not null references public.conversations(id) on delete cascade,
  reply_id         uuid not null,
  rating           smallint not null check (rating in (-1, 1)),
  reason           text check (reason in ('too_long', 'too_short', 'out_of_character', 'repetitive', 'too_much', 'other')),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  primary key (user_id, reply_id)
);
create index if not exists feedback_conversation_idx on public.feedback (conversation_id);
alter table public.feedback enable row level security;
grant select, insert, update, delete on public.feedback to authenticated;
drop policy if exists "own feedback" on public.feedback;
create policy "own feedback" on public.feedback
  for all using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.messages m
      where m.reply_id = feedback.reply_id and m.conversation_id = feedback.conversation_id
        and m.user_id = auth.uid() and m.role = 'assistant'
    )
  );

-- Who can see the stats page. Add yourself once (see the bottom of this file).
-- No grants and no policies: nobody can read this table through the API.
create table if not exists public.admins (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now()
);
alter table public.admins enable row level security;
revoke all on public.admins from anon, authenticated;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- Reply metrics per persona, model and kind (reply / check-in), over the last p_days.
-- Counts and averages only. Rows with fewer than 5 users show counts but no metrics.
create or replace function public.persona_stats(p_days integer default 30)
returns table (
  persona_id uuid, persona_name text, model text, kind text,
  users bigint, conversations bigint, replies bigint, enough_data boolean,
  reply_rate numeric, median_reply_seconds numeric, avg_user_words numeric,
  avg_words numeric, avg_bubbles numeric, avg_emoji numeric, question_rate numeric,
  median_latency_ms numeric, thumbs_up bigint, thumbs_down bigint, top_down_reason text
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'Only admins can read stats.' using errcode = '42501';
  end if;
  return query
  with ordered as (
    select m.conversation_id, m.user_id, m.role, m.kind, m.model, m.reply_id, m.created_at,
           m.words, m.emoji, m.has_question, m.latency_ms, c.persona_id,
           lead(m.role) over w as next_role,
           lead(m.created_at) over w as next_at,
           lead(m.words) over w as next_words
    from public.messages m
    join public.conversations c on c.id = m.conversation_id
    where c.persona_id is not null
      and m.created_at >= now() - make_interval(days => p_days)
    window w as (partition by m.conversation_id order by m.created_at)
  ),
  replies as (
    select o.reply_id, o.conversation_id, o.user_id, o.persona_id,
           (array_agg(o.model order by o.created_at))[1] as model,
           (array_agg(o.kind order by o.created_at))[1] as kind,
           count(*) as bubbles, sum(o.words) as words, sum(o.emoji) as emoji,
           bool_or(o.has_question) as has_question, max(o.latency_ms) as latency_ms,
           max(o.created_at) as last_at,
           (array_agg(o.next_role order by o.created_at desc))[1] as next_role,
           (array_agg(o.next_at order by o.created_at desc))[1] as next_at,
           (array_agg(o.next_words order by o.created_at desc))[1] as next_words
    from ordered o
    where o.role = 'assistant' and o.reply_id is not null
    group by o.reply_id, o.conversation_id, o.user_id, o.persona_id
  ),
  scored as (
    select r.*,
           (r.next_role = 'user' and r.next_at - r.last_at <= interval '24 hours') as replied,
           (r.next_role is null and r.last_at > now() - interval '24 hours') as pending,
           f.rating, f.reason
    from replies r
    left join public.feedback f on f.reply_id = r.reply_id and f.user_id = r.user_id
    where not exists (
      select 1 from public.messages x
      where x.conversation_id = r.conversation_id and x.role = 'user' and x.crisis
        and x.created_at between r.last_at - interval '24 hours' and r.last_at
    )
  ),
  agg as (
    select s.persona_id, s.model, s.kind,
           count(distinct s.user_id) as users,
           count(distinct s.conversation_id) as conversations,
           count(*) as replies,
           avg(case when s.replied then 1.0 else 0.0 end) filter (where not s.pending) as reply_rate,
           percentile_cont(0.5) within group (order by extract(epoch from s.next_at - s.last_at)) filter (where s.replied) as median_reply_seconds,
           avg(s.next_words) filter (where s.replied) as avg_user_words,
           avg(s.words) as avg_words, avg(s.bubbles) as avg_bubbles, avg(s.emoji) as avg_emoji,
           avg(case when s.has_question then 1.0 else 0.0 end) as question_rate,
           percentile_cont(0.5) within group (order by s.latency_ms) as median_latency_ms,
           count(*) filter (where s.rating = 1) as thumbs_up,
           count(*) filter (where s.rating = -1) as thumbs_down,
           mode() within group (order by s.reason) filter (where s.rating = -1) as top_down_reason
    from scored s
    group by s.persona_id, s.model, s.kind
  )
  select a.persona_id, p.name, a.model, a.kind,
         a.users, a.conversations, a.replies, a.users >= 5,
         case when a.users >= 5 then round(a.reply_rate, 3) end,
         case when a.users >= 5 then round(a.median_reply_seconds::numeric, 0) end,
         case when a.users >= 5 then round(a.avg_user_words, 1) end,
         case when a.users >= 5 then round(a.avg_words, 1) end,
         case when a.users >= 5 then round(a.avg_bubbles, 2) end,
         case when a.users >= 5 then round(a.avg_emoji, 2) end,
         case when a.users >= 5 then round(a.question_rate, 3) end,
         case when a.users >= 5 then round(a.median_latency_ms::numeric, 0) end,
         case when a.users >= 5 then a.thumbs_up end,
         case when a.users >= 5 then a.thumbs_down end,
         case when a.users >= 5 then a.top_down_reason end
  from agg a
  left join public.personas p on p.id = a.persona_id
  order by p.name, a.model, a.kind;
end;
$$;
revoke all on function public.persona_stats(integer) from public, anon;
grant execute on function public.persona_stats(integer) to authenticated;

-- Do people come back? Per persona: day-1 and day-7 return, and messages per session.
-- A session ends after 30 minutes without a user message.
create or replace function public.persona_retention(p_days integer default 30)
returns table (
  persona_id uuid, persona_name text, users bigint, enough_data boolean,
  returned_day1 numeric, returned_day7 numeric, sessions bigint, messages_per_session numeric
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'Only admins can read stats.' using errcode = '42501';
  end if;
  return query
  with um as (
    select m.user_id, c.persona_id, m.created_at,
           lag(m.created_at) over (partition by m.user_id, c.persona_id order by m.created_at) as prev_at
    from public.messages m
    join public.conversations c on c.id = m.conversation_id
    where m.role = 'user' and c.persona_id is not null
      and m.created_at >= now() - make_interval(days => p_days)
  ),
  sess as (
    select um.persona_id,
           count(distinct um.user_id) as users,
           count(*) filter (where um.prev_at is null or um.created_at - um.prev_at > interval '30 minutes') as sessions,
           count(*) as msgs
    from um group by um.persona_id
  ),
  ret as (
    select r.persona_id,
           avg(case when exists (
                 select 1 from public.messages m join public.conversations c on c.id = m.conversation_id
                 where m.user_id = r.user_id and c.persona_id = r.persona_id and m.role = 'user'
                   and m.created_at between r.first_chat_at + interval '20 hours' and r.first_chat_at + interval '48 hours'
               ) then 1.0 else 0.0 end) filter (where r.first_chat_at <= now() - interval '48 hours') as d1,
           avg(case when exists (
                 select 1 from public.messages m join public.conversations c on c.id = m.conversation_id
                 where m.user_id = r.user_id and c.persona_id = r.persona_id and m.role = 'user'
                   and m.created_at >= r.first_chat_at + interval '7 days'
               ) then 1.0 else 0.0 end) filter (where r.first_chat_at <= now() - interval '8 days') as d7
    from public.relationships r
    where r.first_chat_at >= now() - make_interval(days => p_days + 8)
    group by r.persona_id
  )
  select s.persona_id, p.name, s.users, s.users >= 5,
         case when s.users >= 5 then round(ret.d1, 3) end,
         case when s.users >= 5 then round(ret.d7, 3) end,
         s.sessions,
         case when s.users >= 5 then round(s.msgs::numeric / nullif(s.sessions, 0), 1) end
  from sess s
  left join ret on ret.persona_id = s.persona_id
  left join public.personas p on p.id = s.persona_id
  order by p.name;
end;
$$;
revoke all on function public.persona_retention(integer) from public, anon;
grant execute on function public.persona_retention(integer) to authenticated;

-- =====================================================================
-- v5: style experiments (A/B tests). Safe to re-run.
-- Each new persona chat may be placed in one variant of an experiment (defined in src/lib/experiments.ts).
-- =====================================================================
alter table public.conversations
  add column if not exists experiment text,
  add column if not exists variant    text;
create index if not exists conversations_experiment_idx on public.conversations (experiment, variant) where experiment is not null;

-- Results per variant of one experiment, as counts (the app computes rates and confidence ranges).
-- Admin only; no message text or user ids; variants with fewer than 5 users show counts only.
create or replace function public.experiment_stats(p_experiment text)
returns table (
  variant text, users bigint, conversations bigint, replies bigint, enough_data boolean,
  answered bigint, answerable bigint, median_reply_seconds numeric, avg_words numeric, avg_bubbles numeric,
  thumbs_up bigint, thumbs_down bigint, top_down_reason text,
  day1_returned bigint, day1_eligible bigint, day7_returned bigint, day7_eligible bigint,
  user_messages_per_chat numeric
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'Only admins can read stats.' using errcode = '42501';
  end if;
  return query
  with chats as (
    select c.id, c.user_id, c.variant, c.created_at
    from public.conversations c
    where c.experiment = p_experiment and c.variant is not null
  ),
  ordered as (
    select m.conversation_id, m.role, m.kind, m.reply_id, m.created_at, m.words,
           lead(m.role) over w as next_role, lead(m.created_at) over w as next_at
    from public.messages m
    where m.conversation_id in (select id from chats)
    window w as (partition by m.conversation_id order by m.created_at)
  ),
  replies as (
    select o.reply_id, o.conversation_id,
           count(*) as bubbles, sum(o.words) as words, max(o.created_at) as last_at,
           (array_agg(o.next_role order by o.created_at desc))[1] as next_role,
           (array_agg(o.next_at order by o.created_at desc))[1] as next_at
    from ordered o
    where o.role = 'assistant' and o.kind = 'reply' and o.reply_id is not null
    group by o.reply_id, o.conversation_id
  ),
  scored as (
    select ch.variant, ch.user_id, r.*,
           (r.next_role = 'user' and r.next_at - r.last_at <= interval '24 hours') as replied,
           (r.next_role is null and r.last_at > now() - interval '24 hours') as pending,
           f.rating, f.reason
    from replies r
    join chats ch on ch.id = r.conversation_id
    left join public.feedback f on f.reply_id = r.reply_id and f.user_id = ch.user_id
    where not exists (
      select 1 from public.messages x
      where x.conversation_id = r.conversation_id and x.role = 'user' and x.crisis
        and x.created_at between r.last_at - interval '24 hours' and r.last_at
    )
  ),
  reply_agg as (
    select s.variant,
           count(*) as replies,
           count(*) filter (where s.replied) as answered,
           count(*) filter (where not s.pending) as answerable,
           percentile_cont(0.5) within group (order by extract(epoch from s.next_at - s.last_at)) filter (where s.replied) as median_reply_seconds,
           avg(s.words) as avg_words, avg(s.bubbles) as avg_bubbles,
           count(*) filter (where s.rating = 1) as thumbs_up,
           count(*) filter (where s.rating = -1) as thumbs_down,
           mode() within group (order by s.reason) filter (where s.rating = -1) as top_down_reason
    from scored s group by s.variant
  ),
  chat_agg as (
    select ch.variant,
           count(distinct ch.user_id) as users,
           count(*) as conversations,
           count(*) filter (where ch.created_at <= now() - interval '48 hours' and exists (
             select 1 from public.messages m where m.conversation_id = ch.id and m.role = 'user'
               and m.created_at between ch.created_at + interval '20 hours' and ch.created_at + interval '48 hours')) as d1_returned,
           count(*) filter (where ch.created_at <= now() - interval '48 hours') as d1_eligible,
           count(*) filter (where ch.created_at <= now() - interval '8 days' and exists (
             select 1 from public.messages m where m.conversation_id = ch.id and m.role = 'user'
               and m.created_at >= ch.created_at + interval '7 days')) as d7_returned,
           count(*) filter (where ch.created_at <= now() - interval '8 days') as d7_eligible,
           avg((select count(*) from public.messages m where m.conversation_id = ch.id and m.role = 'user')) as msgs
    from chats ch group by ch.variant
  )
  select c.variant, c.users, c.conversations, coalesce(r.replies, 0), c.users >= 5,
         case when c.users >= 5 then coalesce(r.answered, 0) end,
         case when c.users >= 5 then coalesce(r.answerable, 0) end,
         case when c.users >= 5 then round(r.median_reply_seconds::numeric, 0) end,
         case when c.users >= 5 then round(r.avg_words, 1) end,
         case when c.users >= 5 then round(r.avg_bubbles, 2) end,
         case when c.users >= 5 then coalesce(r.thumbs_up, 0) end,
         case when c.users >= 5 then coalesce(r.thumbs_down, 0) end,
         case when c.users >= 5 then r.top_down_reason end,
         case when c.users >= 5 then c.d1_returned end,
         case when c.users >= 5 then c.d1_eligible end,
         case when c.users >= 5 then c.d7_returned end,
         case when c.users >= 5 then c.d7_eligible end,
         case when c.users >= 5 then round(c.msgs, 1) end
  from chat_agg c
  left join reply_agg r on r.variant = c.variant
  order by c.variant;
end;
$$;
revoke all on function public.experiment_stats(text) from public, anon;
grant execute on function public.experiment_stats(text) to authenticated;

-- To see the stats page, make your account an admin (run once, with your sign-in email):
--   insert into public.admins (user_id) select id from auth.users where email = 'you@example.com' on conflict do nothing;
