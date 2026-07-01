-- supabase/schema.sql
-- រត់ក្នុង Supabase SQL Editor។
-- RLS បើកលើគ្រប់ table ហើយគ្មាន public policy → គ្មាននរណាចូលដោយ anon key បានទេ។
-- មានតែ service_role (server) ប៉ុណ្ណោះដែលចូលបាន (bypass RLS)។

-- ===== users =====
create table if not exists public.users (
  telegram_id          bigint primary key,
  telegram_username    text,
  google_refresh_token text,                 -- encrypted (AES-256-GCM); មិនមែន plaintext
  google_email         text,
  reminder_minutes     int  not null default 30,
  timezone             text not null default 'Asia/Phnom_Penh',
  connected_at         timestamptz,
  created_at           timestamptz not null default now()
);

-- ===== reminders_sent (idempotency) =====
-- ការពារផ្ញើ reminder ស្ទួនសម្រាប់ event ដដែល។
create table if not exists public.reminders_sent (
  id           bigserial primary key,
  telegram_id  bigint not null references public.users(telegram_id) on delete cascade,
  event_id     text   not null,
  event_start  timestamptz not null,
  sent_at      timestamptz not null default now(),
  unique (telegram_id, event_id, event_start)
);

create index if not exists idx_reminders_sent_at on public.reminders_sent (sent_at);

-- ===== Row Level Security =====
alter table public.users          enable row level security;
alter table public.reminders_sent enable row level security;

-- ដក grant ពី anon/authenticated (ការពារ leak តាម PostgREST anon key)
revoke all on public.users          from anon, authenticated;
revoke all on public.reminders_sent from anon, authenticated;

-- មិនបង្កើត policy ណាមួយ → គ្មាន row អាចចូលបានដោយ anon/authenticated។
-- service_role bypass RLS ស្វ័យប្រវត្តិ ដូច្នេះ server នៅតែដំណើរការ។

-- (ស្រេចចិត្ត) សម្អាត reminders_sent ចាស់ៗ ដោយដៃ៖
--   delete from public.reminders_sent where sent_at < now() - interval '7 days';

-- ===== event_drafts + scheduled_reminders (មុខងារ "បង្កើតព្រឹត្តិការណ៍") =====
-- មាននៅ supabase/migration_events.sql ដែរ (សម្រាប់ project ដែលដំឡើងរួច)។
create table if not exists public.event_drafts (
  telegram_id   bigint primary key references public.users(telegram_id) on delete cascade,
  step          text not null,
  summary       text,
  event_date    date,
  event_time    text,
  reminder_kind text,
  updated_at    timestamptz not null default now()
);

create table if not exists public.scheduled_reminders (
  id              bigserial primary key,
  telegram_id     bigint not null references public.users(telegram_id) on delete cascade,
  summary         text not null,
  when_text       text,
  event_start     timestamptz not null,
  remind_at       timestamptz not null,
  google_event_id text,
  sent            boolean not null default false,
  created_at      timestamptz not null default now()
);
create index if not exists idx_sched_due on public.scheduled_reminders (remind_at) where sent = false;

alter table public.event_drafts        enable row level security;
alter table public.scheduled_reminders enable row level security;
revoke all on public.event_drafts        from anon, authenticated;
revoke all on public.scheduled_reminders from anon, authenticated;

-- ===== holidays + daily digest (Phase 2) =====
-- មាននៅ supabase/migration_holidays.sql + seed_holidays_2026.sql ដែរ។
create table if not exists public.holidays (
  holiday_date date primary key,
  name         text not null,
  created_at   timestamptz not null default now()
);

create table if not exists public.daily_sent (
  telegram_id bigint not null references public.users(telegram_id) on delete cascade,
  sent_date   date   not null,
  sent_at     timestamptz not null default now(),
  primary key (telegram_id, sent_date)
);

alter table public.users add column if not exists notify_daily boolean not null default true;

alter table public.holidays   enable row level security;
alter table public.daily_sent enable row level security;
revoke all on public.holidays   from anon, authenticated;
revoke all on public.daily_sent from anon, authenticated;

-- ===== settings (Phase 3 — sponsor ។ល។) =====
create table if not exists public.settings (
  key        text primary key,
  value      text,
  updated_at timestamptz not null default now()
);
alter table public.settings enable row level security;
revoke all on public.settings from anon, authenticated;
