'use client';

import { useEffect, useState } from 'react';
import { backendBaseUrl, fetchWithAuth } from '../../../lib/backendApi';

type UsagePoint = { date: string; value: number };
type UsageMetric = { name: string; unit: string; points: UsagePoint[]; limit?: number; total?: number; chart?: 'line' };
type UsageProvider = {
  id: string;
  name: string;
  status: 'connected' | 'not_configured' | 'no_data' | 'error';
  metrics: UsageMetric[];
  message: string | null;
};

type VercelMonthlyUsage = {
  month: string;
  fast_data_transfer_gb: number;
  fast_origin_transfer_gb: number;
  cdn_requests: number;
  isr_reads: number;
  updated_at: string | null;
};

type VercelWebAnalytics = {
  month: string;
  status: UsageProvider['status'];
  pageviews: number | null;
  visitors: number | null;
  updated_at: string | null;
  message: string | null;
};

type VercelMonthlyUsageDraft = {
  fast_data_transfer_gb: string;
  fast_origin_transfer_gb: string;
  cdn_requests: string;
  isr_reads: string;
};

const monthlyUsageFields: Array<{
  key: keyof VercelMonthlyUsageDraft;
  label: string;
  unit: string;
  step: string;
}> = [
  { key: 'fast_data_transfer_gb', label: 'Fast Data Transfer', unit: 'GB', step: '0.00000001' },
  { key: 'fast_origin_transfer_gb', label: 'Fast Origin Transfer', unit: 'GB', step: '0.00000001' },
  { key: 'cdn_requests', label: 'CDN Requests', unit: 'хүсэлт', step: '1' },
  { key: 'isr_reads', label: 'ISR Reads', unit: '8 KB-н нэгж', step: '1' },
];

function MetricProgress({ metric }: { metric: UsageMetric }) {
  const points = metric.points.filter((point) => Number.isFinite(point.value));
  if (!points.length) return null;

  if (metric.chart === 'line') {
    const width = 320;
    const height = 88;
    const padding = 8;
    const values = points.map((point) => point.value);
    const maximum = Math.max(...values);
    const range = maximum || 1;
    const coordinates = points.map((point, index) => {
      const x = points.length === 1
        ? width / 2
        : padding + index * (width - padding * 2) / (points.length - 1);
      const y = height - padding - point.value / range * (height - padding * 2);
      return { x, y };
    });
    const line = coordinates.map(({ x, y }) => `${x},${y}`).join(' ');
    const total = metric.total ?? values[values.length - 1];
    const formatValue = (value: number) => value.toLocaleString('mn-MN', { maximumFractionDigits: 0 });
    const firstPoint = points[0];
    const lastPoint = points[points.length - 1];

    return (
      <div style={{ minWidth: 0, display: 'grid', gap: 5 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
          <strong style={{ color: '#334155', fontSize: 13 }}>{metric.name}</strong>
          <span style={{ color: '#0f172a', fontSize: 12, fontWeight: 700 }}>
            {formatValue(total)} {metric.unit}
          </span>
        </div>
        <svg
          role="img"
          aria-label={`${metric.name} өдөр тутмын график`}
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="none"
          style={{ width: '100%', height: 72, overflow: 'visible' }}
        >
          <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="#e2e8f0" />
          {coordinates.length > 1
            ? <polyline points={line} fill="none" stroke="#2563eb" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
            : <circle cx={coordinates[0].x} cy={coordinates[0].y} r="3" fill="#2563eb" />}
        </svg>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
          <small style={{ color: '#64748b', fontSize: 10 }}>{firstPoint.date}</small>
          <small style={{ color: '#64748b', fontSize: 10 }}>{lastPoint.date}</small>
        </div>
      </div>
    );
  }

  const latest = points[points.length - 1];
  const rawUsed = metric.total ?? latest.value;
  if (!Number.isFinite(rawUsed)) return null;
  const used = Math.max(0, rawUsed);
  const limit = metric.limit !== undefined && Number.isFinite(metric.limit) && metric.limit > 0
    ? metric.limit
    : undefined;
  const remaining = limit === undefined ? undefined : Math.max(0, limit - used);
  const percentage = limit === undefined ? undefined : used / limit * 100;
  const progressColor = percentage === undefined || percentage < 50
    ? '#16a34a'
    : percentage <= 80
      ? '#f59e0b'
      : '#ef4444';
  const formatValue = (value: number) => value.toLocaleString('mn-MN', { maximumFractionDigits: 8 });
  const formattedPercentage = percentage === undefined
    ? undefined
    : percentage < 1
      ? `${percentage.toFixed(2)}%`
      : `${percentage.toFixed(0)}%`;

  return (
    <div style={{ minWidth: 0, display: 'grid', gap: 5 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
        <strong style={{ color: '#334155', fontSize: 13 }}>{metric.name}</strong>
        <span style={{ color: '#0f172a', fontSize: 12, fontWeight: 700 }}>
          {formattedPercentage ?? `${formatValue(used)} ${metric.unit}`}
        </span>
      </div>
      {limit !== undefined && remaining !== undefined && percentage !== undefined
        ? <>
          <div
            role="progressbar"
            aria-label={`${metric.name} ашиглалт`}
            aria-valuemin={0}
            aria-valuemax={limit}
            aria-valuenow={Math.min(used, limit)}
            aria-valuetext={`${formatValue(used)} ${metric.unit} ашигласан, ${formatValue(remaining)} ${metric.unit} үлдсэн`}
            style={{ height: 7, overflow: 'hidden', borderRadius: 999, background: '#e2e8f0' }}
          >
            <div style={{ width: `${Math.min(100, percentage)}%`, height: '100%', borderRadius: 999, background: progressColor, transition: 'width .2s ease' }} />
          </div>
          <small style={{ color: '#64748b', fontSize: 11 }}>
            Ашигласан {formatValue(used)} / {formatValue(limit)} {metric.unit} · Үлдсэн {formatValue(remaining)} {metric.unit}
          </small>
        </>
        : <small style={{ color: '#64748b', fontSize: 11 }}>Нийт хязгаар API-аас ирээгүй.</small>}
    </div>
  );
}

function VercelMonthlyUsageCard({
  usage,
  analytics,
  loading,
  analyticsLoading,
  error,
  analyticsError,
  onSaved,
}: {
  usage: VercelMonthlyUsage | null;
  analytics: VercelWebAnalytics | null;
  loading: boolean;
  analyticsLoading: boolean;
  error: string;
  analyticsError: string;
  onSaved: (usage: VercelMonthlyUsage) => void;
}) {
  const [draft, setDraft] = useState<VercelMonthlyUsageDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const startEditing = () => {
    setDraft({
      fast_data_transfer_gb: String(usage?.fast_data_transfer_gb ?? 0),
      fast_origin_transfer_gb: String(usage?.fast_origin_transfer_gb ?? 0),
      cdn_requests: String(usage?.cdn_requests ?? 0),
      isr_reads: String(usage?.isr_reads ?? 0),
    });
    setSaveError('');
  };

  const saveUsage = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!draft) return;
    setSaving(true);
    setSaveError('');
    try {
      const response = await fetchWithAuth(`${backendBaseUrl}/api/teachers/admin/data-usage/vercel-monthly`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fast_data_transfer_gb: Number(draft.fast_data_transfer_gb),
          fast_origin_transfer_gb: Number(draft.fast_origin_transfer_gb),
          cdn_requests: Number(draft.cdn_requests),
          isr_reads: Number(draft.isr_reads),
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.detail ?? 'Vercel сарын хэрэглээг хадгалж чадсангүй.');
      onSaved(result);
      setDraft(null);
    } catch (saveErrorValue) {
      setSaveError(saveErrorValue instanceof Error ? saveErrorValue.message : 'Vercel сарын хэрэглээг хадгалж чадсангүй.');
    } finally {
      setSaving(false);
    }
  };

  const quotaMetrics = usage
    ? [
      { name: 'Fast Data Transfer', unit: 'GB', total: usage.fast_data_transfer_gb, limit: 100 },
      { name: 'Fast Origin Transfer', unit: 'GB', total: usage.fast_origin_transfer_gb, limit: 10 },
      { name: 'CDN Requests', unit: 'хүсэлт', total: usage.cdn_requests, limit: 1_000_000 },
    ]
    : [];

  return (
    <article style={{ padding: 14, border: '1px solid #cbd5e1', borderRadius: 10, background: '#fff', boxShadow: '0 1px 4px rgba(15,23,42,.04)' }}>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
        <div>
          <h3 style={{ margin: 0, color: '#0f172a', fontSize: 16 }}>Vercel сарын хэрэглээ</h3>
          <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: 12 }}>
            {usage ? `${usage.month} · Хадгалсан утгууд автоматаар харагдана.` : 'Энэ сарын Vercel Usage утгууд.'}
          </p>
        </div>
        <button type="button" onClick={draft ? () => setDraft(null) : startEditing} disabled={loading || saving} style={{ border: 0, borderRadius: 7, padding: '7px 10px', background: '#2563eb', color: '#fff', fontWeight: 700, cursor: loading || saving ? 'wait' : 'pointer' }}>
          {draft ? 'Болих' : 'Тоонууд оруулах'}
        </button>
      </header>
      {error && <p role="alert" style={{ margin: '8px 0', color: '#b91c1c', fontSize: 12 }}>{error}</p>}
      {!usage && loading && <p style={{ margin: '12px 0', color: '#64748b', fontSize: 13 }}>Сарын хэрэглээг ачаалж байна...</p>}
      {draft
        ? <form onSubmit={saveUsage} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 10, marginTop: 12 }}>
          {monthlyUsageFields.map((field) => (
            <label key={field.key} style={{ display: 'grid', gap: 4, color: '#334155', fontSize: 12, fontWeight: 600 }}>
              {field.label} ({field.unit})
              <input
                type="number"
                min="0"
                step={field.step}
                required
                value={draft[field.key]}
                onChange={(event) => setDraft({ ...draft, [field.key]: event.target.value })}
                style={{ width: '100%', boxSizing: 'border-box', border: '1px solid #cbd5e1', borderRadius: 6, padding: '8px 9px', color: '#0f172a' }}
              />
            </label>
          ))}
          <p style={{ gridColumn: '1 / -1', margin: 0, color: '#64748b', fontSize: 11 }}>
            ISR Reads нь 8 KB-ийн уншилтын нэгжээр хэмжигддэг бөгөөд Hobby-д тогтсон сарын квотгүй тул хувийн зураас харуулахгүй.
          </p>
          {saveError && <p role="alert" style={{ gridColumn: '1 / -1', margin: 0, color: '#b91c1c', fontSize: 12 }}>{saveError}</p>}
          <button type="submit" disabled={saving} style={{ gridColumn: '1 / -1', justifySelf: 'start', border: 0, borderRadius: 7, padding: '8px 12px', background: saving ? '#94a3b8' : '#15803d', color: '#fff', fontWeight: 700, cursor: saving ? 'wait' : 'pointer' }}>
            {saving ? 'Хадгалж байна...' : 'Хадгалах'}
          </button>
        </form>
        : usage && <div style={{ display: 'grid', gap: 12, marginTop: 12 }}>
          {quotaMetrics.map((metric) => (
            <MetricProgress
              key={metric.name}
              metric={{ ...metric, points: [{ date: usage.month, value: metric.total }] }}
            />
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
            <strong style={{ color: '#334155', fontSize: 13 }}>ISR Reads (8 KB-н нэгж)</strong>
            <span style={{ color: '#0f172a', fontSize: 12, fontWeight: 700 }}>
              {usage.isr_reads.toLocaleString('mn-MN')}
            </span>
          </div>
          <small style={{ color: '#64748b', fontSize: 11 }}>
            Дараагийн календарь сарын эхэнд хэрэглээ автоматаар 0-оос эхэлнэ.
            {usage.updated_at ? ` Сүүлд хадгалсан: ${new Date(usage.updated_at).toLocaleString('mn-MN')}.` : ' Одоогоор утга оруулаагүй.'}
          </small>
          <div style={{ display: 'grid', gap: 8, paddingTop: 10, borderTop: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
              <strong style={{ color: '#334155', fontSize: 13 }}>Vercel Web Analytics · {analytics?.month ?? usage.month}</strong>
              {analytics?.status === 'connected' && <span style={{ color: '#15803d', fontSize: 11, fontWeight: 700 }}>Шууд холбогдсон</span>}
            </div>
            <p style={{ margin: 0, color: '#64748b', fontSize: 11 }}>
              Хуудасны бодит үзэлт ба давтагдаагүй хэрэглэгчийг Vercel API-аас авна. Энэ нь transfer/CDN/ISR usage биш.
            </p>
            {analyticsLoading
              ? <small style={{ color: '#64748b' }}>Analytics мэдээлэл ачаалж байна...</small>
              : analyticsError
                ? <p role="alert" style={{ margin: 0, color: '#b91c1c', fontSize: 12 }}>{analyticsError}</p>
                : analytics?.status === 'connected'
                  ? <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8 }}>
                    <div><small style={{ color: '#64748b' }}>Хуудас үзэлт</small><div style={{ fontWeight: 700 }}>{analytics.pageviews?.toLocaleString('mn-MN')}</div></div>
                    <div><small style={{ color: '#64748b' }}>Давтагдаагүй хэрэглэгч</small><div style={{ fontWeight: 700 }}>{analytics.visitors?.toLocaleString('mn-MN')}</div></div>
                  </div>
                  : <p role={analytics?.status === 'error' ? 'alert' : 'status'} style={{ margin: 0, color: analytics?.status === 'error' ? '#b91c1c' : '#64748b', fontSize: 12 }}>
                    {analytics?.message ?? 'Vercel Web Analytics тохиргоо хүлээгдэж байна.'}
                  </p>}
            {analytics?.updated_at && <small style={{ color: '#64748b', fontSize: 10 }}>API-аас сүүлд авсан: {new Date(analytics.updated_at).toLocaleString('mn-MN')}</small>}
          </div>
        </div>}
    </article>
  );
}

const statusLabels: Record<UsageProvider['status'], string> = {
  connected: 'Холбогдсон',
  not_configured: 'Тохируулаагүй',
  no_data: 'Өгөгдөл олдсонгүй',
  error: 'Холболтын алдаа',
};

const statusColors: Record<UsageProvider['status'], string> = {
  connected: '#15803d',
  not_configured: '#a16207',
  no_data: '#64748b',
  error: '#b91c1c',
};

export default function DataUsagePanel() {
  const [providers, setProviders] = useState<UsageProvider[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [updatedAt, setUpdatedAt] = useState('');
  const [monthlyUsage, setMonthlyUsage] = useState<VercelMonthlyUsage | null>(null);
  const [monthlyLoading, setMonthlyLoading] = useState(false);
  const [monthlyError, setMonthlyError] = useState('');
  const [vercelAnalytics, setVercelAnalytics] = useState<VercelWebAnalytics | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsError, setAnalyticsError] = useState('');

  const loadUsage = async () => {
    setLoading(true);
    setError('');
    setMonthlyLoading(true);
    setMonthlyError('');
    setAnalyticsLoading(true);
    setAnalyticsError('');
    const [providersResult, monthlyResult, analyticsResult] = await Promise.allSettled([
      fetchWithAuth(`${backendBaseUrl}/api/teachers/admin/data-usage`)
        .then(async (response) => {
          const result = await response.json();
          if (!response.ok) throw new Error(result.detail ?? 'Data ашиглалтын мэдээлэл ачаалж чадсангүй.');
          setProviders(result.providers ?? []);
        }),
      fetchWithAuth(`${backendBaseUrl}/api/teachers/admin/data-usage/vercel-monthly`)
        .then(async (response) => {
          const result = await response.json();
          if (!response.ok) throw new Error(result.detail ?? 'Vercel сарын хэрэглээ ачаалж чадсангүй.');
          setMonthlyUsage(result);
        }),
      fetchWithAuth(`${backendBaseUrl}/api/teachers/admin/data-usage/vercel-analytics`)
        .then(async (response) => {
          const result = await response.json();
          if (!response.ok) throw new Error(result.detail ?? 'Vercel Analytics мэдээлэл ачаалж чадсангүй.');
          setVercelAnalytics(result);
        }),
    ]);
    if (providersResult.status === 'rejected') {
      const loadError = providersResult.reason;
      setError(loadError instanceof Error ? loadError.message : 'Data ашиглалтын мэдээлэл ачаалж чадсангүй.');
    }
    if (monthlyResult.status === 'rejected') {
      const loadError = monthlyResult.reason;
      setMonthlyError(loadError instanceof Error ? loadError.message : 'Vercel сарын хэрэглээ ачаалж чадсангүй.');
    }
    if (analyticsResult.status === 'rejected') {
      const loadError = analyticsResult.reason;
      setAnalyticsError(loadError instanceof Error ? loadError.message : 'Vercel Analytics мэдээлэл ачаалж чадсангүй.');
    }
    setUpdatedAt(new Date().toLocaleString('mn-MN'));
    setLoading(false);
    setMonthlyLoading(false);
    setAnalyticsLoading(false);
  };

  useEffect(() => {
    void loadUsage();
  }, []);

  return (
    <section style={{ display: 'grid', gap: 12 }}>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <div>
          <h2 style={{ margin: 0, color: '#0f172a', fontSize: 20 }}>Data ашиглалт</h2>
          <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: 12 }}>API хэмжүүр, өдөр тутмын график болон Vercel сарын квотын явцыг харуулна.</p>
        </div>
        <button type="button" onClick={() => void loadUsage()} disabled={loading} style={{ border: 0, borderRadius: 7, padding: '8px 12px', background: loading ? '#94a3b8' : '#2563eb', color: '#fff', fontWeight: 700, cursor: loading ? 'wait' : 'pointer' }}>
          {loading ? 'Шинэчилж байна...' : 'Шинэчлэх'}
        </button>
      </header>
      {updatedAt && <small style={{ color: '#64748b' }}>Сүүлд шинэчилсэн: {updatedAt}</small>}
      {error && <p role="alert" style={{ margin: 0, color: '#b91c1c' }}>{error}</p>}
      {loading && providers.length === 0 && <p style={{ color: '#64748b' }}>Хэрэглээний мэдээлэл ачаалж байна...</p>}
      <VercelMonthlyUsageCard
        usage={monthlyUsage}
        analytics={vercelAnalytics}
        loading={monthlyLoading}
        analyticsLoading={analyticsLoading}
        error={monthlyError}
        analyticsError={analyticsError}
        onSaved={setMonthlyUsage}
      />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 10 }}>
        {providers.map((provider) => (
          <article key={provider.id} style={{ minWidth: 0, padding: 12, border: '1px solid #e2e8f0', borderRadius: 10, background: '#fff', boxShadow: '0 1px 4px rgba(15,23,42,.04)' }}>
            <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 5 }}>
              <h3 style={{ margin: 0, color: '#0f172a', fontSize: 16 }}>{provider.name}</h3>
              <span style={{ color: statusColors[provider.status], fontSize: 11, fontWeight: 700 }}>{statusLabels[provider.status]}</span>
            </header>
            {provider.message && <p style={{ margin: '5px 0', color: provider.status === 'error' ? '#b91c1c' : '#64748b', fontSize: 12, lineHeight: 1.5 }}>{provider.message}</p>}
            {provider.metrics.length > 0
              ? <div style={{ display: 'grid', gap: 12 }}>{provider.metrics.map((metric) => <MetricProgress key={`${provider.id}-${metric.name}`} metric={metric} />)}</div>
              : !provider.message && <p style={{ margin: '12px 0 0', color: '#64748b', fontSize: 12 }}>Одоогоор харуулах хэмжүүр алга.</p>}
          </article>
        ))}
      </div>
    </section>
  );
}
