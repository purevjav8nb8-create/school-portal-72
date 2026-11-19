create table if not exists public.teacher_profiles (
    user_id uuid primary key references auth.users (id) on delete cascade,
    email text not null default '',
    first_name text not null default '',
    last_name text not null default '',
    unit text not null default '',
    subject text not null default '',
    role text not null check (role in ('teacher', 'manager', 'admin')),
    lms_username text not null default '',
    updated_at timestamptz not null default now()
);

create table if not exists public.teacher_program_plans (
    teacher_id uuid primary key references auth.users (id) on delete cascade,
    payload jsonb not null check (jsonb_typeof(payload) = 'object'),
    updated_at timestamptz not null default now()
);

create table if not exists public.teacher_trainings (
    teacher_id uuid not null references auth.users (id) on delete cascade,
    record_id text not null,
    record_order integer not null default 0,
    payload jsonb not null check (jsonb_typeof(payload) = 'object'),
    teacher_name text not null default '',
    teacher_email text not null default '',
    created_at timestamptz not null default now(),
    primary key (teacher_id, record_id)
);

create table if not exists public.teacher_evaluations (
    teacher_id uuid not null references auth.users (id) on delete cascade,
    record_id text not null,
    record_order integer not null default 0,
    payload jsonb not null check (jsonb_typeof(payload) = 'object'),
    teacher_name text not null default '',
    teacher_email text not null default '',
    created_at timestamptz not null default now(),
    primary key (teacher_id, record_id)
);

create table if not exists public.teacher_activities (
    teacher_id uuid not null references auth.users (id) on delete cascade,
    record_id text not null,
    record_order integer not null default 0,
    payload jsonb not null check (jsonb_typeof(payload) = 'object'),
    teacher_name text not null default '',
    teacher_email text not null default '',
    created_at timestamptz not null default now(),
    primary key (teacher_id, record_id)
);

create table if not exists public.teacher_awards (
    teacher_id uuid not null references auth.users (id) on delete cascade,
    record_id text not null,
    record_order integer not null default 0,
    payload jsonb not null check (jsonb_typeof(payload) = 'object'),
    teacher_name text not null default '',
    teacher_email text not null default '',
    created_at timestamptz not null default now(),
    primary key (teacher_id, record_id)
);

create table if not exists public.teacher_professional_degrees (
    teacher_id uuid not null references auth.users (id) on delete cascade,
    record_id text not null,
    record_order integer not null default 0,
    payload jsonb not null check (jsonb_typeof(payload) = 'object'),
    teacher_name text not null default '',
    teacher_email text not null default '',
    created_at timestamptz not null default now(),
    primary key (teacher_id, record_id)
);

create table if not exists public.teacher_teaching_classes (
    teacher_id uuid not null references auth.users (id) on delete cascade,
    record_id text not null,
    record_order integer not null default 0,
    payload jsonb not null check (jsonb_typeof(payload) = 'object'),
    teacher_name text not null default '',
    teacher_email text not null default '',
    created_at timestamptz not null default now(),
    primary key (teacher_id, record_id)
);

create table if not exists public.teacher_teaching_class_sets (
    teacher_id uuid primary key references auth.users (id) on delete cascade,
    updated_at text not null
);

create table if not exists public.teacher_survey_responses (
    teacher_id uuid not null references auth.users (id) on delete cascade,
    survey_id text not null,
    question_index integer not null default 0,
    record_order integer not null default 0,
    payload jsonb not null check (jsonb_typeof(payload) = 'object'),
    respondent_name text not null default '',
    created_at timestamptz not null default now(),
    primary key (teacher_id, survey_id, question_index)
);

create table if not exists public.school_announcements (
    id text primary key,
    owner_id uuid not null references auth.users (id) on delete cascade,
    owner_type text not null check (owner_type in ('admin', 'teacher')),
    payload jsonb not null check (jsonb_typeof(payload) = 'object'),
    created_at timestamptz not null default now()
);

create table if not exists public.school_surveys (
    id text primary key,
    owner_id uuid not null references auth.users (id) on delete cascade,
    created_by text,
    payload jsonb not null check (jsonb_typeof(payload) = 'object'),
    created_at timestamptz not null default now()
);

create index if not exists teacher_trainings_order_idx on public.teacher_trainings (teacher_id, record_order);
create index if not exists teacher_evaluations_order_idx on public.teacher_evaluations (teacher_id, record_order);
create index if not exists teacher_evaluations_homeroom_idx on public.teacher_evaluations using gin ((payload));
create index if not exists teacher_activities_order_idx on public.teacher_activities (teacher_id, record_order);
create index if not exists teacher_awards_order_idx on public.teacher_awards (teacher_id, record_order);
create index if not exists teacher_professional_degrees_order_idx on public.teacher_professional_degrees (teacher_id, record_order);
create index if not exists teacher_teaching_classes_order_idx on public.teacher_teaching_classes (teacher_id, record_order);
create index if not exists teacher_survey_responses_survey_idx on public.teacher_survey_responses (survey_id, teacher_id);
create index if not exists school_announcements_owner_idx on public.school_announcements (owner_id, created_at desc);
create index if not exists school_surveys_created_by_idx on public.school_surveys (created_by, created_at desc);

do $$
declare
    table_name text;
begin
    foreach table_name in array array[
        'teacher_program_plans',
        'teacher_profiles',
        'teacher_trainings',
        'teacher_evaluations',
        'teacher_activities',
        'teacher_awards',
        'teacher_professional_degrees',
        'teacher_teaching_classes',
        'teacher_teaching_class_sets',
        'teacher_survey_responses',
        'school_announcements',
        'school_surveys'
    ]
    loop
        execute format('alter table public.%I enable row level security', table_name);
        execute format('revoke all on public.%I from public, anon, authenticated', table_name);
        execute format('drop policy if exists %I on public.%I', table_name || '_service_role_all', table_name);
        execute format(
            'create policy %I on public.%I for all to service_role using (true) with check (true)',
            table_name || '_service_role_all',
            table_name
        );
        execute format('grant all on public.%I to service_role', table_name);
    end loop;
end
$$;

create index if not exists teacher_profiles_role_email_idx on public.teacher_profiles (role, email);

insert into public.teacher_profiles (
    user_id, email, first_name, last_name, unit, subject, role, lms_username
)
select
    users.id,
    coalesce(users.email, ''),
    coalesce(users.raw_user_meta_data ->> 'first_name', ''),
    coalesce(users.raw_user_meta_data ->> 'last_name', ''),
    coalesce(users.raw_user_meta_data ->> 'unit', ''),
    coalesce(users.raw_user_meta_data ->> 'subject', ''),
    case
        when users.raw_app_meta_data ->> 'role' in ('admin', 'manager') then users.raw_app_meta_data ->> 'role'
        when lower(users.email) = 'admin@moes.edu.mn' then 'admin'
        else 'teacher'
    end,
    coalesce(users.raw_user_meta_data ->> 'lms_username', '')
from auth.users as users
where users.raw_app_meta_data ->> 'role' in ('admin', 'manager')
   or lower(users.email) = 'admin@moes.edu.mn'
   or users.raw_user_meta_data ->> 'role' = 'teacher'
   or lower(users.email) like '%@moes.edu.mn'
on conflict (user_id) do nothing;

insert into public.teacher_program_plans (teacher_id, payload)
select users.id, users.raw_user_meta_data #> '{teacher_portal,program_plan}'
from auth.users as users
where jsonb_typeof(users.raw_user_meta_data #> '{teacher_portal,program_plan}') = 'object'
on conflict (teacher_id) do nothing;

insert into public.teacher_trainings (teacher_id, record_id, record_order, payload, teacher_name, teacher_email)
select users.id,
       coalesce(nullif(record ->> 'id', ''), md5(record::text || records.ordinality::text)),
       (records.ordinality - 1)::integer,
       record,
       concat_ws(' ', nullif(users.raw_user_meta_data ->> 'last_name', ''), nullif(users.raw_user_meta_data ->> 'first_name', '')),
       coalesce(users.email, '')
from auth.users as users
cross join lateral jsonb_array_elements(
    case when jsonb_typeof(users.raw_user_meta_data #> '{teacher_portal,trainings}') = 'array'
         then users.raw_user_meta_data #> '{teacher_portal,trainings}' else '[]'::jsonb end
) with ordinality as records(record, ordinality)
where jsonb_typeof(record) = 'object'
on conflict (teacher_id, record_id) do nothing;

insert into public.teacher_evaluations (teacher_id, record_id, record_order, payload, teacher_name, teacher_email)
select users.id,
       coalesce(nullif(record ->> 'id', ''), md5(record::text || records.ordinality::text)),
       (records.ordinality - 1)::integer, record,
       concat_ws(' ', nullif(users.raw_user_meta_data ->> 'last_name', ''), nullif(users.raw_user_meta_data ->> 'first_name', '')),
       coalesce(users.email, '')
from auth.users as users
cross join lateral jsonb_array_elements(
    case when jsonb_typeof(users.raw_user_meta_data #> '{teacher_portal,evaluations}') = 'array'
         then users.raw_user_meta_data #> '{teacher_portal,evaluations}' else '[]'::jsonb end
) with ordinality as records(record, ordinality)
where jsonb_typeof(record) = 'object'
on conflict (teacher_id, record_id) do nothing;

insert into public.teacher_activities (teacher_id, record_id, record_order, payload, teacher_name, teacher_email)
select users.id,
       coalesce(nullif(record ->> 'id', ''), md5(record::text || records.ordinality::text)),
       (records.ordinality - 1)::integer,
       record,
       concat_ws(' ', nullif(users.raw_user_meta_data ->> 'last_name', ''), nullif(users.raw_user_meta_data ->> 'first_name', '')),
       coalesce(users.email, '')
from auth.users as users
cross join lateral jsonb_array_elements(
    case when jsonb_typeof(users.raw_user_meta_data #> '{teacher_portal,activities}') = 'array'
         then users.raw_user_meta_data #> '{teacher_portal,activities}' else '[]'::jsonb end
) with ordinality as records(record, ordinality)
where jsonb_typeof(record) = 'object'
on conflict (teacher_id, record_id) do nothing;

insert into public.teacher_awards (teacher_id, record_id, record_order, payload, teacher_name, teacher_email)
select users.id,
       coalesce(nullif(record ->> 'id', ''), md5(record::text || records.ordinality::text)),
       (records.ordinality - 1)::integer, record,
       concat_ws(' ', nullif(users.raw_user_meta_data ->> 'last_name', ''), nullif(users.raw_user_meta_data ->> 'first_name', '')),
       coalesce(users.email, '')
from auth.users as users
cross join lateral jsonb_array_elements(
    case when jsonb_typeof(users.raw_user_meta_data #> '{teacher_portal,awards}') = 'array'
         then users.raw_user_meta_data #> '{teacher_portal,awards}' else '[]'::jsonb end
) with ordinality as records(record, ordinality)
where jsonb_typeof(record) = 'object'
on conflict (teacher_id, record_id) do nothing;

insert into public.teacher_professional_degrees (teacher_id, record_id, record_order, payload, teacher_name, teacher_email)
select users.id,
       coalesce(nullif(record ->> 'id', ''), md5(record::text || records.ordinality::text)),
       (records.ordinality - 1)::integer, record,
       concat_ws(' ', nullif(users.raw_user_meta_data ->> 'last_name', ''), nullif(users.raw_user_meta_data ->> 'first_name', '')),
       coalesce(users.email, '')
from auth.users as users
cross join lateral jsonb_array_elements(
    case when jsonb_typeof(users.raw_user_meta_data #> '{teacher_portal,professional_degrees}') = 'array'
         then users.raw_user_meta_data #> '{teacher_portal,professional_degrees}' else '[]'::jsonb end
) with ordinality as records(record, ordinality)
where jsonb_typeof(record) = 'object'
on conflict (teacher_id, record_id) do nothing;

insert into public.teacher_teaching_classes (teacher_id, record_id, record_order, payload, teacher_name, teacher_email)
select users.id,
       records.ordinality::text,
       (records.ordinality - 1)::integer, record,
       concat_ws(' ', nullif(users.raw_user_meta_data ->> 'last_name', ''), nullif(users.raw_user_meta_data ->> 'first_name', '')),
       coalesce(users.email, '')
from auth.users as users
cross join lateral jsonb_array_elements(
    case when jsonb_typeof(users.raw_user_meta_data #> '{teacher_portal,teaching_classes}') = 'array'
         then users.raw_user_meta_data #> '{teacher_portal,teaching_classes}' else '[]'::jsonb end
) with ordinality as records(record, ordinality)
where jsonb_typeof(record) = 'object'
on conflict (teacher_id, record_id) do nothing;

insert into public.teacher_teaching_class_sets (teacher_id, updated_at)
select users.id, users.raw_user_meta_data #>> '{teacher_portal,teaching_classes_updated_at}'
from auth.users as users
where nullif(users.raw_user_meta_data #>> '{teacher_portal,teaching_classes_updated_at}', '') is not null
on conflict (teacher_id) do nothing;

insert into public.teacher_survey_responses (teacher_id, survey_id, question_index, record_order, payload, respondent_name)
select users.id,
       nullif(record ->> 'survey_id', ''),
       case when coalesce(record ->> 'question_index', '') ~ '^[0-9]{1,6}$'
            then (record ->> 'question_index')::integer else 0 end,
       (records.ordinality - 1)::integer,
       record,
       coalesce(nullif(concat_ws(' ', nullif(users.raw_user_meta_data ->> 'last_name', ''), nullif(users.raw_user_meta_data ->> 'first_name', '')), ''),
                users.email, 'Нэргүй багш')
from auth.users as users
cross join lateral jsonb_array_elements(
    case when jsonb_typeof(users.raw_user_meta_data #> '{teacher_portal,survey_responses}') = 'array'
         then users.raw_user_meta_data #> '{teacher_portal,survey_responses}' else '[]'::jsonb end
) with ordinality as records(record, ordinality)
where jsonb_typeof(record) = 'object'
  and nullif(record ->> 'survey_id', '') is not null
on conflict (teacher_id, survey_id, question_index) do nothing;

insert into public.school_announcements (id, owner_id, owner_type, payload)
select coalesce(nullif(item ->> 'id', ''), md5(item::text || users.id::text || records.ordinality::text)),
       users.id,
       'admin',
       item
from auth.users as users
cross join lateral jsonb_array_elements(
    case when jsonb_typeof(users.raw_app_meta_data -> 'school_announcements') = 'array'
         then users.raw_app_meta_data -> 'school_announcements' else '[]'::jsonb end
) with ordinality as records(item, ordinality)
where jsonb_typeof(item) = 'object'
  and (
      users.raw_app_meta_data ->> 'role' in ('admin', 'manager')
      or lower(users.email) = 'admin@moes.edu.mn'
  )
union all
select coalesce(nullif(item ->> 'id', ''), md5(item::text || users.id::text || records.ordinality::text)),
       users.id,
       'teacher',
       item || jsonb_build_object(
           'author',
           coalesce(nullif(item ->> 'author', ''),
                    nullif(concat_ws(' ', nullif(users.raw_user_meta_data ->> 'last_name', ''), nullif(users.raw_user_meta_data ->> 'first_name', '')), ''),
                    users.email, '')
       )
from auth.users as users
cross join lateral jsonb_array_elements(
    case when jsonb_typeof(users.raw_user_meta_data #> '{teacher_portal,announcements}') = 'array'
         then users.raw_user_meta_data #> '{teacher_portal,announcements}' else '[]'::jsonb end
) with ordinality as records(item, ordinality)
where jsonb_typeof(item) = 'object'
  and (
      users.raw_user_meta_data ->> 'role' = 'teacher'
      or (
          lower(users.email) like '%@moes.edu.mn'
          and lower(users.email) <> 'admin@moes.edu.mn'
      )
  )
on conflict (id) do nothing;

insert into public.school_surveys (id, owner_id, created_by, payload)
select coalesce(nullif(item ->> 'id', ''), md5(item::text || users.id::text || records.ordinality::text)),
       users.id,
       nullif(item ->> 'created_by', ''),
       item
from auth.users as users
cross join lateral jsonb_array_elements(
    case when jsonb_typeof(users.raw_app_meta_data -> 'school_surveys') = 'array'
         then users.raw_app_meta_data -> 'school_surveys' else '[]'::jsonb end
) with ordinality as records(item, ordinality)
where jsonb_typeof(item) = 'object'
  and (
      users.raw_app_meta_data ->> 'role' in ('admin', 'manager')
      or lower(users.email) = 'admin@moes.edu.mn'
  )
on conflict (id) do nothing;

update auth.users
set raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) - 'teacher_portal'
where raw_user_meta_data ? 'teacher_portal';

update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) - 'school_announcements' - 'school_surveys'
where raw_app_meta_data ? 'school_announcements'
   or raw_app_meta_data ? 'school_surveys';
