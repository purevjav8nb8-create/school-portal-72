'use client';

import { useState } from 'react';
import { backendBaseUrl, fetchWithAuth } from '../../../../lib/backendApi';
import MetricProgress from './MetricProgress';
import { VercelMonthlyUsage, VercelMonthlyUsageDraft, VercelWebAnalytics } from './types';

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

interface Props {
  usage: VercelMonthlyUsage | null;
  analytics: VercelWebAnalytics | null;
  loading: boolean;
  analyticsLoading: boolean;
  error: string;
  analyticsError: string;
  onSaved: (usage: VercelMonthlyUsage) => void;
}

export default function VercelMonthlyUsageCard({
  usage,
  analytics,
  loading,
  analyticsLoading,
  error,
  analyticsError,
  onSaved,
}: Props) {
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
            <MetricProgress key={metric.name} metric={{ ...metric, points: [{ date: usage.month, value: metric.total }] }} />
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
            <strong style={{ color: '#334155', fontSize: 13 }}>ISR Reads (8 KB-н нэгж)</strong>
            <span style={{ color: '#0f172a', fontSize: 12, fontWeight: 700 }}>{usage.isr_reads.toLocaleString('mn-MN')}</span>
          </div>
          <small style={{ color: '#64748b', fontSize: 11 }}>
            Дараагийн календарь сарын эхэнд хэрэглээ автоматаар 0-оос эхэлнэ.
            {usage.updated_at ? ` Сүүлд хадгалсан: ${new Date(usage.updated_at).toLocaleString('mn-MN')}.` : ' Одоогоор утга оруулаагүй.'}
          </small>
          <AnalyticsSummary analytics={analytics} loading={analyticsLoading} error={analyticsError} month={usage.month} />
        </div>}
    </article>
  );
}

function AnalyticsSummary({
  analytics,
  loading,
  error,
  month,
}: {
  analytics: VercelWebAnalytics | null;
  loading: boolean;
  error: string;
  month: string;
}) {
  return (
    <div style={{ display: 'grid', gap: 8, paddingTop: 10, borderTop: '1px solid #e2e8f0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
        <strong style={{ color: '#334155', fontSize: 13 }}>Vercel Web Analytics · {analytics?.month ?? month}</strong>
        {analytics?.status === 'connected' && <span style={{ color: '#15803d', fontSize: 11, fontWeight: 700 }}>Шууд холбогдсон</span>}
      </div>
      <p style={{ margin: 0, color: '#64748b', fontSize: 11 }}>
        Хуудасны бодит үзэлт ба давтагдаагүй хэрэглэгчийг Vercel API-аас авна. Энэ нь transfer/CDN/ISR usage биш.
      </p>
      {loading
        ? <small style={{ color: '#64748b' }}>Analytics мэдээлэл ачаалж байна...</small>
        : error
          ? <p role="alert" style={{ margin: 0, color: '#b91c1c', fontSize: 12 }}>{error}</p>
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
  );
}
