-- Business phone numbers, two-way texting and call logs (Twilio).

-- ---------- phone number matching ----------
-- Turns "(250) 555-0101", "250.555.0101" or "+1 250 555 0101" into "+12505550101"
-- so incoming texts and calls can be matched to customers.
create function public.normalize_phone(p text) returns text
  language sql immutable as $$
  select case
    when p is null then null
    when length(regexp_replace(p, '\D', '', 'g')) = 10 then '+1' || regexp_replace(p, '\D', '', 'g')
    when length(regexp_replace(p, '\D', '', 'g')) = 11 and left(regexp_replace(p, '\D', '', 'g'), 1) = '1'
      then '+' || regexp_replace(p, '\D', '', 'g')
    when left(trim(p), 1) = '+' and length(regexp_replace(p, '\D', '', 'g')) between 8 and 15
      then '+' || regexp_replace(p, '\D', '', 'g')
    else null
  end;
$$;

alter table public.customers add column phone_e164 text generated always as (public.normalize_phone(phone)) stored;
create index on public.customers (business_id, phone_e164);

-- Team members' own mobiles: calls to the business ring here, and click-to-call rings here first.
alter table public.employees add column phone text not null default '';

-- ---------- business numbers ----------
create table public.phone_numbers (
  id                  uuid primary key default gen_random_uuid(),
  business_id         uuid not null references public.businesses on delete cascade,
  location_id         uuid,
  e164                text not null unique check (e164 ~ '^\+[1-9][0-9]{7,14}$'),
  label               text not null default '',
  forward_to          text not null default '' check (forward_to = '' or forward_to ~ '^\+[1-9][0-9]{7,14}$'),
  record_calls        boolean not null default false,
  missed_call_text    boolean not null default true,
  missed_call_message text not null default 'Sorry we missed your call! Want a quote? Reply here and we''ll text you right back.',
  twilio_sid          text,
  created_at          timestamptz not null default now(),
  unique (id, business_id),
  foreign key (location_id, business_id) references public.locations (id, business_id) on delete set null (location_id)
);
create index on public.phone_numbers (business_id);

alter table public.phone_numbers enable row level security;
create policy "read" on public.phone_numbers for select using (is_member(business_id));
create policy "write" on public.phone_numbers for all using (is_manager(business_id)) with check (is_manager(business_id));

-- ---------- two-way messages ----------
alter table public.messages
  add column direction text not null default 'outbound' check (direction in ('outbound', 'inbound')),
  add column counterpart text,
  add column from_address text not null default '',
  add column phone_number_id uuid,
  add column provider_sid text unique,
  add column media_urls text[] not null default '{}',
  add column read_at timestamptz;

alter table public.messages drop constraint messages_status_check;
alter table public.messages add constraint messages_status_check
  check (status in ('queued', 'sending', 'sent', 'delivered', 'undelivered', 'failed', 'skipped', 'received'));
alter table public.messages drop constraint messages_body_check;
alter table public.messages add constraint messages_body_check
  check (length(trim(body)) > 0 or cardinality(media_urls) > 0);
alter table public.messages add constraint messages_phone_number_fkey
  foreign key (phone_number_id, business_id) references public.phone_numbers (id, business_id) on delete set null (phone_number_id);

update public.messages set counterpart = public.normalize_phone(to_address) where counterpart is null;
create index on public.messages (business_id, counterpart, created_at desc);
create index on public.messages (business_id, direction, read_at) where read_at is null;

-- Anyone on the team can mark a conversation as read.
drop policy "update" on public.messages;
create policy "update" on public.messages for update using (is_member(business_id)) with check (is_member(business_id));

-- ---------- calls ----------
create table public.calls (
  id               uuid primary key default gen_random_uuid(),
  business_id      uuid not null references public.businesses on delete cascade,
  phone_number_id  uuid,
  customer_id      uuid,
  direction        text not null check (direction in ('inbound', 'outbound')),
  counterpart      text not null,
  status           text not null default 'ringing'
                   check (status in ('ringing', 'in-progress', 'completed', 'missed', 'voicemail', 'no-answer', 'busy', 'failed', 'canceled')),
  duration_seconds int not null default 0,
  recording_url    text,
  voicemail_url    text,
  transcription    text,
  provider_sid     text unique,
  started_by       uuid default auth.uid() references auth.users on delete set null,
  read_at          timestamptz,
  created_at       timestamptz not null default now(),
  foreign key (phone_number_id, business_id) references public.phone_numbers (id, business_id) on delete set null (phone_number_id),
  foreign key (customer_id, business_id) references public.customers (id, business_id) on delete set null (customer_id)
);
create index on public.calls (business_id, counterpart, created_at desc);

alter table public.calls enable row level security;
create policy "read" on public.calls for select using (is_member(business_id));
create policy "insert" on public.calls for insert with check (is_member(business_id));
create policy "update" on public.calls for update using (is_member(business_id)) with check (is_member(business_id));
