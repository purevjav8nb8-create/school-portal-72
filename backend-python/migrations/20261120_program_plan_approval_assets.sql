create table if not exists public.program_plan_approval_assets (
    user_id uuid primary key references auth.users (id) on delete cascade,
    signature_url text not null,
    stamp_url text not null,
    composite_url text,
    updated_at timestamptz not null default now()
);

alter table public.program_plan_approval_assets enable row level security;

revoke all on public.program_plan_approval_assets from public, anon, authenticated;
grant all on public.program_plan_approval_assets to service_role;

insert into public.program_plan_approval_assets (user_id, signature_url, stamp_url)
select
    id,
    raw_app_meta_data -> 'program_plan_approval_assets' ->> 'signature_url',
    raw_app_meta_data -> 'program_plan_approval_assets' ->> 'stamp_url'
from auth.users
where nullif(raw_app_meta_data -> 'program_plan_approval_assets' ->> 'signature_url', '') is not null
  and nullif(raw_app_meta_data -> 'program_plan_approval_assets' ->> 'stamp_url', '') is not null
on conflict (user_id) do nothing;

update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) - 'program_plan_approval_assets'
where raw_app_meta_data ? 'program_plan_approval_assets';
