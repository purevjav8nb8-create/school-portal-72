export type UsagePoint = { date: string; value: number };
export type UsageMetric = {
  name: string;
  unit: string;
  points: UsagePoint[];
  limit?: number;
  total?: number;
  chart?: 'line';
};
export type UsageProvider = {
  id: string;
  name: string;
  status: 'connected' | 'not_configured' | 'no_data' | 'error';
  metrics: UsageMetric[];
  message: string | null;
};

export type VercelMonthlyUsage = {
  month: string;
  fast_data_transfer_gb: number;
  fast_origin_transfer_gb: number;
  cdn_requests: number;
  isr_reads: number;
  updated_at: string | null;
};

export type VercelWebAnalytics = {
  month: string;
  status: UsageProvider['status'];
  pageviews: number | null;
  visitors: number | null;
  updated_at: string | null;
  message: string | null;
};

export type VercelMonthlyUsageDraft = {
  fast_data_transfer_gb: string;
  fast_origin_transfer_gb: string;
  cdn_requests: string;
  isr_reads: string;
};
