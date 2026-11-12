-- Run this once in Supabase: SQL Editor -> New query -> paste -> Run.

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  ticket text not null unique check (ticket ~ '^RY-[A-Z0-9]{6}$'),
  title text not null check (char_length(title) between 5 and 120),
  description text not null check (char_length(description) between 15 and 2000),
  category text not null check (char_length(category) <= 40),
  department text not null default '' check (char_length(department) <= 80),
  location text not null default '' check (char_length(location) <= 120),
  photo text not null default '' check (char_length(photo) <= 400000),
  anonymous boolean not null default true,
  reporter_name text not null default '' check (char_length(reporter_name) <= 80),
  reporter_contact text not null default '' check (char_length(reporter_contact) <= 120),
  is_private boolean not null default false,
  status text not null default 'Open' check (status in ('Open','In Progress','Resolved','Rejected')),
  upvotes integer not null default 0,
  admin_note text not null default '' check (char_length(admin_note) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- People allowed to use the admin page. Add your staff emails here.
create table if not exists public.admins (email text primary key);

create or replace function public.is_admin() returns boolean
language sql security definer set search_path = public stable as $$
  select exists (select 1 from public.admins where lower(email) = lower(auth.jwt() ->> 'email'));
$$;

alter table public.reports enable row level security;
alter table public.admins enable row level security;

-- Students (anonymous visitors) may only submit new reports with safe defaults.
drop policy if exists "students insert" on public.reports;
create policy "students insert" on public.reports for insert to anon, authenticated
  with check (status = 'Open' and upvotes = 0 and admin_note = '');

-- Admins can read and update everything.
drop policy if exists "admins read" on public.reports;
create policy "admins read" on public.reports for select to authenticated using (public.is_admin());
drop policy if exists "admins update" on public.reports;
create policy "admins update" on public.reports for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Public list: no names, no contacts, nothing private.
create or replace view public.public_reports as
  select ticket, title, description, category, department, location, photo,
         status, upvotes, admin_note, created_at, updated_at
  from public.reports where is_private = false;
grant select on public.public_reports to anon, authenticated;

-- Track one report by its ticket ID (works for private reports too, only by ticket).
create or replace function public.track_report(t text)
returns table (ticket text, title text, status text, admin_note text, created_at timestamptz, updated_at timestamptz)
language sql security definer set search_path = public stable as $$
  select r.ticket, r.title, r.status, r.admin_note, r.created_at, r.updated_at
  from public.reports r where r.ticket = upper(trim(t));
$$;
grant execute on function public.track_report(text) to anon, authenticated;

-- Upvote a public report.
create or replace function public.upvote_report(t text) returns void
language sql security definer set search_path = public as $$
  update public.reports set upvotes = upvotes + 1 where ticket = t and is_private = false;
$$;
grant execute on function public.upvote_report(text) to anon, authenticated;
grant execute on function public.is_admin() to anon, authenticated;

create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
drop trigger if exists reports_touch on public.reports;
create trigger reports_touch before update on public.reports
  for each row execute function public.touch_updated_at();

-- AFTER running this: add yourself as admin (change the email), then create the same
-- user under Authentication -> Users, and turn OFF "Allow new users to sign up".
-- insert into public.admins (email) values ('you@example.com');
