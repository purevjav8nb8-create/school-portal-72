'use client';

import { useState } from 'react';
import { Teacher } from '../types';

interface Props {
  teachers: Teacher[];
  activeUnit: string;
  selectedMonth: string;
  setSelectedMonth: (month: string) => void;
  onSelectTeacher: (teacher: Teacher) => void;
  onAttendanceChange: (id: number, status: Teacher['attendance']) => void;
  readOnly?: boolean;
}

export default function AttendanceTable({
  teachers,
  activeUnit,
  selectedMonth,
  setSelectedMonth,
  onSelectTeacher,
  onAttendanceChange,
  readOnly = false,
}: Props) {
  const [selectedTeacher, setSelectedTeacher] = useState<Teacher | null>(null);
  const monthOptions = Array.from({ length: 12 }, (_, offset) => {
    const monthDate = new Date();
    monthDate.setDate(1);
    monthDate.setMonth(monthDate.getMonth() - offset);
    const year = monthDate.getFullYear();
    const month = String(monthDate.getMonth() + 1).padStart(2, '0');
    return { value: `${year}-${month}`, label: `${year} оны ${month}-р сар` };
  });
  const monthRecords = teachers.flatMap((teacher) => (teacher.daily_records ?? []).filter((record) => record.date.startsWith(selectedMonth)));
  const statuses = readOnly ? monthRecords.map((record) => record.status) : teachers.map((teacher) => teacher.attendance);
  const presentCount = statuses.filter(status => status === 'Ирсэн').length;
  const lateCount = statuses.filter(status => status === 'Хоцорсон').length;
  const leaveCount = statuses.filter(status => status === 'Чөлөөтэй').length;
  const sickCount = statuses.filter(status => status === 'Өвчтэй').length;
  const absentCount = statuses.filter(status => status === 'Тасалсан').length;
  const attendanceRate = readOnly
    ? (monthRecords.length > 0 ? Math.round((presentCount / monthRecords.length) * 100) : 0)
    : (teachers.length > 0 ? Math.round((presentCount / teachers.length) * 100) : 0);
  const overtimeHours = teachers.reduce((total, teacher) => total + (teacher.overtime_hours ?? 0), 0);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <h3 style={{ margin: 0, color: '#0f172a' }}>{readOnly ? '📌 Миний ирц' : `📌 ${activeUnit} - Багш нарын ирц ба засах хэсэг`}</h3>
        
        {/* Өмнөх болон Одоогийн саруудыг сонгох dropdown */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <label style={{ fontSize: '13px', fontWeight: 'bold', color: '#475569' }}>Сар сонгох:</label>
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            style={{ padding: '4px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontWeight: 'bold' }}
          >
            {monthOptions.map((month) => (
              <option key={month.value} value={month.value}>{month.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Статистик бар */}
      <div style={{ backgroundColor: '#f8fafc', padding: '9px 12px', borderRadius: '8px', marginBottom: '10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: '1px solid #cbd5e1' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <div>
          <div style={{ fontSize: '13px', color: '#475569' }}>Ирцийн хувь: <b>{attendanceRate}%</b></div>
          <div style={{ width: '200px', height: '10px', backgroundColor: '#e2e8f0', borderRadius: '5px', overflow: 'hidden', marginTop: '4px' }}>
            <div style={{ width: `${attendanceRate}%`, height: '100%', backgroundColor: '#16a34a' }}></div>
          </div>
          </div>
          <div style={{ color: overtimeHours > 0 ? '#dc2626' : '#475569', fontSize: 13, fontWeight: 'bold' }}>
            Илүү цаг: {overtimeHours} цаг
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
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', lineHeight: 1.15 }}>
          <thead>
            <tr style={{ backgroundColor: '#f1f5f9', textAlign: 'left', borderBottom: '2px solid #cbd5e1' }}>
              <th style={{ padding: '5px 8px' }}>Овог Нэр (Дарж өдөр бүрээр харах)</th>
              <th style={{ padding: '5px 8px' }}>Нэгдэл</th>
              <th style={{ padding: '5px 8px' }}>Мэргэжил</th>
              <th style={{ padding: '5px 8px' }}>7 хоногийн цаг</th>
              <th style={{ padding: '5px 8px' }}>Сарын ирц (%)</th>
              <th style={{ padding: '5px 8px' }}>Өнөөдрийн Ирц</th>
            </tr>
          </thead>
          <tbody>
            {teachers.map((t) => (
              <tr key={t.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                {(() => {
                  const records = (t.daily_records ?? []).filter((record) => record.date.startsWith(selectedMonth));
                  const rate = records.length
                    ? Math.round((records.filter((record) => record.status === 'Ирсэн').length / records.length) * 100)
                    : 0;
                  return (
                    <>
                <td
                  onClick={() => {
                    onSelectTeacher(t);
                    if (readOnly) setSelectedTeacher(t);
                  }}
                  style={{ padding: '5px 8px', fontWeight: 'bold', color: '#2563eb', cursor: 'pointer', textDecoration: 'underline' }}
                >
                  👤 {t.last_name} {t.first_name}
                </td>
                <td style={{ padding: '5px 8px' }}>{t.unit}</td>
                <td style={{ padding: '5px 8px' }}>{t.subject}</td>
                <td style={{ padding: '5px 8px' }}>{t.weekly_teaching_hours ?? 0}</td>
                <td style={{ padding: '5px 8px' }}>
                  <span style={{ padding: '3px 6px', borderRadius: '4px', fontSize: '11px', backgroundColor: '#dcfce7', color: '#15803d', fontWeight: 'bold' }}>
                    {rate}%
                  </span>
                </td>
                <td style={{ padding: '5px 8px' }}>
                  {readOnly ? (
                    <span>{t.daily_records?.filter((record) => record.date.startsWith(selectedMonth)).sort((a, b) => a.date.localeCompare(b.date)).at(-1)?.status ?? 'Бүртгэгдээгүй'}</span>
                  ) : (
                    <select
                      value={t.attendance}
                      onChange={(e) => onAttendanceChange(t.id, e.target.value as Teacher['attendance'])}
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
                  )}
                </td>
                    </>
                  );
                })()}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {readOnly && selectedTeacher && (
        <div role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setSelectedTeacher(null)} style={detailOverlay}>
          <section role="dialog" aria-modal="true" aria-label="Сарын ирцийн дэлгэрэнгүй" style={detailDialog}>
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
              <div>
                <h2 style={{ margin: 0 }}>{selectedTeacher.last_name} {selectedTeacher.first_name}</h2>
                <p style={{ margin: '4px 0', color: '#64748b' }}>{selectedTeacher.unit} · {selectedTeacher.subject} · {selectedMonth}</p>
              </div>
              <button type="button" onClick={() => setSelectedTeacher(null)} style={closeButton}>Хаах</button>
            </header>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, margin: '14px 0' }}>
              <div style={statCard}>Ирцийн хувь <b>{Math.round(((selectedTeacher.daily_records ?? []).filter((record) => record.date.startsWith(selectedMonth) && record.status === 'Ирсэн').length / Math.max(1, (selectedTeacher.daily_records ?? []).filter((record) => record.date.startsWith(selectedMonth)).length)) * 100)}%</b></div>
              <div style={statCard}>Бүртгэлтэй өдөр <b>{(selectedTeacher.daily_records ?? []).filter((record) => record.date.startsWith(selectedMonth)).length}</b></div>
              <div style={statCard}>Илүү цаг <b>{selectedTeacher.overtime_hours ?? 0} цаг</b></div>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead><tr><th style={detailCell}>Огноо</th><th style={detailCell}>Төлөв</th></tr></thead>
              <tbody>{(selectedTeacher.daily_records ?? []).filter((record) => record.date.startsWith(selectedMonth)).sort((a, b) => a.date.localeCompare(b.date)).map((record) => (
                <tr key={record.date}><td style={detailCell}>{record.date}</td><td style={detailCell}>{record.status}</td></tr>
              ))}</tbody>
            </table>
          </section>
        </div>
      )}
    </div>
  );
}

const detailOverlay = { position: 'fixed' as const, inset: 0, zIndex: 70, display: 'grid', placeItems: 'center', padding: 16, background: 'rgba(15, 23, 42, .5)' };
const detailDialog = { width: 'min(680px, 100%)', maxHeight: '85vh', overflowY: 'auto' as const, padding: 20, borderRadius: 14, background: '#fff', boxShadow: '0 20px 60px rgba(0,0,0,.25)' };
const closeButton = { border: 0, borderRadius: 6, padding: '7px 10px', cursor: 'pointer' };
const statCard = { display: 'grid', gap: 4, padding: 10, borderRadius: 8, background: '#f1f5f9', color: '#64748b', fontSize: 12 };
const detailCell = { padding: 8, textAlign: 'left' as const, borderBottom: '1px solid #e2e8f0' };