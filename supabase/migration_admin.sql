-- supabase/migration_admin.sql
-- Phase 3៖ settings (key/value — ឧ. sponsor message)។ រត់ក្នុង Supabase SQL Editor។

create table if not exists public.settings (
  key        text primary key,
  value      text,
  updated_at timestamptz not null default now()
);

alter table public.settings enable row level security;
revoke all on public.settings from anon, authenticated;
