-- supabase/migration_sponsor.sql
-- Sponsor auto-show (២ដង/សប្ដាហ៍ ឬតាម Admin កំណត់) — log ដើម្បីកំណត់ប្រេកង់។
-- Sponsor text/image/frequency រក្សាក្នុង settings (keys: sponsor, sponsor_image, sponsor_per_week)។

create table if not exists public.sponsor_shown (
  id          bigserial primary key,
  telegram_id bigint not null,
  shown_at    timestamptz not null default now()
);
create index if not exists idx_sponsor_shown on public.sponsor_shown (telegram_id, shown_at);

alter table public.sponsor_shown enable row level security;
revoke all on public.sponsor_shown from anon, authenticated;
