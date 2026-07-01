-- supabase/migration_holidays.sql
-- Phase 2៖ ថ្ងៃឈប់សម្រាក + daily digest (សីល/ឈប់សម្រាក)។ រត់ក្នុង Supabase SQL Editor។

-- ===== holidays (admin បញ្ចូល/កែ) =====
create table if not exists public.holidays (
  holiday_date date primary key,
  name         text not null,
  created_at   timestamptz not null default now()
);

-- ===== daily_sent (idempotency — digest ផ្ញើម្ដង/ថ្ងៃ/user) =====
create table if not exists public.daily_sent (
  telegram_id bigint not null references public.users(telegram_id) on delete cascade,
  sent_date   date   not null,
  sent_at     timestamptz not null default now(),
  primary key (telegram_id, sent_date)
);

-- ===== opt-out column (in-context + opt-out; default បើក) =====
alter table public.users add column if not exists notify_daily boolean not null default true;

-- ===== RLS (locked) =====
alter table public.holidays   enable row level security;
alter table public.daily_sent enable row level security;
revoke all on public.holidays   from anon, authenticated;
revoke all on public.daily_sent from anon, authenticated;
