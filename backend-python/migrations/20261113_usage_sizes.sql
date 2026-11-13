CREATE OR REPLACE FUNCTION public.get_usage_sizes()
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, public, storage
AS $$
    SELECT jsonb_build_object(
        'database_size_mb',
        round(pg_catalog.pg_database_size(pg_catalog.current_database())::numeric / 1048576, 2),
        'storage_size_mb',
        round(
            COALESCE(
                (
                    SELECT SUM(
                        CASE
                            WHEN objects.metadata->>'size' ~ '^[0-9]+([.][0-9]+)?$'
                            THEN (objects.metadata->>'size')::numeric
                            ELSE 0
                        END
                    )
                    FROM storage.objects AS objects
                ),
                0
            ) / 1048576,
            2
        )
    );
$$;

REVOKE ALL ON FUNCTION public.get_usage_sizes() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_usage_sizes() TO service_role;
