create table if not exists public.school_public_holidays (
    holiday_date date primary key,
    name text not null default 'Бүх нийтийн амралт',
    created_by uuid references auth.users (id) on delete set null,
    updated_at timestamptz not null default now()
);

alter table public.school_public_holidays enable row level security;

revoke all on public.school_public_holidays from public, anon, authenticated;
grant all on public.school_public_holidays to service_role;
