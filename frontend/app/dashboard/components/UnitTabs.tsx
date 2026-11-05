'use client';

interface Props {
  activeUnit: string;
  setActiveUnit: (unit: 'НИЙТ' | 'БАЗАН' | 'БУЗАН' | 'НУЗАН') => void;
  onDownload: (type: 'excel' | 'pdf') => void;
  isAdmin: boolean;
}

export default function UnitTabs({ activeUnit, setActiveUnit, onDownload, isAdmin }: Props) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px' }}>
      <div style={{ display: 'flex', gap: '24px' }}>
        {(['НИЙТ', 'БАЗАН', 'БУЗАН', 'НУЗАН'] as const).map((unit) => (
          <button
            key={unit}
            onClick={() => setActiveUnit(unit)}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '18px',
              fontWeight: 'bold',
              cursor: 'pointer',
              color: activeUnit === unit ? '#000000' : '#94a3b8',
              borderBottom: activeUnit === unit ? '3px solid #000000' : 'none',
              paddingBottom: '8px'
            }}
          >
            {unit}
          </button>
        ))}
      </div>

      {isAdmin && (
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={() => onDownload('excel')} style={{ backgroundColor: '#107c41', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>
            📊 Excel Тайлан Татах
          </button>
          <button onClick={() => onDownload('pdf')} style={{ backgroundColor: '#dc2626', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>
            📄 PDF Тайлан Татах
          </button>
        </div>
      )}
    </div>
  );
}