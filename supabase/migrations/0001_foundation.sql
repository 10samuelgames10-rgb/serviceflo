-- ServiceFlo foundation: businesses, team, customers, services, jobs.
-- Every row belongs to a business. Row Level Security makes sure people
-- only ever see and change data for the businesses they are a member of.

create extension if not exists pgcrypto;

-- ---------- tables ----------

create table public.businesses (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  brand_color text not null default '#1f74e0',
  timezone    text not null default 'America/Vancouver',
  created_at  timestamptz not null default now()
);

create table public.locations (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses on delete cascade,
  name        text not null,
  short       text not null default '',
  created_at  timestamptz not null default now(),
  unique (id, business_id)
);

create table public.employees (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses on delete cascade,
  location_id uuid,
  user_id     uuid references auth.users on delete set null,
  name        text not null,
  role        text not null default 'Detailer',
  wage        numeric(8,2) not null default 0 check (wage >= 0),
  color       text not null default '#1f74e0',
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  unique (id, business_id),
  foreign key (location_id, business_id) references public.locations (id, business_id) on delete set null (location_id)
);

-- Who can log in to which business, and with what powers.
create table public.members (
  business_id uuid not null references public.businesses on delete cascade,
  user_id     uuid not null references auth.users on delete cascade,
  role        text not null default 'tech' check (role in ('owner', 'manager', 'tech')),
  employee_id uuid,
  created_at  timestamptz not null default now(),
  primary key (business_id, user_id),
  foreign key (employee_id, business_id) references public.employees (id, business_id) on delete set null (employee_id)
);

create table public.services (
  id             uuid primary key default gen_random_uuid(),
  business_id    uuid not null references public.businesses on delete cascade,
  name           text not null,
  description    text not null default '',
  duration_hours numeric(5,2) not null default 3 check (duration_hours >= 0),
  price_sedan    numeric(10,2) not null default 0 check (price_sedan >= 0),
  price_suv      numeric(10,2) not null default 0 check (price_suv >= 0),
  price_large    numeric(10,2) not null default 0 check (price_large >= 0),
  includes       text[] not null default '{}',
  checklist      text[] not null default '{}',
  is_plan        boolean not null default false,
  bookable       boolean not null default true,
  sort           int not null default 0,
  created_at     timestamptz not null default now(),
  unique (id, business_id)
);

create table public.customers (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null references public.businesses on delete cascade,
  location_id  uuid,
  name         text not null,
  phone        text not null default '',
  email        text not null default '',
  address      text not null default '',
  vehicle      text not null default '',
  vehicle_size text not null default 'suv' check (vehicle_size in ('sedan', 'suv', 'large')),
  source       text not null default 'referral',
  created_at   timestamptz not null default now(),
  unique (id, business_id),
  foreign key (location_id, business_id) references public.locations (id, business_id) on delete set null (location_id)
);

create table public.customer_notes (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses on delete cascade,
  customer_id uuid not null,
  body        text not null check (length(trim(body)) > 0),
  created_by  uuid default auth.uid() references auth.users on delete set null,
  created_at  timestamptz not null default now(),
  foreign key (customer_id, business_id) references public.customers (id, business_id) on delete cascade
);

create table public.jobs (
  id             uuid primary key default gen_random_uuid(),
  number         bigint generated always as identity (start with 1001) unique,
  business_id    uuid not null references public.businesses on delete cascade,
  location_id    uuid,
  customer_id    uuid not null,
  service_id     uuid,
  employee_id    uuid,
  vehicle_size   text not null default 'suv' check (vehicle_size in ('sedan', 'suv', 'large')),
  service_name   text not null,
  price          numeric(10,2) not null default 0 check (price >= 0),
  discount       numeric(10,2) not null default 0 check (discount >= 0),
  tip            numeric(10,2) not null default 0 check (tip >= 0),
  date           date not null,
  start_time     time not null default '09:00',
  duration_hours numeric(5,2) not null default 3,
  status         text not null default 'scheduled'
                 check (status in ('quote', 'scheduled', 'progress', 'completed', 'paid', 'cancelled')),
  checklist_done int[] not null default '{}',
  notes          text not null default '',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  foreign key (location_id, business_id) references public.locations (id, business_id) on delete set null (location_id),
  foreign key (customer_id, business_id) references public.customers (id, business_id) on delete restrict,
  foreign key (service_id, business_id) references public.services (id, business_id) on delete set null (service_id),
  foreign key (employee_id, business_id) references public.employees (id, business_id) on delete set null (employee_id)
);

create index on public.locations (business_id);
create index on public.employees (business_id);
create index on public.members (user_id);
create index on public.services (business_id, sort);
create index on public.customers (business_id, name);
create index on public.customer_notes (customer_id, created_at desc);
create index on public.jobs (business_id, date);
create index on public.jobs (customer_id);

create function public.touch_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger jobs_touch before update on public.jobs
  for each row execute function public.touch_updated_at();

-- ---------- access helpers ----------

create function public.is_member(b uuid) returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (select 1 from members where business_id = b and user_id = auth.uid());
$$;

create function public.is_manager(b uuid) returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (select 1 from members where business_id = b and user_id = auth.uid()
                 and role in ('owner', 'manager'));
$$;

-- ---------- row level security ----------

alter table public.businesses     enable row level security;
alter table public.locations      enable row level security;
alter table public.employees      enable row level security;
alter table public.members        enable row level security;
alter table public.services       enable row level security;
alter table public.customers      enable row level security;
alter table public.customer_notes enable row level security;
alter table public.jobs           enable row level security;

create policy "members read business" on public.businesses for select using (is_member(id));
create policy "managers edit business" on public.businesses for update using (is_manager(id)) with check (is_manager(id));

create policy "members read own memberships" on public.members for select
  using (user_id = auth.uid() or is_manager(business_id));
create policy "managers manage members" on public.members for all
  using (is_manager(business_id)) with check (is_manager(business_id));

-- Setup tables: everyone on the team reads them, owners and managers change them.
create policy "read" on public.locations for select using (is_member(business_id));
create policy "write" on public.locations for all using (is_manager(business_id)) with check (is_manager(business_id));
create policy "read" on public.employees for select using (is_member(business_id));
create policy "write" on public.employees for all using (is_manager(business_id)) with check (is_manager(business_id));
create policy "read" on public.services for select using (is_member(business_id));
create policy "write" on public.services for all using (is_manager(business_id)) with check (is_manager(business_id));

-- Day-to-day tables: the whole team works in them; only managers delete.
create policy "read" on public.customers for select using (is_member(business_id));
create policy "insert" on public.customers for insert with check (is_member(business_id));
create policy "update" on public.customers for update using (is_member(business_id)) with check (is_member(business_id));
create policy "delete" on public.customers for delete using (is_manager(business_id));

create policy "read" on public.customer_notes for select using (is_member(business_id));
create policy "insert" on public.customer_notes for insert with check (is_member(business_id));
create policy "delete" on public.customer_notes for delete
  using (is_manager(business_id) or created_by = auth.uid());

create policy "read" on public.jobs for select using (is_member(business_id));
create policy "insert" on public.jobs for insert with check (is_member(business_id));
create policy "update" on public.jobs for update using (is_member(business_id)) with check (is_member(business_id));
create policy "delete" on public.jobs for delete using (is_manager(business_id));

-- ---------- first-time setup ----------
-- Creates a business for the signed-in person, makes them the owner,
-- and fills in locations, an owner employee record and starter services.

create function public.create_business(p_name text, p_owner_name text, p_locations text[])
  returns uuid language plpgsql security definer set search_path = public as $$
declare
  b   uuid;
  loc uuid;
  emp uuid;
  l   text;
  first_loc uuid;
  std_check text[] := array[
    'Walk-around photos: 4 corners, interior, damage',
    'Confirm water and power within 50 ft',
    'Remove floor mats and personal items',
    'Dog hair: rubber brush, then vacuum',
    'Vacuum seats, carpets and trunk',
    'Wipe dash, console and cup holders',
    'Door panels and door jambs',
    'Interior glass streak-free',
    'Foam and two-bucket hand wash',
    'Wheels, rims and tires',
    'Dry and exterior glass',
    'Tire shine',
    'Final photos and customer walk-through'];
begin
  if auth.uid() is null then
    raise exception 'You need to be signed in';
  end if;
  if coalesce(trim(p_name), '') = '' then
    raise exception 'Business name is required';
  end if;
  if exists (select 1 from members where user_id = auth.uid()) then
    raise exception 'You already belong to a business';
  end if;

  insert into businesses (name) values (trim(p_name)) returning id into b;

  foreach l in array coalesce(p_locations, array['Main']) loop
    if trim(l) <> '' then
      insert into locations (business_id, name, short)
      values (b, trim(l), upper(left(trim(l), 3))) returning id into loc;
      first_loc := coalesce(first_loc, loc);
    end if;
  end loop;
  if first_loc is null then
    insert into locations (business_id, name, short) values (b, 'Main', 'MAI') returning id into first_loc;
  end if;

  insert into employees (business_id, location_id, user_id, name, role, wage, color)
  values (b, first_loc, auth.uid(), coalesce(nullif(trim(p_owner_name), ''), 'Owner'), 'Owner', 0, '#5d7bff')
  returning id into emp;

  insert into members (business_id, user_id, role, employee_id) values (b, auth.uid(), 'owner', emp);

  insert into services (business_id, name, description, duration_hours, price_sedan, price_suv, price_large, includes, checklist, sort) values
    (b, 'Express Wash & Vac', 'Hand wash, wheels, quick vacuum and wipe-down.', 1.5, 99, 119, 139,
       array['Two-bucket hand wash', 'Wheels and tire shine', 'Vacuum and wipe-down'], std_check, 1),
    (b, 'Confidence Detail', 'Full inside and out detail. Restores your car to almost-new.', 4.75, 449, 499, 549,
       array['Seats and carpets spotless, surface shampoo', 'Dog hair removed', 'Odours removed without toxic fresheners', 'Bugs, wheels, rims and tire shine'], std_check, 2),
    (b, 'Luxury Detail', 'Confidence Detail plus deep shampoo, deep odour removal, clay bar and 4-month wax.', 6.5, 649, 699, 749,
       array['Everything in Confidence', 'Deep seat shampoo and odour removal', 'Clay bar and 4-month wax'], std_check, 3),
    (b, 'Interior Reset', 'Inside only: seats, carpets, pet hair, glass and every crevice.', 3, 279, 319, 349,
       array['Seats and carpets, surface shampoo', 'Dog hair removal', 'Glass, dash, jambs and trunk'], std_check[1:8], 4);
  insert into services (business_id, name, description, duration_hours, price_sedan, price_suv, price_large, includes, checklist, is_plan, bookable, sort)
  values (b, 'Maintenance Clean', 'Monthly upkeep for plan members.', 2.25, 179, 199, 219,
          array['Every month, same tech', '15% off add-ons'], std_check[1:3] || std_check[9:13], true, false, 5);

  return b;
end $$;

revoke all on function public.create_business(text, text, text[]) from public;
grant execute on function public.create_business(text, text, text[]) to authenticated;
