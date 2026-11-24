'use client';

import { useMemo } from 'react';
import { schoolToday } from '../../../lib/schoolDate';
import type { TeachingScheduleAssignment } from '../types';

const weekdays = ['Даваа', 'Мягмар', 'Лхагва', 'Пүрэв', 'Баасан'];

function utcDay(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return Date.UTC(year, month - 1, day);
}

function activeWeekType(today: string, yearStart: string) {
  const weekNumber = Math.floor((utcDay(today) - utcDay(yearStart)) / 604_800_000) + 1;
  return weekNumber % 2 ? 'odd' : 'even';
}

export default function TeachingSchedulePanel({
  teachingSchedule,
}: {
  teachingSchedule: TeachingScheduleAssignment[];
}) {
  const today = schoolToday();
  const todayDate = new Date(`${today}T12:00:00+08:00`);
  const weekday = todayDate.getUTCDay();
  const weekType = useMemo(() => {
    const activeYear = teachingSchedule.find(
      (item) => item.start_date <= today && today <= item.end_date,
    );
    return activeYear?.academic_year_start_date
      ? activeWeekType(today, activeYear.academic_year_start_date)
      : 'odd';
  }, [teachingSchedule, today]);
  const lessons = teachingSchedule
    .filter((item) => (
      item.start_date <= today
      && today <= item.end_date
      && Number.isInteger(item.weekday)
      && Number.isInteger(item.lesson_number)
      && (item.week_type === 'all' || !item.week_type || item.week_type === weekType)
    ))
    .sort((first, second) => (
      (first.weekday ?? 0) - (second.weekday ?? 0)
      || (first.lesson_number ?? 0) - (second.lesson_number ?? 0)
      || first.grade - second.grade
      || first.section.localeCompare(second.section)
    ));

  return (
    <section style={{ display: 'grid', gap: 12 }}>
      <header>
        <h2 style={{ margin: 0 }}>Идэвхтэй хичээлийн хуваарь</h2>
        <p style={{ margin: '6px 0 0', color: '#64748b' }}>
          {today} · {weekType === 'odd' ? 'Сондгой' : 'Тэгш'} долоо хоног
        </p>
      </header>
      {!lessons.length ? (
        <p role="status" style={{ margin: 0, color: '#64748b' }}>
          Өнөөдөр хүчинтэй хуваарь олдсонгүй. Хуваарь оруулсан эсэх болон улирлын хугацааг шалгана уу.
        </p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 520 }}>
            <thead>
              <tr>
                {['Гараг', 'Цаг', 'Анги', 'Хичээл'].map((title) => (
                  <th key={title} style={cellStyle}>{title}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lessons.map((lesson, index) => (
                <tr
                  key={`${lesson.academic_year}-${lesson.weekday}-${lesson.lesson_number}-${lesson.grade}-${lesson.section}-${lesson.subject}-${index}`}
                  style={{
                    borderTop: '1px solid #e2e8f0',
                    background: lesson.weekday === weekday ? '#eff6ff' : '#fff',
                  }}
                >
                  <td style={cellStyle}>
                    {weekdays[(lesson.weekday ?? 1) - 1]}
                    {lesson.weekday === weekday && <strong> · Өнөөдөр</strong>}
                  </td>
                  <td style={cellStyle}>{lesson.lesson_number}</td>
                  <td style={cellStyle}>{lesson.grade}-{lesson.section}</td>
                  <td style={cellStyle}>
                    {lesson.subject}
                    {lesson.week_type && lesson.week_type !== 'all'
                      ? ` · ${lesson.week_type === 'odd' ? 'Сондгой' : 'Тэгш'}`
                      : ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

const cellStyle = {
  padding: '9px 10px',
  textAlign: 'left' as const,
  fontSize: 13,
  whiteSpace: 'nowrap' as const,
};
