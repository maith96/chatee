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
