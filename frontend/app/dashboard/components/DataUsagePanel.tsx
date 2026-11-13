'use client';

import { useEffect, useState } from 'react';
import { backendBaseUrl, fetchWithAuth } from '../../../lib/backendApi';
import MetricProgress from './data-usage/MetricProgress';
import VercelMonthlyUsageCard from './data-usage/VercelMonthlyUsageCard';
import { UsageProvider, VercelMonthlyUsage, VercelWebAnalytics } from './data-usage/types';

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
    const results = await Promise.allSettled([
      fetchWithAuth(`${backendBaseUrl}/api/teachers/admin/data-usage`).then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.detail ?? 'Data ашиглалтын мэдээлэл ачаалж чадсангүй.');
        setProviders(result.providers ?? []);
      }),
      fetchWithAuth(`${backendBaseUrl}/api/teachers/admin/data-usage/vercel-monthly`).then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.detail ?? 'Vercel сарын хэрэглээ ачаалж чадсангүй.');
        setMonthlyUsage(result);
      }),
      fetchWithAuth(`${backendBaseUrl}/api/teachers/admin/data-usage/vercel-analytics`).then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.detail ?? 'Vercel Analytics мэдээлэл ачаалж чадсангүй.');
        setVercelAnalytics(result);
      }),
    ]);

    const errorMessage = (reason: unknown, fallback: string) =>
      reason instanceof Error ? reason.message : fallback;
    if (results[0].status === 'rejected') setError(errorMessage(results[0].reason, 'Data ашиглалтын мэдээлэл ачаалж чадсангүй.'));
    if (results[1].status === 'rejected') setMonthlyError(errorMessage(results[1].reason, 'Vercel сарын хэрэглээ ачаалж чадсангүй.'));
    if (results[2].status === 'rejected') setAnalyticsError(errorMessage(results[2].reason, 'Vercel Analytics мэдээлэл ачаалж чадсангүй.'));
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
            <header style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 5 }}>
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
