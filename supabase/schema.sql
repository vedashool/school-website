-- ============================================================
-- VEDA ENGLISH MEDIUM SCHOOL: DATABASE SETUP
-- Run this ONCE in Supabase: SQL Editor > New query > paste > Run.
-- It is safe to run again later.
--
-- BEFORE RUNNING: change 'admin@example.com' below (inside
-- is_admin) to the email of the ONE admin account.
-- ============================================================

-- 1. Who is the admin? Only this email may change data.
create or replace function public.is_admin()
returns boolean
language sql
stable
set search_path = public
as $$
  select coalesce(lower(auth.jwt() ->> 'email') = lower('admin@vedaschool.online'), false);
$$;

-- 2. Tables
create table if not exists public.categories (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (char_length(btrim(name)) between 1 and 40),
  created_at timestamptz not null default now()
);
create unique index if not exists categories_name_unique
  on public.categories (lower(btrim(name)));

create table if not exists public.photos (
  id           uuid primary key default gen_random_uuid(),
  url          text not null,
  storage_path text not null,
  -- "restrict" means a category that still has photos cannot be deleted
  category_id  uuid not null references public.categories(id) on delete restrict,
  created_at   timestamptz not null default now()
);
create index if not exists photos_category_idx on public.photos (category_id);
create index if not exists photos_created_idx  on public.photos (created_at desc);

create table if not exists public.enquiries (
  id             uuid primary key default gen_random_uuid(),
  parent_name    text not null check (char_length(btrim(parent_name)) between 2 and 80),
  phone          text not null check (char_length(btrim(phone)) between 7 and 20),
  class_interest text not null check (class_interest in (
                   'Nursery','Class 1','Class 2','Class 3','Class 4','Class 5',
                   'Class 6','Class 7','Class 8','Class 9','Class 10')),
  message        text check (message is null or char_length(message) <= 1000),
  created_at     timestamptz not null default now()
);
create index if not exists enquiries_created_idx on public.enquiries (created_at desc);

-- 3. Spam guard (database level, cannot be bypassed from the browser):
--    max 3 enquiries per phone number per hour, max 40 in total per hour.
create or replace function public.enquiries_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (select count(*) from public.enquiries
        where created_at > now() - interval '1 hour') >= 40 then
    raise exception 'Too many enquiries right now. Please try again later.';
  end if;

  if (select count(*) from public.enquiries
        where created_at > now() - interval '1 hour'
          and regexp_replace(phone, '\D', '', 'g') = regexp_replace(new.phone, '\D', '', 'g')) >= 3 then
    raise exception 'Too many enquiries from this number. Please try again later.';
  end if;

  return new;
end;
$$;

drop trigger if exists enquiries_guard_trg on public.enquiries;
create trigger enquiries_guard_trg
  before insert on public.enquiries
  for each row execute function public.enquiries_guard();

-- 4. Row Level Security
alter table public.categories enable row level security;
alter table public.photos     enable row level security;
alter table public.enquiries  enable row level security;

-- Categories: public can read, only the admin can change
drop policy if exists "categories public read"  on public.categories;
drop policy if exists "categories admin insert" on public.categories;
drop policy if exists "categories admin update" on public.categories;
drop policy if exists "categories admin delete" on public.categories;
create policy "categories public read"  on public.categories for select to anon, authenticated using (true);
create policy "categories admin insert" on public.categories for insert to authenticated with check (public.is_admin());
create policy "categories admin update" on public.categories for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "categories admin delete" on public.categories for delete to authenticated using (public.is_admin());

-- Photos: public can read, only the admin can change
drop policy if exists "photos public read"  on public.photos;
drop policy if exists "photos admin insert" on public.photos;
drop policy if exists "photos admin update" on public.photos;
drop policy if exists "photos admin delete" on public.photos;
create policy "photos public read"  on public.photos for select to anon, authenticated using (true);
create policy "photos admin insert" on public.photos for insert to authenticated with check (public.is_admin());
create policy "photos admin update" on public.photos for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "photos admin delete" on public.photos for delete to authenticated using (public.is_admin());

-- Enquiries: the public can only ADD one; only the admin can read. Nobody can edit or delete here.
drop policy if exists "enquiries public insert" on public.enquiries;
drop policy if exists "enquiries admin read"    on public.enquiries;
create policy "enquiries public insert" on public.enquiries for insert to anon, authenticated with check (true);
create policy "enquiries admin read"    on public.enquiries for select to authenticated using (public.is_admin());

-- 5. Table permissions (RLS above still applies on top of these)
grant usage on schema public to anon, authenticated;
grant select on public.categories, public.photos to anon, authenticated;
grant insert, update, delete on public.categories, public.photos to authenticated;
grant insert on public.enquiries to anon, authenticated;
grant select on public.enquiries to authenticated;

-- 6. Image storage: a public bucket named "gallery"
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('gallery', 'gallery', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = true,
      file_size_limit = 5242880,
      allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

drop policy if exists "gallery public read"  on storage.objects;
drop policy if exists "gallery admin upload" on storage.objects;
drop policy if exists "gallery admin delete" on storage.objects;
create policy "gallery public read"  on storage.objects for select to anon, authenticated
  using (bucket_id = 'gallery');
create policy "gallery admin upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'gallery' and public.is_admin());
create policy "gallery admin delete" on storage.objects for delete to authenticated
  using (bucket_id = 'gallery' and public.is_admin());