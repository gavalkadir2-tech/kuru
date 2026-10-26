-- Kuru — Supabase şeması
-- Supabase panelinde SQL Editor'e yapıştırıp çalıştırın.
-- Dosya tekrar çalıştırılabilir: yeni sürüm geldiğinde aynı şekilde yeniden çalıştırmanız yeterli,
-- mevcut verileriniz silinmez.

-- ---------- Kayıtlar ----------
create table if not exists public.kuru_records (
  id uuid primary key,
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade, -- güvercinlik sahibi
  collection text not null,
  data jsonb not null,
  updated_at timestamptz not null default now(),        -- cihazdaki son değişiklik zamanı
  deleted boolean not null default false,
  server_updated_at timestamptz not null default now()  -- sunucuya yazılma zamanı (senkron sınırı)
);

create index if not exists kuru_records_owner_sync_idx on public.kuru_records (owner_id, server_updated_at);

-- Her yazımda sunucu saatini güncelle (cihaz saatleri farklı olabilir)
create or replace function public.kuru_touch() returns trigger language plpgsql as $$
begin
  new.server_updated_at := clock_timestamp();
  return new;
end $$;

drop trigger if exists kuru_records_touch on public.kuru_records;
create trigger kuru_records_touch before insert or update on public.kuru_records
  for each row execute function public.kuru_touch();

-- ---------- Yardımcı hesapları ----------
-- Güvercinlik sahibi, yardımcısının e-postasını ekler. Yardımcı o e-postayla giriş yapınca
-- sahibin kayıtlarını görür ve yeni kayıt girer/düzenler; kayıt silemez.
create table if not exists public.kuru_members (
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  member_email text not null,
  role text not null default 'yardimci' check (role in ('yardimci')),
  created_at timestamptz not null default now(),
  primary key (owner_id, member_email)
);

alter table public.kuru_members enable row level security;

drop policy if exists "kuru_members_owner" on public.kuru_members;
create policy "kuru_members_owner" on public.kuru_members for all
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists "kuru_members_self" on public.kuru_members;
create policy "kuru_members_self" on public.kuru_members for select
  using (lower(member_email) = lower(coalesce(auth.jwt() ->> 'email', '')));

-- Oturumdaki kullanıcı, verilen güvercinliğin yardımcısı mı?
create or replace function public.kuru_is_member(owner text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.kuru_members m
    where m.owner_id::text = owner
      and lower(m.member_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

-- ---------- Kayıt güvenliği ----------
-- Sahip her şeyi yapar; yardımcı okur, ekler ve düzenler ama silemez (deleted = true yazamaz).
alter table public.kuru_records enable row level security;

drop policy if exists "kuru_select_own" on public.kuru_records;
create policy "kuru_select_own" on public.kuru_records for select
  using (owner_id = auth.uid() or public.kuru_is_member(owner_id::text));

drop policy if exists "kuru_insert_own" on public.kuru_records;
create policy "kuru_insert_own" on public.kuru_records for insert
  with check (owner_id = auth.uid() or (public.kuru_is_member(owner_id::text) and deleted = false));

drop policy if exists "kuru_update_own" on public.kuru_records;
create policy "kuru_update_own" on public.kuru_records for update
  using (owner_id = auth.uid() or public.kuru_is_member(owner_id::text))
  with check (owner_id = auth.uid() or (public.kuru_is_member(owner_id::text) and deleted = false));

-- ---------- Fotoğraflar (Storage) ----------
-- Dosya yolu: <güvercinlik sahibinin kullanıcı kimliği>/<fotoğraf kimliği>.jpg
insert into storage.buckets (id, name, public)
values ('kuru-photos', 'kuru-photos', false)
on conflict (id) do nothing;

drop policy if exists "kuru_photos_select" on storage.objects;
create policy "kuru_photos_select" on storage.objects for select
  using (bucket_id = 'kuru-photos' and ((storage.foldername(name))[1] = auth.uid()::text or public.kuru_is_member((storage.foldername(name))[1])));

drop policy if exists "kuru_photos_insert" on storage.objects;
create policy "kuru_photos_insert" on storage.objects for insert
  with check (bucket_id = 'kuru-photos' and ((storage.foldername(name))[1] = auth.uid()::text or public.kuru_is_member((storage.foldername(name))[1])));

drop policy if exists "kuru_photos_update" on storage.objects;
create policy "kuru_photos_update" on storage.objects for update
  using (bucket_id = 'kuru-photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "kuru_photos_delete" on storage.objects;
create policy "kuru_photos_delete" on storage.objects for delete
  using (bucket_id = 'kuru-photos' and (storage.foldername(name))[1] = auth.uid()::text);

-- ---------- Bildirim abonelikleri ----------
create table if not exists public.kuru_push_subs (
  endpoint text primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade, -- aboneliği açan kişi
  owner_id uuid not null,                                                                 -- güvercinlik sahibi
  sub jsonb not null,
  hour int not null default 8,
  tz text not null default 'Europe/Istanbul',
  last_sent date,
  created_at timestamptz not null default now()
);

alter table public.kuru_push_subs enable row level security;

drop policy if exists "kuru_push_own" on public.kuru_push_subs;
create policy "kuru_push_own" on public.kuru_push_subs for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
