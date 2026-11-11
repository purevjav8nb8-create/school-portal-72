import styles from './AttendanceMonthGrid.module.css';

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
  const statusByDay = new Map(
    records
      .filter((record) => record.date.startsWith(month))
      .map((record) => [Number(record.date.slice(-2)), record.status]),
  );

  if (!dayCount) {
    return <p className={styles.empty}>Сарын мэдээлэл олдсонгүй.</p>;
  }

  return (
    <div className={styles.scroller} role="region" aria-label={`${month} сарын ирц`} tabIndex={0}>
      <table className={styles.grid}>
        <tbody>
          <tr>
            <th className={styles.rowLabel} scope="row">Өдөр</th>
            {Array.from({ length: dayCount }, (_, index) => (
              <th className={styles.day} key={index + 1} scope="col">{index + 1}</th>
            ))}
          </tr>
          <tr>
            <th className={styles.rowLabel} scope="row">Ирц</th>
            {Array.from({ length: dayCount }, (_, index) => {
              const status = statusByDay.get(index + 1);
              return (
                <td
                  className={`${styles.status} ${status ? statusStyles[status] ?? styles.unknown : styles.emptyDay}`}
                  key={index + 1}
                  aria-label={`${month}-${String(index + 1).padStart(2, '0')}: ${status ?? 'Бүртгэлгүй'}`}
                  title={`${index + 1}: ${status ?? 'Бүртгэлгүй'}`}
                >
                  {status ? statusCodes[status] ?? '·' : '·'}
                </td>
              );
            })}
          </tr>
        </tbody>
      </table>
    </div>
  );
}
