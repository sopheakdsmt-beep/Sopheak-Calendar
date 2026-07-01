-- supabase/migration_local_events.sql
-- ព្រឹត្តិការណ៍ក្នុង Bot (មិនពឹង Google Calendar) — សម្រាប់អ្នកប្រើដែលមិនចេះ Google។
-- រត់ក្នុង Supabase SQL Editor។

create table if not exists public.local_events (
  id            bigserial primary key,
  telegram_id   bigint not null references public.users(telegram_id) on delete cascade,
  summary       text not null,
  start_at      timestamptz not null,
  reminder_kind text,
  created_at    timestamptz not null default now()
);
create index if not exists idx_local_events_user_start on public.local_events (telegram_id, start_at);

alter table public.local_events enable row level security;
revoke all on public.local_events from anon, authenticated;
