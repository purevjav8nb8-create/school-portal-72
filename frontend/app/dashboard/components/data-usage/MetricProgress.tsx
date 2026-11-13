import { UsageMetric } from './types';

export default function MetricProgress({ metric }: { metric: UsageMetric }) {
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
          <small style={{ color: '#64748b', fontSize: 10 }}>{points[0].date}</small>
          <small style={{ color: '#64748b', fontSize: 10 }}>{points[points.length - 1].date}</small>
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
