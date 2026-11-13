'use client';

import { useEffect, useState } from 'react';
import { backendBaseUrl, fetchWithAuth } from '../../../lib/backendApi';

type UsagePoint = { date: string; value: number };
type UsageMetric = { name: string; unit: string; points: UsagePoint[]; limit?: number; total?: number };
type UsageProvider = {
  id: string;
  name: string;
  status: 'connected' | 'not_configured' | 'no_data' | 'error';
  metrics: UsageMetric[];
  message: string | null;
};

function MetricProgress({ metric }: { metric: UsageMetric }) {
  const points = metric.points.filter((point) => Number.isFinite(point.value));
  if (!points.length) return null;

  const latest = points[points.length - 1];
  const rawUsed = metric.total ?? latest.value;
  if (!Number.isFinite(rawUsed)) return null;
  const used = Math.max(0, rawUsed);
  const limit = metric.limit !== undefined && Number.isFinite(metric.limit) && metric.limit > 0
    ? metric.limit
    : undefined;
  const remaining = limit === undefined ? undefined : Math.max(0, limit - used);
  const percentage = limit === undefined ? undefined : used / limit * 100;
  const formatValue = (value: number) => value.toLocaleString('mn-MN', { maximumFractionDigits: 2 });

  return (
    <div style={{ minWidth: 0, display: 'grid', gap: 5 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
        <strong style={{ color: '#334155', fontSize: 13 }}>{metric.name}</strong>
        <span style={{ color: '#0f172a', fontSize: 12, fontWeight: 700 }}>
          {percentage === undefined ? `${formatValue(used)} ${metric.unit}` : `${percentage.toFixed(0)}%`}
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
            <div style={{ width: `${Math.min(100, percentage)}%`, height: '100%', borderRadius: 999, background: '#16a34a', transition: 'width .2s ease' }} />
          </div>
          <small style={{ color: '#64748b', fontSize: 11 }}>
            Ашигласан {formatValue(used)} / {formatValue(limit)} {metric.unit} · Үлдсэн {formatValue(remaining)} {metric.unit}
          </small>
        </>
        : <small style={{ color: '#64748b', fontSize: 11 }}>Нийт хязгаар API-аас ирээгүй.</small>}
    </div>
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

  const loadUsage = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetchWithAuth(`${backendBaseUrl}/api/teachers/admin/data-usage`);
      const result = await response.json();
      if (!response.ok) throw new Error(result.detail ?? 'Data ашиглалтын мэдээлэл ачаалж чадсангүй.');
      setProviders(result.providers ?? []);
      setUpdatedAt(new Date().toLocaleString('mn-MN'));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Data ашиглалтын мэдээлэл ачаалж чадсангүй.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadUsage();
  }, []);

  return (
    <section style={{ display: 'grid', gap: 12 }}>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <div>
          <h2 style={{ margin: 0, color: '#0f172a', fontSize: 20 }}>Data ашиглалт</h2>
          <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: 12 }}>Боломжтой хязгаарыг ашигласан болон үлдсэн хэмжээгээр progress bar-аар харуулна.</p>
        </div>
        <button type="button" onClick={() => void loadUsage()} disabled={loading} style={{ border: 0, borderRadius: 7, padding: '8px 12px', background: loading ? '#94a3b8' : '#2563eb', color: '#fff', fontWeight: 700, cursor: loading ? 'wait' : 'pointer' }}>
          {loading ? 'Шинэчилж байна...' : 'Шинэчлэх'}
        </button>
      </header>
      {updatedAt && <small style={{ color: '#64748b' }}>Сүүлд шинэчилсэн: {updatedAt}</small>}
      {error && <p role="alert" style={{ margin: 0, color: '#b91c1c' }}>{error}</p>}
      {loading && providers.length === 0 && <p style={{ color: '#64748b' }}>Хэрэглээний мэдээлэл ачаалж байна...</p>}
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
