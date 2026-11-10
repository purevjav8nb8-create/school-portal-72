create table if not exists public.school_chat_messages (
    id uuid primary key default gen_random_uuid(),
    conversation_id text not null,
    conversation_type text not null check (conversation_type in ('private', 'broadcast')),
    sender_id text not null,
    sender_name text not null,
    recipient_id text,
    target_units text[] not null default '{}',
    body text not null check (char_length(btrim(body)) between 1 and 5000),
    created_at timestamptz not null default now(),
    constraint school_chat_private_recipient check (
        (conversation_type = 'private' and recipient_id is not null and cardinality(target_units) = 0)
        or (conversation_type = 'broadcast' and recipient_id is null)
    ),
    constraint school_chat_target_units check (
        target_units <@ array['БАЗАН', 'БУЗАН', 'НУЗАН']::text[]
    )
);

create index if not exists school_chat_messages_conversation_created
    on public.school_chat_messages (conversation_id, created_at desc);

create table if not exists public.school_chat_reads (
    message_id uuid not null references public.school_chat_messages (id) on delete cascade,
    user_id text not null,
    read_at timestamptz not null default now(),
    primary key (message_id, user_id)
);

create index if not exists school_chat_reads_user
    on public.school_chat_reads (user_id, message_id);

alter table public.school_chat_messages enable row level security;
alter table public.school_chat_reads enable row level security;
