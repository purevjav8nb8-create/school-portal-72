'use client';

import { Download, Eye, X } from 'lucide-react';
import type { SchedulePreviewLesson } from './schoolScheduleApi';

const weekdays = ['Даваа', 'Мягмар', 'Лхагва', 'Пүрэв', 'Баасан'];
const weekdayColors = ['#e8eef8', '#e8f4ee', '#f5eddf', '#f3e8f4', '#fdebea'];

interface Props {
  open: boolean;
  termName: string;
  lessons: SchedulePreviewLesson[];
  onDownload: () => void;
  downloading?: boolean;
  onClose: () => void;
}

export default function SchedulePreviewModal({ open, termName, lessons, onDownload, downloading = false, onClose }: Props) {
  if (!open) return null;

  const grouped = new Map<string, { subject: string; teacherName: string; lessons: SchedulePreviewLesson[] }>();
  for (const lesson of lessons) {
    const teacherName = lesson.teacher_name || lesson.teacher_email;
    const key = `${lesson.subject}\u0000${teacherName}`;
    const current = grouped.get(key);
    if (current) current.lessons.push(lesson);
    else grouped.set(key, { subject: lesson.subject, teacherName, lessons: [lesson] });
  }
  const rows = [...grouped.values()].sort((left, right) =>
    left.subject.localeCompare(right.subject)
    || left.teacherName.localeCompare(right.teacherName)
  );
  const slotWidths = weekdays.map((weekday) =>
    Array.from({ length: 14 }, (_, periodIndex) => {
      const internalLessonNumber = periodIndex < 7
        ? periodIndex + 1
        : periodIndex + 1;
      const values = rows
        .flatMap((row) => row.lessons.filter((lesson) =>
          lesson.weekday === weekdays.indexOf(weekday) + 1
          && lesson.lesson_number === internalLessonNumber
        ))
        .map((lesson) => `${lesson.grade}${lesson.section}`)
        .filter((value, index, values) => values.indexOf(value) === index);
      return Math.max(
        34,
        String(periodIndex + 1).length * 7,
        ...values.map((value) => value.length * 9),
      );
    })
  );
  const totalSlotWidth = slotWidths.flat().reduce((total, width) => total + width, 0);

  return (
    <div
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 80,
        display: 'grid',
        placeItems: 'center',
        padding: 18,
        background: 'rgba(15,23,42,.48)',
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label={`${termName} хуваарийг харах`}
        style={{
          width: 'min(980px, 96vw)',
          maxHeight: '82vh',
          display: 'grid',
          gridTemplateRows: 'auto 1fr',
          borderRadius: 14,
          background: '#fff',
          boxShadow: '0 24px 70px rgba(15,23,42,.32)',
          overflow: 'hidden',
        }}
      >
        <header style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          padding: '14px 16px',
          borderBottom: '1px solid #e2e8f0',
        }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 16 }}>{termName} хуваарь</h3>
            <small style={{ color: '#64748b' }}>{lessons.length} хичээлийн цаг</small>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              type="button"
              onClick={onDownload}
              disabled={downloading}
              aria-label="Хуваарийг матриц загвараар татах"
              title="Хуваарийг матриц загвараар татах"
              style={{
                minHeight: 34,
                padding: '7px 10px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                border: '1px solid #bfdbfe',
                borderRadius: 8,
                background: '#eff6ff',
                color: '#1d4ed8',
                cursor: downloading ? 'wait' : 'pointer',
                fontWeight: 700,
                fontSize: 12,
              }}
            >
              <Download size={16} aria-hidden="true" />
              {downloading ? 'Татаж байна...' : 'Хуваарийг татах'}
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Хаах"
              title="Хаах"
              style={{
                width: 34,
                height: 34,
                display: 'grid',
                placeItems: 'center',
                border: '1px solid #dbe3ee',
                borderRadius: 8,
                background: '#fff',
                color: '#334155',
                cursor: 'pointer',
              }}
            >
              <X size={17} aria-hidden="true" />
            </button>
          </div>
        </header>
        <div style={{ overflow: 'auto', padding: 12 }}>
          {rows.length === 0 ? (
            <p style={{ margin: 0, color: '#64748b' }}>Хуваарийн мөр олдсонгүй.</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 366 + totalSlotWidth, tableLayout: 'fixed' }}>
              <thead>
                <tr>
                  <th rowSpan={3} style={{ ...cellStyle, width: 36 }}>№</th>
                  <th rowSpan={3} style={{ ...cellStyle, width: 150 }}>Мэргэжил</th>
                  <th rowSpan={3} style={{ ...cellStyle, width: 180 }}>Багш нарын нэр</th>
                  {weekdays.map((weekday, weekdayIndex) => (
                    <th key={weekday} colSpan={14} style={{ ...cellStyle, textAlign: 'center', borderLeft: '1px solid #cbd5e1', background: weekdayColors[weekdayIndex] }}>{weekday}</th>
                  ))}
                </tr>
                <tr>
                  {weekdays.flatMap((weekday, weekdayIndex) => [
                    <th key={`${weekday}-first`} colSpan={7} style={{ ...cellStyle, textAlign: 'center', borderLeft: '1px solid #cbd5e1', background: weekdayColors[weekdayIndex] }}>I ээлж</th>,
                    <th key={`${weekday}-second`} colSpan={7} style={{ ...cellStyle, textAlign: 'center', borderLeft: '1px solid #cbd5e1', background: weekdayColors[weekdayIndex] }}>II ээлж</th>,
                  ])}
                </tr>
                <tr>
                  {weekdays.flatMap((weekday) =>
                    Array.from({ length: 14 }, (_, periodIndex) => (
                      <th key={`${weekday}-${periodIndex + 1}`} style={{ ...cellStyle, width: slotWidths[weekdays.indexOf(weekday)][periodIndex], textAlign: 'center', borderLeft: '1px solid #e2e8f0', background: weekdayColors[weekdays.indexOf(weekday)] }}>
                        {(periodIndex % 7) + 1}
                      </th>
                    ))
                  )}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={`${row.subject}-${row.teacherName}-${index}`} style={{ borderTop: '1px solid #e2e8f0' }}>
                    <td style={cellStyle}>{index + 1}</td>
                    <td style={cellStyle}>{row.subject}</td>
                    <td style={cellStyle}>{row.teacherName}</td>
                    {weekdays.flatMap((_, weekdayIndex) =>
                      Array.from({ length: 14 }, (_, periodIndex) => {
                        const matching = row.lessons.filter((item) =>
                          item.weekday === weekdayIndex + 1
                          && item.lesson_number === (
                            periodIndex < 7
                              ? periodIndex + 1
                              : periodIndex + 1
                          )
                        );
                        const values = [...new Set(
                          matching.map((item) => item.section ? `${item.grade}${item.section}` : ''),
                        )].filter(Boolean);
                        const value = values.join(' ');
                        return (
                          <td
                            key={`${weekdayIndex}-${periodIndex}`}
                            style={{ ...cellStyle, width: slotWidths[weekdayIndex][periodIndex], textAlign: 'center', borderLeft: '1px solid #e2e8f0', background: value ? weekdayColors[weekdayIndex] : '#fff' }}
                          >
                            {value}
                          </td>
                        );
                      })
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}

export function SchedulePreviewIcon() {
  return <Eye size={17} aria-hidden="true" />;
}

const cellStyle = {
  padding: '8px 9px',
  textAlign: 'left' as const,
  fontSize: 12,
  whiteSpace: 'nowrap' as const,
};
