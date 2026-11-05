'use client';

export interface TrainingItem {
  id: number;
  name: string;
  startDate: string;
  endDate: string;
  pdfFileName: string;
  pdfUrl?: string;
  imagePreview?: string;
  createdAt: string;
}

interface Props {
  trainings: TrainingItem[];
  onSelectTraining: (item: TrainingItem) => void;
  onDeleteTraining: (e: React.MouseEvent, id: number) => void;
}

export default function TrainingList({ trainings, onSelectTraining, onDeleteTraining }: Props) {
  return (
    <div>
      <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', color: '#334155' }}>
        📋 Бүртгэгдсэн сургалтууд (Дарж дэлгэрэнгүй харах)
      </h4>
      <div style={{ maxHeight: '240px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
        {trainings.length === 0 ? (
          <div style={{ padding: '16px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>
            Сургалт бүртгэгдээгүй байна.
          </div>
        ) : (
          trainings.map(t => (
            <div 
              key={t.id} 
              onClick={() => onSelectTraining(t)}
              style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center', 
                padding: '12px 14px', 
                borderBottom: '1px solid #f1f5f9',
                cursor: 'pointer',
                transition: 'background-color 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                {t.imagePreview ? (
                  <img src={t.imagePreview} alt="Preview" style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: '6px' }} />
                ) : (
                  <div style={{ width: '40px', height: '40px', backgroundColor: '#e2e8f0', borderRadius: '6px', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '18px' }}>
                    📖
                  </div>
                )}
                <div>
                  <span style={{ fontWeight: 'bold', fontSize: '14px', color: '#2563eb', textDecoration: 'underline', display: 'block' }}>
                    {t.name}
                  </span>
                  <small style={{ color: '#64748b', fontSize: '12px' }}>
                    📅 {t.startDate} ~ {t.endDate}
                  </small>
                </div>
              </div>
              
              <button 
                onClick={(e) => onDeleteTraining(e, t.id)}
                style={{ border: 'none', background: '#fee2e2', color: '#ef4444', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}
              >
                Устгах
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}