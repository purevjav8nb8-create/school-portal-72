'use client';

interface Props {
  totalTeachers: number;
  bazan: { total: number; active: number };
  buzan: { total: number; active: number };
  nuzan: { total: number; active: number };
  updatedCount: number;
}

export default function SummaryCards({ totalTeachers, bazan, buzan, nuzan, updatedCount }: Props) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 2.2fr 1.2fr', gap: '16px', marginTop: '24px' }}>
      
      <div style={{ backgroundColor: 'white', padding: '16px 20px', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ color: '#64748b', fontSize: '14px', fontWeight: 'bold' }}>Нийт багш нар</span>
        <span style={{ fontSize: '24px', fontWeight: 'bold', color: '#0f172a' }}>{totalTeachers}</span>
      </div>

      <div style={{ backgroundColor: 'white', padding: '16px 20px', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-around', alignItems: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <span style={{ color: '#64748b', fontSize: '12px', display: 'block', fontWeight: 'bold' }}>БАЗАН (Нийт - Идэвхтэй)</span>
          <span style={{ fontSize: '18px', fontWeight: 'bold', color: '#2563eb' }}>{bazan.total} - {bazan.active}</span>
        </div>
        <div style={{ height: '30px', borderLeft: '1px solid #e2e8f0' }}></div>
        <div style={{ textAlign: 'center' }}>
          <span style={{ color: '#64748b', fontSize: '12px', display: 'block', fontWeight: 'bold' }}>БУЗАН (Нийт - Идэвхтэй)</span>
          <span style={{ fontSize: '18px', fontWeight: 'bold', color: '#059669' }}>{buzan.total} - {buzan.active}</span>
        </div>
        <div style={{ height: '30px', borderLeft: '1px solid #e2e8f0' }}></div>
        <div style={{ textAlign: 'center' }}>
          <span style={{ color: '#64748b', fontSize: '12px', display: 'block', fontWeight: 'bold' }}>НУЗАН (Нийт - Идэвхтэй)</span>
          <span style={{ fontSize: '18px', fontWeight: 'bold', color: '#d97706' }}>{nuzan.total} - {nuzan.active}</span>
        </div>
      </div>

      <div style={{ backgroundColor: 'white', padding: '16px 20px', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <span style={{ color: '#64748b', fontSize: '13px', display: 'block', fontWeight: 'bold' }}>Өнөөдөр мэдээлэл</span>
          <span style={{ color: '#64748b', fontSize: '12px', display: 'block' }}>оруулсан багш нар</span>
        </div>
        <span style={{ fontSize: '24px', fontWeight: 'bold', color: '#16a34a' }}>{updatedCount}</span>
      </div>

    </div>
  );
}