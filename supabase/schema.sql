-- Kuru — Supabase şeması
-- Supabase panelinde SQL Editor'e yapıştırıp bir kez çalıştırın.

create table if not exists public.kuru_records (
  id uuid primary key,
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  collection text not null,
  data jsonb not null,
  updated_at timestamptz not null default now(),   -- cihazdaki son değişiklik zamanı
  deleted boolean not null default false,
  server_updated_at timestamptz not null default now() -- sunucuya yazılma zamanı (senkron sınırı)
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

-- Satır düzeyi güvenlik: herkes yalnızca kendi kayıtlarını görür ve yazar
alter table public.kuru_records enable row level security;

drop policy if exists "kuru_select_own" on public.kuru_records;
create policy "kuru_select_own" on public.kuru_records for select using (owner_id = auth.uid());

drop policy if exists "kuru_insert_own" on public.kuru_records;
create policy "kuru_insert_own" on public.kuru_records for insert with check (owner_id = auth.uid());

drop policy if exists "kuru_update_own" on public.kuru_records;
create policy "kuru_update_own" on public.kuru_records for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- ---------- Fotoğraflar (Storage) ----------
-- Dosya yolu: <güvercinlik sahibinin kullanıcı kimliği>/<fotoğraf kimliği>.jpg
insert into storage.buckets (id, name, public)
values ('kuru-photos', 'kuru-photos', false)
on conflict (id) do nothing;

drop policy if exists "kuru_photos_select" on storage.objects;
create policy "kuru_photos_select" on storage.objects for select
  using (bucket_id = 'kuru-photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "kuru_photos_insert" on storage.objects;
create policy "kuru_photos_insert" on storage.objects for insert
  with check (bucket_id = 'kuru-photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "kuru_photos_update" on storage.objects;
create policy "kuru_photos_update" on storage.objects for update
  using (bucket_id = 'kuru-photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "kuru_photos_delete" on storage.objects;
create policy "kuru_photos_delete" on storage.objects for delete
  using (bucket_id = 'kuru-photos' and (storage.foldername(name))[1] = auth.uid()::text);
