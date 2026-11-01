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
