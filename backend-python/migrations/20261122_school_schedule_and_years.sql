create table if not exists public.school_academic_years (
    academic_year text primary key
        check (academic_year ~ '^[0-9]{4}-[0-9]{4}$'),
    start_date date not null,
    end_date date not null,
    terms jsonb not null default '[]'::jsonb
        check (jsonb_typeof(terms) = 'array'),
    created_by uuid references auth.users (id) on delete set null,
    updated_at timestamptz not null default now(),
    constraint school_academic_year_dates check (start_date <= end_date)
);

create table if not exists public.school_teacher_schedules (
    academic_year text primary key
        references public.school_academic_years (academic_year) on delete cascade,
    lessons jsonb not null default '[]'::jsonb
        check (jsonb_typeof(lessons) = 'array'),
    uploaded_by uuid references auth.users (id) on delete set null,
    updated_at timestamptz not null default now()
);

create table if not exists public.school_substitute_hours (
    academic_year text not null
        references public.school_academic_years (academic_year) on delete cascade,
    work_month date not null,
    teacher_id uuid not null references auth.users (id) on delete cascade,
    hours numeric(6,2) not null default 0
        check (hours >= 0 and hours <= 400),
    updated_by uuid references auth.users (id) on delete set null,
    updated_at timestamptz not null default now(),
    primary key (academic_year, work_month, teacher_id),
    constraint school_substitute_month_start check (extract(day from work_month) = 1)
);

create index if not exists school_substitute_hours_month
    on public.school_substitute_hours (academic_year, work_month);

alter table public.school_academic_years enable row level security;
alter table public.school_teacher_schedules enable row level security;
alter table public.school_substitute_hours enable row level security;

revoke all on public.school_academic_years from public, anon, authenticated;
revoke all on public.school_teacher_schedules from public, anon, authenticated;
revoke all on public.school_substitute_hours from public, anon, authenticated;
grant all on public.school_academic_years to service_role;
grant all on public.school_teacher_schedules to service_role;
grant all on public.school_substitute_hours to service_role;
