create table if not exists public.teacher_attendance (
    teacher_id uuid not null references auth.users (id) on delete cascade,
    attendance_date date not null,
    status text not null,
    primary key (teacher_id, attendance_date)
);

alter table public.teacher_attendance enable row level security;

revoke all on public.teacher_attendance from public, anon, authenticated;
grant all on public.teacher_attendance to service_role;

insert into public.teacher_attendance (teacher_id, attendance_date, status)
select
    users.id,
    nullif(record ->> 'date', '')::date,
    record ->> 'status'
from auth.users as users
cross join lateral jsonb_array_elements(
    case
        when jsonb_typeof(users.raw_app_meta_data -> 'teacher_attendance') = 'array'
            then users.raw_app_meta_data -> 'teacher_attendance'
        else '[]'::jsonb
    end
) as records(record)
where nullif(record ->> 'date', '') is not null
  and nullif(record ->> 'status', '') is not null
on conflict (teacher_id, attendance_date) do nothing;

update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) - 'teacher_attendance'
where raw_app_meta_data ? 'teacher_attendance';
