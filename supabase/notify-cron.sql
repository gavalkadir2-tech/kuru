-- Kuru — günlük bildirimlerin zamanlanması
-- 1) Database → Extensions bölümünden "pg_cron" ve "pg_net" eklentilerini açın.
-- 2) Aşağıdaki iki yeri değiştirip SQL Editor'de çalıştırın:
--    PROJE_REF    → Supabase proje kimliğiniz (ör. kvxqqgwetanrsefrmemc)
--    CRON_PAROLA  → Edge Functions → Secrets'a CRON_SECRET adıyla eklediğiniz rastgele parola
-- Görev her saat başını 5 geçe çalışır; fonksiyon yalnızca kullanıcının seçtiği saatte bildirim yollar.

select cron.unschedule('kuru-notify') where exists (select 1 from cron.job where jobname = 'kuru-notify');

select cron.schedule(
  'kuru-notify',
  '5 * * * *',
  $$
  select net.http_post(
    url := 'https://PROJE_REF.supabase.co/functions/v1/kuru-notify',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', 'CRON_PAROLA'),
    body := '{}'::jsonb
  );
  $$
);
