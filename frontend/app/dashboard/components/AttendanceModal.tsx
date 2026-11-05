'use client';

import { Teacher } from '../types';

interface Props {
  teacher: Teacher | null;
  selectedMonth: string;
  onClose: () => void;
}

export default function AttendanceModal({ teacher, selectedMonth, onClose }: Props) {
  if (!teacher) return null;

  // Өдрүүдийн жишээ ирцийн дата бэлтгэх (1-31 өдөр)
  const daysInMonth = Array.from({ length: 31 }, (_, i) => i + 1);

  const getStatusColor = (day: number) => {
    if (day % 7 === 0 || day % 7 === 6) return { bg: '#f1f5f9', color: '#94a3b8', label: 'Амралт' };
    if (day % 5 === 0) return { bg: '#fef9c3', color: '#854d0e', label: '🟡 Хоцорсон' };
    if (day % 11 === 0) return { bg: '#f3e8ff', color: '#6b21a8', label: '🟣 Өвчтэй' };
    if (day % 13 === 0) return { bg: '#dbeafe', color: '#1e40af', label: '🔵 Чөлөөтэй' };
    if (day % 17 === 0) return { bg: '#fee2e2', color: '#991b1b', label: '🔴 Тасалсан' };
    return { bg: '#dcfce7', color: '#166534', label: '🟢 Ирсэн' };
  };

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
      <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '12px', width: '650px', maxHeight: '80vh', overflowY: 'auto', boxShadow: '0 10px 25px rgba(0,0,0,0.2)' }}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px' }}>
          <div>
            <h3 style={{ margin: 0, color: '#0f172a' }}>📅 {teacher.last_name} {teacher.first_name} - Сарын ирц</h3>
            <p style={{ margin: '4px 0 0 0', color: '#64748b', fontSize: '13px' }}>Сонгосон сар: <b>{selectedMonth}</b> | Мэргэжил: {teacher.subject}</p>
          </div>
          <button onClick={onClose} style={{ border: 'none', background: '#f1f5f9', padding: '8px 14px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>✕ Хаах</button>
        </div>

        {/* 1-31 өдрийн сүлжээ харагдац (Calendar Grid) */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '8px', marginBottom: '20px' }}>
          {daysInMonth.map((day) => {
            const statusInfo = getStatusColor(day);
            return (
              <div key={day} style={{ backgroundColor: statusInfo.bg, color: statusInfo.color, padding: '8px 4px', borderRadius: '6px', textAlign: 'center', border: '1px solid #cbd5e1' }}>
                <div style={{ fontSize: '12px', fontWeight: 'bold' }}>{day}-ний өдөр</div>
                <div style={{ fontSize: '11px', marginTop: '2px' }}>{statusInfo.label}</div>
              </div>
            );
          })}
        </div>

        <div style={{ backgroundColor: '#f8fafc', padding: '12px', borderRadius: '6px', fontSize: '12px', display: 'flex', justifyContent: 'space-between' }}>
          <span>🟢 Ирсэн: <b>20 өдөр</b></span>
          <span>🟡 Хоцорсон: <b>2 өдөр</b></span>
          <span>🔵 Чөлөөтэй: <b>1 өдөр</b></span>
          <span>🟣 Өвчтэй: <b>1 өдөр</b></span>
          <span>🔴 Тасалсан: <b>0 өдөр</b></span>
        </div>

      </div>
    </div>
  );
}