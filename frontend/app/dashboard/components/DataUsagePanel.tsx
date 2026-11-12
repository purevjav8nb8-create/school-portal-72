'use client';

import { useEffect, useState } from 'react';
import { backendBaseUrl, fetchWithAuth } from '../../../lib/backendApi';

type UsagePoint = { date: string; value: number };
type UsageMetric = { name: string; unit: string; points: UsagePoint[] };
type UsageProvider = {
  id: string;
  name: string;
  status: 'connected' | 'not_configured' | 'no_data' | 'error';
  metrics: UsageMetric[];
  message: string | null;
};

function MetricLineChart({ metric }: { metric: UsageMetric }) {
  const points = metric.points.filter((point) => Number.isFinite(point.value));
  if (!points.length) return null;

  const width = 560;
  const height = 150;
  const left = 38;
  const right = 12;
  const top = 12;
  const bottom = 25;
  const values = points.map((point) => point.value);
  const minValue = Math.min(0, ...values);
  const maxValue = Math.max(1, ...values);
  const range = maxValue - minValue || 1;
  const coordinates = points.map((point, index) => {
    const x = left + (points.length === 1 ? 0 : (index / (points.length - 1)) * (width - left - right));
    const y = top + ((maxValue - point.value) / range) * (height - top - bottom);
    return { x, y };
  });
  const latest = points[points.length - 1];
  const dateLabel = (value: string) => {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('mn-MN', { month: '2-digit', day: '2-digit' });
  };

  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 2 }}>
        <strong style={{ color: '#334155', fontSize: 13 }}>{metric.name}</strong>
        <span style={{ color: '#0f172a', fontSize: 12, fontWeight: 700 }}>
          {latest.value.toLocaleString('mn-MN', { maximumFractionDigits: 2 })} {metric.unit}
        </span>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${metric.name}: ${points.length} цэгийн хэрэглээний график`} style={{ display: 'block', width: '100%', height: 150 }}>
        {[0, 0.5, 1].map((fraction) => {
          const y = top + fraction * (height - top - bottom);
          return <line key={fraction} x1={left} x2={width - right} y1={y} y2={y} stroke="#e2e8f0" strokeDasharray="3 4" />;
        })}
        <polyline
          fill="none"
          stroke="#2563eb"
          strokeWidth="2.5"
          strokeLinejoin="round"
          strokeLinecap="round"
          points={coordinates.map(({ x, y }) => `${x},${y}`).join(' ')}
        />
        {coordinates.map(({ x, y }, index) => <circle key={`${points[index].date}-${index}`} cx={x} cy={y} r={3.5} fill="#2563eb" />)}
        <text x={left} y={height - 5} fill="#64748b" fontSize="10" textAnchor="start">{dateLabel(points[0].date)}</text>
        <text x={width - right} y={height - 5} fill="#64748b" fontSize="10" textAnchor="end">{dateLabel(latest.date)}</text>
      </svg>
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
          <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: 12 }}>Үйлчилгээ бүрийн хэмжүүр тусдаа нэгжээр харагдана. График нь сүүлийн 7 хоногийн өгөгдөл.</p>
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
              ? <div style={{ display: 'grid', gap: 8 }}>{provider.metrics.map((metric) => <MetricLineChart key={`${provider.id}-${metric.name}`} metric={metric} />)}</div>
              : !provider.message && <p style={{ margin: '12px 0 0', color: '#64748b', fontSize: 12 }}>Одоогоор харуулах хэмжүүр алга.</p>}
          </article>
        ))}
      </div>
    </section>
  );
}
