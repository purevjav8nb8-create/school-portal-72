'use client';

import { Teacher } from '../types';

interface Props {
  teachers: Teacher[];
  activeUnit: string;
  selectedMonth: string;
  setSelectedMonth: (month: string) => void;
  onSelectTeacher: (teacher: Teacher) => void;
  onAttendanceChange: (id: number, status: Teacher['attendance']) => void;
}

export default function AttendanceTable({
  teachers,
  activeUnit,
  selectedMonth,
  setSelectedMonth,
  onSelectTeacher,
  onAttendanceChange
}: Props) {
  const presentCount = teachers.filter(t => t.attendance === 'Ирсэн').length;
  const lateCount = teachers.filter(t => t.attendance === 'Хоцорсон').length;
  const leaveCount = teachers.filter(t => t.attendance === 'Чөлөөтэй').length;
  const sickCount = teachers.filter(t => t.attendance === 'Өвчтэй').length;
  const absentCount = teachers.filter(t => t.attendance === 'Тасалсан').length;
  const attendanceRate = teachers.length > 0 ? Math.round((presentCount / teachers.length) * 100) : 0;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h3 style={{ margin: 0, color: '#0f172a' }}>📌 {activeUnit} - Багш нарын ирц ба засах хэсэг</h3>
        
        {/* Өмнөх болон Одоогийн саруудыг сонгох dropdown */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <label style={{ fontSize: '13px', fontWeight: 'bold', color: '#475569' }}>Сар сонгох:</label>
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontWeight: 'bold' }}
          >
            <option value="2026-03">2026 оны 03-р сар</option>
            <option value="2026-02">2026 оны 02-р сар</option>
            <option value="2026-01">2026 оны 01-р сар</option>
            <option value="2025-12">2025 оны 12-р сар</option>
          </select>
        </div>
      </div>

      {/* Статистик бар */}
      <div style={{ backgroundColor: '#f8fafc', padding: '14px', borderRadius: '8px', marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: '1px solid #cbd5e1' }}>
        <div>
          <div style={{ fontSize: '13px', color: '#475569' }}>Ирцийн хувь: <b>{attendanceRate}%</b></div>
          <div style={{ width: '200px', height: '10px', backgroundColor: '#e2e8f0', borderRadius: '5px', overflow: 'hidden', marginTop: '4px' }}>
            <div style={{ width: `${attendanceRate}%`, height: '100%', backgroundColor: '#16a34a' }}></div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '10px', fontSize: '12px' }}>
          <span style={{ color: '#16a34a' }}>🟢 Ирсэн: <b>{presentCount}</b></span>
          <span style={{ color: '#eab308' }}>🟡 Хоцорсон: <b>{lateCount}</b></span>
          <span style={{ color: '#2563eb' }}>🔵 Чөлөөтэй: <b>{leaveCount}</b></span>
          <span style={{ color: '#8b5cf6' }}>🟣 Өвчтэй: <b>{sickCount}</b></span>
          <span style={{ color: '#dc2626' }}>🔴 Тасалсан: <b>{absentCount}</b></span>
        </div>
      </div>

      {/* Хүснэгт */}
      <div style={{ maxHeight: '280px', overflowY: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr style={{ backgroundColor: '#f1f5f9', textAlign: 'left', borderBottom: '2px solid #cbd5e1' }}>
              <th style={{ padding: '8px' }}>Овог Нэр (Дарж өдөр бүрээр харах)</th>
              <th style={{ padding: '8px' }}>Нэгдэл</th>
              <th style={{ padding: '8px' }}>Мэргэжил</th>
              <th style={{ padding: '8px' }}>Сарын ирц (%)</th>
              <th style={{ padding: '8px' }}>Өнөөдрийн Ирц</th>
            </tr>
          </thead>
          <tbody>
            {teachers.map((t) => (
              <tr key={t.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                <td
                  onClick={() => onSelectTeacher(t)}
                  style={{ padding: '8px', fontWeight: 'bold', color: '#2563eb', cursor: 'pointer', textDecoration: 'underline' }}
                >
                  👤 {t.last_name} {t.first_name}
                </td>
                <td style={{ padding: '8px' }}>{t.unit}</td>
                <td style={{ padding: '8px' }}>{t.subject}</td>
                <td style={{ padding: '8px' }}>
                  <span style={{ padding: '3px 6px', borderRadius: '4px', fontSize: '11px', backgroundColor: '#dcfce7', color: '#15803d', fontWeight: 'bold' }}>
                    {t.monthly_attendance_rate}%
                  </span>
                </td>
                <td style={{ padding: '8px' }}>
                  <select
                    value={t.attendance}
                    onChange={(e) => onAttendanceChange(t.id, e.target.value as any)}
                    style={{
                      padding: '4px 8px',
                      borderRadius: '6px',
                      border: '1px solid #cbd5e1',
                      fontWeight: 'bold',
                      fontSize: '12px'
                    }}
                  >
                    <option value="Ирсэн">🟢 Ирсэн</option>
                    <option value="Хоцорсон">🟡 Хоцорсон</option>
                    <option value="Чөлөөтэй">🔵 Чөлөөтэй</option>
                    <option value="Өвчтэй">🟣 Өвчтэй</option>
                    <option value="Тасалсан">🔴 Тасалсан</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}