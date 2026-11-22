-- Referral codes for every customer, and a message outbox for customer texts.

-- ---------- referral codes ----------
-- Every customer gets a simple code: their first name plus a number, e.g. MEGAN50.
-- Codes are unique within a business.

alter table public.customers
  add column referral_code text,
  add column referred_by uuid;

alter table public.customers
  add constraint customers_referred_by_fkey
  foreign key (referred_by, business_id) references public.customers (id, business_id) on delete set null (referred_by);

create unique index customers_referral_code_key on public.customers (business_id, referral_code);

create function public.make_referral_code(b uuid, full_name text) returns text
  language plpgsql volatile set search_path = public as $$
declare
  base text := upper(regexp_replace(split_part(trim(coalesce(full_name, '')), ' ', 1), '[^A-Za-z]', '', 'g'));
  code text;
  tries int := 0;
begin
  if base = '' then base := 'FRIEND'; end if;
  base := left(base, 12);
  loop
    tries := tries + 1;
    -- Try round, easy-to-say numbers first (10, 20 ... 90), then any two-digit, then three-digit.
    code := base || case
      when tries <= 9 then ((floor(random() * 9) + 1) * 10)::int::text
      when tries <= 60 then (floor(random() * 90) + 10)::int::text
      else (floor(random() * 900) + 100)::int::text
    end;
    exit when not exists (select 1 from customers where business_id = b and referral_code = code);
    if tries > 500 then
      code := base || (floor(random() * 90000) + 10000)::int::text;
      exit;
    end if;
  end loop;
  return code;
end $$;

create function public.customers_set_referral_code() returns trigger
  language plpgsql set search_path = public as $$
begin
  if new.referral_code is null or trim(new.referral_code) = '' then
    new.referral_code := make_referral_code(new.business_id, new.name);
  else
    new.referral_code := upper(regexp_replace(new.referral_code, '[^A-Za-z0-9]', '', 'g'));
  end if;
  return new;
end $$;

create trigger customers_referral_code before insert on public.customers
  for each row execute function public.customers_set_referral_code();

-- Give every existing customer a code.
do $$
declare r record;
begin
  for r in select id, business_id, name from public.customers where referral_code is null order by created_at loop
    update public.customers set referral_code = public.make_referral_code(r.business_id, r.name) where id = r.id;
  end loop;
end $$;

alter table public.customers alter column referral_code set not null;

create index on public.customers (referred_by);

-- ---------- message outbox ----------
-- Every text ServiceFlo wants to send is recorded here first. Until a texting
-- provider is connected, messages stay "queued"; once it is, a sender marks them
-- "sent" or "failed". This also gives a full history of what each customer was told.

create table public.messages (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses on delete cascade,
  customer_id uuid,
  job_id      uuid,
  channel     text not null default 'sms' check (channel in ('sms', 'email')),
  to_address  text not null default '',
  body        text not null check (length(trim(body)) > 0),
  kind        text not null default 'manual',
  status      text not null default 'queued' check (status in ('queued', 'sent', 'failed', 'skipped')),
  error       text,
  created_by  uuid default auth.uid() references auth.users on delete set null,
  created_at  timestamptz not null default now(),
  sent_at     timestamptz,
  foreign key (customer_id, business_id) references public.customers (id, business_id) on delete cascade
);

alter table public.jobs add constraint jobs_id_business_key unique (id, business_id);
alter table public.messages
  add constraint messages_job_fkey foreign key (job_id, business_id) references public.jobs (id, business_id) on delete set null (job_id);

create index on public.messages (business_id, status, created_at);
create index on public.messages (customer_id, created_at desc);

alter table public.messages enable row level security;
create policy "read" on public.messages for select using (is_member(business_id));
create policy "insert" on public.messages for insert with check (is_member(business_id));
create policy "update" on public.messages for update using (is_manager(business_id)) with check (is_manager(business_id));
