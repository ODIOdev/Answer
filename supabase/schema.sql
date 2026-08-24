-- AI Voice Platform schema
-- Paste this into the Supabase SQL Editor and run it once per project.
--
-- AUTHORIZED_FACTS safety:
-- Store only information the automated assistant is permitted to disclose.
-- Do not store passwords, PINs, full SSNs, payment card numbers, or security answers.

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table if not exists public.agent_profiles (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  enabled boolean not null default false,
  phone_number text unique,
  twilio_phone_sid text unique,
  disclosure text not null default 'Hello. I am an automated authorized assistant.',
  tts_provider text not null default 'google',
  voice_pool jsonb not null default '["en-US-Journey-O"]'::jsonb,
  authorized_facts jsonb not null default '{}'::jsonb,
  human_transfer_number text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint agent_profiles_label_not_blank check (char_length(trim(label)) > 0)
);

create table if not exists public.call_sessions (
  id uuid primary key default gen_random_uuid(),
  call_sid text unique not null,
  session_id text,
  profile_id uuid references public.agent_profiles (id) on delete set null,
  from_number text,
  to_number text,
  voice_name text,
  status text not null default 'in-progress',
  transcript jsonb not null default '[]'::jsonb,
  result text,
  started_at timestamptz not null default timezone('utc', now()),
  ended_at timestamptz,
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_agent_profiles_phone_number
  on public.agent_profiles (phone_number);

create index if not exists idx_agent_profiles_enabled
  on public.agent_profiles (enabled);

create index if not exists idx_call_sessions_profile_id
  on public.call_sessions (profile_id);

create index if not exists idx_call_sessions_status
  on public.call_sessions (status);

create index if not exists idx_call_sessions_started_at
  on public.call_sessions (started_at desc);

create index if not exists idx_call_sessions_session_id
  on public.call_sessions (session_id);

drop trigger if exists trg_agent_profiles_updated_at on public.agent_profiles;
create trigger trg_agent_profiles_updated_at
before update on public.agent_profiles
for each row execute function public.set_updated_at();

drop trigger if exists trg_call_sessions_updated_at on public.call_sessions;
create trigger trg_call_sessions_updated_at
before update on public.call_sessions
for each row execute function public.set_updated_at();

alter table public.agent_profiles enable row level security;
alter table public.call_sessions enable row level security;

comment on table public.agent_profiles is
  'Per-number automated assistant configuration. The voice service accesses this table with SUPABASE_SERVICE_ROLE_KEY.';
comment on column public.agent_profiles.authorized_facts is
  'JSON object of facts the disclosed automated assistant may speak. Never store secrets or verification credentials.';
comment on column public.agent_profiles.voice_pool is
  'Array of ConversationRelay TTS voice identifiers. One is chosen per call for presentation only, not identity.';
comment on table public.call_sessions is
  'One row per Twilio CallSid. Transcripts are per-call and must never be shared across concurrent sessions.';
