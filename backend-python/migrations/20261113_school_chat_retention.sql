CREATE TABLE IF NOT EXISTS public.school_chat_retention_state (
    id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    last_pruned_size_bytes bigint NOT NULL DEFAULT 0 CHECK (last_pruned_size_bytes >= 0),
    last_pruned_at timestamptz,
    last_deleted_messages bigint NOT NULL DEFAULT 0 CHECK (last_deleted_messages >= 0)
);

ALTER TABLE public.school_chat_retention_state ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.school_chat_retention_state FROM PUBLIC, anon, authenticated;

INSERT INTO public.school_chat_retention_state (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

CREATE INDEX IF NOT EXISTS school_chat_messages_created_id
    ON public.school_chat_messages (created_at, id);

CREATE OR REPLACE FUNCTION public.prune_old_school_chat_messages()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
    database_size_bytes bigint;
    last_pruned_size_bytes bigint;
    deleted_messages bigint;
    cleanup_threshold_bytes bigint := 450 * 1024 * 1024;
    cleanup_growth_bytes bigint := 25 * 1024 * 1024;
    cleanup_batch_bytes bigint := 50 * 1024 * 1024;
BEGIN
    database_size_bytes := pg_catalog.pg_database_size(pg_catalog.current_database());

    IF database_size_bytes < cleanup_threshold_bytes THEN
        UPDATE public.school_chat_retention_state
        SET last_pruned_size_bytes = 0
        WHERE id = 1;
        RETURN NEW;
    END IF;

    PERFORM pg_catalog.pg_advisory_xact_lock(721560, 13);

    database_size_bytes := pg_catalog.pg_database_size(pg_catalog.current_database());
    SELECT state.last_pruned_size_bytes
    INTO last_pruned_size_bytes
    FROM public.school_chat_retention_state AS state
    WHERE state.id = 1
    FOR UPDATE;

    -- Deleted pages can be reused without immediately shrinking pg_database_size.
    IF database_size_bytes < last_pruned_size_bytes + cleanup_growth_bytes THEN
        RETURN NEW;
    END IF;

    WITH ordered_messages AS (
        SELECT
            message.id,
            pg_catalog.pg_column_size(message) AS row_bytes,
            sum(pg_catalog.pg_column_size(message)) OVER (
                ORDER BY message.created_at, message.id
            ) AS cumulative_bytes
        FROM public.school_chat_messages AS message
    ),
    oldest_messages AS (
        SELECT ordered_messages.id
        FROM ordered_messages
        WHERE ordered_messages.cumulative_bytes - ordered_messages.row_bytes < cleanup_batch_bytes
    )
    DELETE FROM public.school_chat_messages AS message
    USING oldest_messages
    WHERE message.id = oldest_messages.id;

    GET DIAGNOSTICS deleted_messages = ROW_COUNT;

    UPDATE public.school_chat_retention_state
    SET
        last_pruned_size_bytes = database_size_bytes,
        last_pruned_at = pg_catalog.now(),
        last_deleted_messages = deleted_messages
    WHERE id = 1;

    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.prune_old_school_chat_messages() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prune_old_school_chat_messages() TO service_role;

DROP TRIGGER IF EXISTS prune_old_school_chat_messages_before_insert
    ON public.school_chat_messages;

CREATE TRIGGER prune_old_school_chat_messages_before_insert
BEFORE INSERT ON public.school_chat_messages
FOR EACH ROW
EXECUTE FUNCTION public.prune_old_school_chat_messages();
