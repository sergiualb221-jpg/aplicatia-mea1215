-- MATA: schema pentru anunțuri, fotografii publice și mesagerie privată.
create extension if not exists pgcrypto;

create table if not exists public.ads (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (char_length(type) between 1 and 40),
  name text not null check (char_length(name) between 1 and 120),
  meta text not null default '' check (char_length(meta) <= 180),
  price text not null check (char_length(price) <= 40),
  price_value numeric(12,2) not null default 0 check (price_value >= 0),
  currency text not null default 'EUR' check (currency in ('EUR', 'RON')),
  county text not null default '' check (char_length(county) <= 80),
  city text not null default '' check (char_length(city) <= 100),
  phone text not null default '' check (char_length(phone) <= 40),
  brand text not null default '' check (char_length(brand) <= 80),
  icon text not null default '🏍️',
  description text not null default '' check (char_length(description) <= 4000),
  photos text[] not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists ads_created_at_idx on public.ads (created_at desc);
create index if not exists ads_owner_id_idx on public.ads (owner_id);

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.ads(id) on delete cascade,
  buyer_id uuid not null references auth.users(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  last_message text not null default '',
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint conversations_buyer_per_listing unique (listing_id, buyer_id),
  constraint conversations_different_users check (buyer_id <> owner_id)
);

create index if not exists conversations_buyer_updated_idx on public.conversations (buyer_id, last_message_at desc);
create index if not exists conversations_owner_updated_idx on public.conversations (owner_id, last_message_at desc);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index if not exists messages_conversation_created_idx on public.messages (conversation_id, created_at);

alter table public.ads enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;

create or replace function public.mata_email_confirmed()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from auth.users u
    where u.id = (select auth.uid()) and u.email_confirmed_at is not null
  );
$$;
revoke all on function public.mata_email_confirmed() from public, anon;
grant execute on function public.mata_email_confirmed() to authenticated;

revoke all on public.ads, public.conversations, public.messages from anon, authenticated;
grant select on public.ads to anon, authenticated;
grant insert, update, delete on public.ads to authenticated;
grant select, insert on public.conversations to authenticated;
grant select, insert on public.messages to authenticated;

drop policy if exists "Ads are public to read" on public.ads;
create policy "Ads are public to read" on public.ads
  for select to anon, authenticated using (true);
drop policy if exists "Owners create their ads" on public.ads;
create policy "Owners create their ads" on public.ads
  for insert to authenticated with check (owner_id = (select auth.uid()) and (select public.mata_email_confirmed()));
drop policy if exists "Owners update their ads" on public.ads;
create policy "Owners update their ads" on public.ads
  for update to authenticated using (owner_id = (select auth.uid()) and (select public.mata_email_confirmed()))
  with check (owner_id = (select auth.uid()) and (select public.mata_email_confirmed()));
drop policy if exists "Owners delete their ads" on public.ads;
create policy "Owners delete their ads" on public.ads
  for delete to authenticated using (owner_id = (select auth.uid()) and (select public.mata_email_confirmed()));

drop policy if exists "Participants read their conversations" on public.conversations;
create policy "Participants read their conversations" on public.conversations
  for select to authenticated
  using (
    ((select auth.uid()) = buyer_id or (select auth.uid()) = owner_id)
    and (select public.mata_email_confirmed())
  );
drop policy if exists "Buyers start a conversation with an ad owner" on public.conversations;
create policy "Buyers start a conversation with an ad owner" on public.conversations
  for insert to authenticated with check (
    buyer_id = (select auth.uid())
    and (select public.mata_email_confirmed())
    and buyer_id <> owner_id
    and exists (
      select 1 from public.ads a
      where a.id = conversations.listing_id and a.owner_id = conversations.owner_id
    )
  );

drop policy if exists "Participants read conversation messages" on public.messages;
create policy "Participants read conversation messages" on public.messages
  for select to authenticated using (
    exists (
      select 1 from public.conversations c
      where c.id = conversation_id
        and ((select auth.uid()) = c.buyer_id or (select auth.uid()) = c.owner_id)
    )
  );
drop policy if exists "Participants send conversation messages" on public.messages;
create policy "Participants send conversation messages" on public.messages
  for insert to authenticated with check (
    sender_id = (select auth.uid())
    and (select public.mata_email_confirmed())
    and exists (
      select 1 from public.conversations c
      where c.id = conversation_id
        and ((select auth.uid()) = c.buyer_id or (select auth.uid()) = c.owner_id)
    )
  );

create or replace function public.update_conversation_on_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.conversations
  set last_message = left(new.body, 240), last_message_at = new.created_at
  where id = new.conversation_id;
  return new;
end;
$$;

drop trigger if exists update_conversation_after_message on public.messages;
create trigger update_conversation_after_message
  after insert on public.messages
  for each row execute function public.update_conversation_on_message();

-- Bucket public pentru afișarea pozelor anunțurilor; doar proprietarul urcă sau șterge fișiere din folderul său.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('mata-ad-photos', 'mata-ad-photos', true, 5242880, array['image/jpeg','image/png','image/webp','image/avif'])
on conflict (id) do update set public = true, file_size_limit = 5242880,
  allowed_mime_types = array['image/jpeg','image/png','image/webp','image/avif'];

drop policy if exists "Anyone can read MATA ad photos" on storage.objects;
create policy "Anyone can read MATA ad photos" on storage.objects
  for select to anon, authenticated using (bucket_id = 'mata-ad-photos');
drop policy if exists "Users upload photos to their own folder" on storage.objects;
create policy "Users upload photos to their own folder" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'mata-ad-photos' and (storage.foldername(name))[1] = (select auth.uid())::text
    and (select public.mata_email_confirmed())
  );
drop policy if exists "Users delete photos from their own folder" on storage.objects;
create policy "Users delete photos from their own folder" on storage.objects
  for delete to authenticated using (
    bucket_id = 'mata-ad-photos' and (storage.foldername(name))[1] = (select auth.uid())::text
    and (select public.mata_email_confirmed())
  );

-- Activează evenimente realtime pentru lista de anunțuri, conversații și mesaje.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'ads') then
      alter publication supabase_realtime add table public.ads;
    end if;
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'conversations') then
      alter publication supabase_realtime add table public.conversations;
    end if;
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages') then
      alter publication supabase_realtime add table public.messages;
    end if;
  end if;
end;
$$;
