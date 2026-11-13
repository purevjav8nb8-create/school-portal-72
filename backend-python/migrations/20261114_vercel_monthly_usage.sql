CREATE TABLE IF NOT EXISTS public.vercel_monthly_usage (
    id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    month text NOT NULL CHECK (month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
    fast_data_transfer_gb numeric(16, 8) NOT NULL DEFAULT 0 CHECK (fast_data_transfer_gb >= 0),
    fast_origin_transfer_gb numeric(16, 8) NOT NULL DEFAULT 0 CHECK (fast_origin_transfer_gb >= 0),
    cdn_requests bigint NOT NULL DEFAULT 0 CHECK (cdn_requests >= 0),
    isr_reads bigint NOT NULL DEFAULT 0 CHECK (isr_reads >= 0),
    updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.vercel_monthly_usage ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.vercel_monthly_usage FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.vercel_monthly_usage TO service_role;

ALTER TABLE public.vercel_monthly_usage
    ALTER COLUMN fast_data_transfer_gb TYPE numeric(16, 8),
    ALTER COLUMN fast_origin_transfer_gb TYPE numeric(16, 8);

INSERT INTO public.vercel_monthly_usage (
    id,
    month,
    fast_data_transfer_gb,
    fast_origin_transfer_gb,
    cdn_requests,
    isr_reads,
    updated_at
)
VALUES (
    1,
    to_char(now() AT TIME ZONE 'Asia/Ulaanbaatar', 'YYYY-MM'),
    0.04577,
    0.00088709,
    1400,
    190,
    now()
)
ON CONFLICT (id) DO NOTHING;
