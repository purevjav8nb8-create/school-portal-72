'use client';

import { useEffect, useState } from 'react';
import styles from './AttendanceMonthGrid.module.css';
import { listPublicHolidays, PublicHoliday } from './publicHolidaysApi';

interface AttendanceRecord {
  date: string;
  status: string;
}

interface Props {
  month: string;
  records: AttendanceRecord[];
}

const statusCodes: Record<string, string> = {
  Ирсэн: 'И',
  Хоцорсон: 'Х',
  Тасалсан: 'Т',
  Чөлөөтэй: 'Ч',
  Өвчтэй: 'Ө',
};

const statusStyles: Record<string, string> = {
  Ирсэн: styles.present,
  Хоцорсон: styles.late,
  Тасалсан: styles.absent,
  Чөлөөтэй: styles.leave,
  Өвчтэй: styles.sick,
};

export default function AttendanceMonthGrid({ month, records }: Props) {
  const [yearText, monthText] = month.split('-');
  const year = Number(yearText);
  const monthNumber = Number(monthText);
  const validMonth = /^\d{4}-\d{2}$/.test(month) && monthNumber >= 1 && monthNumber <= 12;
  const dayCount = validMonth ? new Date(year, monthNumber, 0).getDate() : 0;
  const [holidays, setHolidays] = useState<PublicHoliday[]>([]);
  const [holidayError, setHolidayError] = useState('');
  useEffect(() => {
    if (!validMonth) {
      setHolidays([]);
      return;
    }
    let active = true;
    setHolidayError('');
    setHolidays([]);
    void listPublicHolidays(year)
      .then((result) => {
        if (active) setHolidays(result);
      })
      .catch((error: unknown) => {
        if (active) setHolidayError(error instanceof Error ? error.message : 'Бүх нийтийн амралтын өдрүүд уншигдсангүй.');
      });
    return () => { active = false; };
  }, [validMonth, year]);
  const statusByDay = new Map(
    records
      .filter((record) => record.date.startsWith(month))
      .map((record) => [Number(record.date.slice(-2)), record.status]),
  );
  const holidaysByDate = new Map(holidays.map((holiday) => [holiday.date, holiday]));
  const weekdays = Array.from({ length: dayCount }, (_, index) => index + 1).filter((day) => {
    const weekday = new Date(Date.UTC(year, monthNumber - 1, day)).getUTCDay();
    return weekday !== 0 && weekday !== 6;
  });

  if (!dayCount) {
    return <p className={styles.empty}>Сарын мэдээлэл олдсонгүй.</p>;
  }

  return (
    <>
    {holidayError && <p role="alert" className={styles.error}>{holidayError}</p>}
    <div className={styles.scroller} role="region" aria-label={`${month} сарын ирц`} tabIndex={0}>
      <table className={styles.grid}>
        <tbody>
          <tr>
            <th className={styles.rowLabel} scope="row">Өдөр</th>
            {weekdays.map((day) => (
              <th className={styles.day} key={day} scope="col">{day}</th>
            ))}
          </tr>
          <tr>
            <th className={styles.rowLabel} scope="row">Ирц</th>
            {weekdays.map((day) => {
              const date = `${month}-${String(day).padStart(2, '0')}`;
              const holiday = holidaysByDate.get(date);
              const status = holiday ? 'Амралтын өдөр' : statusByDay.get(day);
              return (
                <td
                  className={`${styles.status} ${holiday ? styles.publicHoliday : status ? statusStyles[status] ?? styles.unknown : styles.emptyDay}`}
                  key={day}
                  aria-label={`${date}: ${holiday ? holiday.name : status ?? 'Бүртгэлгүй'}`}
                  title={`${day}: ${holiday ? holiday.name : status ?? 'Бүртгэлгүй'}`}
                >
                  {holiday ? 'А' : status ? statusCodes[status] ?? '·' : '·'}
                </td>
              );
            })}
          </tr>
        </tbody>
      </table>
    </div>
    </>
  );
}
