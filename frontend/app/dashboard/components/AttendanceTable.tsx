'use client';

import { useState } from 'react';
import { Teacher } from '../types';
import AttendanceSummaryBar from './AttendanceSummaryBar';
import TeacherAttendanceDialog from './TeacherAttendanceDialog';

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

  return (
    <div>
      <AttendanceSummaryBar
        activeUnit={activeUnit}
        selectedMonth={selectedMonth}
        setSelectedMonth={setSelectedMonth}
        readOnly={readOnly}
        attendanceRate={attendanceRate}
        counts={{ present: presentCount, late: lateCount, leave: leaveCount, sick: sickCount, absent: absentCount }}
      />

      {/* Хүснэгт */}
      <div style={{ maxHeight: '280px', overflowY: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', lineHeight: 1.15 }}>
          <thead>
            <tr style={{ backgroundColor: '#f1f5f9', textAlign: 'left', borderBottom: '2px solid #cbd5e1' }}>
              <th style={{ padding: '5px 8px' }}>Овог Нэр (Дарж өдөр бүрээр харах)</th>
              <th style={{ padding: '5px 8px' }}>Нэгдэл</th>
              <th style={{ padding: '5px 8px' }}>Мэргэжил</th>
              <th style={{ padding: '5px 8px' }}>7 хоногийн цаг</th>
              <th style={{ padding: '5px 8px' }}>Илүү цаг</th>
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
                <td style={{ padding: '5px 8px', color: '#0f172a', fontWeight: 'bold' }}>
                  {t.overtime_hours ?? Math.max(0, (t.weekly_teaching_hours ?? 0) - 19)}
                </td>
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
      {readOnly && selectedTeacher && <TeacherAttendanceDialog
        teacher={selectedTeacher}
        month={selectedMonth}
        onClose={() => setSelectedTeacher(null)}
      />}
    </div>
  );
}
