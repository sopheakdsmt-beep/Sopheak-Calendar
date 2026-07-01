-- supabase/migration_events.sql
-- រត់ក្នុង Supabase SQL Editor (បន្ថែមលើ schema.sql ដើម) សម្រាប់មុខងារ "បង្កើតព្រឹត្តិការណ៍"។

-- ===== event_drafts (conversation state សម្រាប់ guided flow) =====
create table if not exists public.event_drafts (
  telegram_id   bigint primary key references public.users(telegram_id) on delete cascade,
  step          text not null,
  summary       text,
  event_date    date,
  event_time    text,
  reminder_kind text,
  updated_at    timestamptz not null default now()
);

-- ===== scheduled_reminders (remind_at គណនាទុកជាមុន; cron ផ្ញើនៅពេលដល់) =====
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

-- ===== RLS (locked ដូចតារាងផ្សេង; service_role ប៉ុណ្ណោះចូលបាន) =====
alter table public.event_drafts        enable row level security;
alter table public.scheduled_reminders enable row level security;
revoke all on public.event_drafts        from anon, authenticated;
revoke all on public.scheduled_reminders from anon, authenticated;
