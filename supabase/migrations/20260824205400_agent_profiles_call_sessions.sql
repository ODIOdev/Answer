create extension if not exists pgcrypto;


create table if not exists public.agent_profiles (

    id uuid primary key default gen_random_uuid(),

    label text not null,

    enabled boolean not null default false,

    phone_number text unique,

    twilio_phone_sid text unique,

    disclosure text not null
        default 'Hello. I am an automated authorized assistant.',

    tts_provider text not null
        default 'google',

    voice_pool jsonb not null
        default '["en-US-Journey-O"]'::jsonb,

    authorized_facts jsonb not null
        default '{}'::jsonb,

    human_transfer_number text,

    created_at timestamptz not null
        default now(),

    updated_at timestamptz not null
        default now()
);



create table if not exists public.call_sessions (

    id uuid primary key default gen_random_uuid(),

    call_sid text unique not null,

    session_id text,

    profile_id uuid
        references public.agent_profiles(id)
        on delete set null,

    from_number text,

    to_number text,

    voice_name text,

    status text not null
        default 'started',

    transcript jsonb not null
        default '[]'::jsonb,

    result text,

    started_at timestamptz not null
        default now(),

    ended_at timestamptz,

    updated_at timestamptz not null
        default now()
);



create index if not exists
idx_agent_profiles_phone
on public.agent_profiles(phone_number);


create index if not exists
idx_call_sessions_started
on public.call_sessions(started_at desc);


create index if not exists
idx_call_sessions_profile
on public.call_sessions(profile_id);



create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$

begin

    new.updated_at = now();

    return new;

end;

$$;



drop trigger if exists
trg_agent_profiles_updated_at
on public.agent_profiles;


drop trigger if exists
touch_agent_profiles
on public.agent_profiles;


create trigger touch_agent_profiles

before update
on public.agent_profiles

for each row

execute function public.touch_updated_at();



drop trigger if exists
trg_call_sessions_updated_at
on public.call_sessions;


drop trigger if exists
touch_call_sessions
on public.call_sessions;


create trigger touch_call_sessions

before update
on public.call_sessions

for each row

execute function public.touch_updated_at();



alter table public.agent_profiles
enable row level security;


alter table public.call_sessions
enable row level security;



grant all
on public.agent_profiles
to service_role;


grant all
on public.call_sessions
to service_role;
