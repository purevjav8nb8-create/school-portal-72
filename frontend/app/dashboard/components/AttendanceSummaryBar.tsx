import styles from './AttendanceSummaryBar.module.css';
import PublicHolidayManager from './PublicHolidayManager';

interface Props {
  activeUnit: string;
  selectedMonth: string;
  setSelectedMonth: (month: string) => void;
  readOnly: boolean;
  attendanceRate: number;
  counts: { present: number; late: number; leave: number; sick: number; absent: number };
  canManagePublicHolidays?: boolean;
}

export default function AttendanceSummaryBar({
  activeUnit, selectedMonth, setSelectedMonth, readOnly, attendanceRate, counts, canManagePublicHolidays = false,
}: Props) {
  const months = Array.from({ length: 12 }, (_, offset) => {
    const date = new Date();
    date.setDate(1);
    date.setMonth(date.getMonth() - offset);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return { value: `${date.getFullYear()}-${month}`, label: `${date.getFullYear()} оны ${month}-р сар` };
  });

  return (
    <header className={styles.header}>
      <div className={styles.titleRow}>
        <h3>{readOnly ? 'Миний ирц' : `${activeUnit} · Багш нарын ирц`}</h3>
        <label className={styles.monthPicker}>Сар сонгох
          <select value={selectedMonth} onChange={(event) => setSelectedMonth(event.target.value)}>
            {months.map((month) => <option key={month.value} value={month.value}>{month.label}</option>)}
          </select>
        </label>
      </div>
      {canManagePublicHolidays && <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <PublicHolidayManager initialYear={Number(selectedMonth.slice(0, 4))} />
      </div>}
      <div className={styles.summary}>
        <div className={styles.rate}>
          <span>Ирцийн хувь <b>{attendanceRate}%</b></span>
          <div className={styles.progress}><span style={{ width: `${attendanceRate}%` }} /></div>
        </div>
        <div className={styles.counts}>
          <span className={styles.present}>Ирсэн <b>{counts.present}</b></span>
          <span className={styles.late}>Хоцорсон <b>{counts.late}</b></span>
          <span className={styles.leave}>Чөлөөтэй <b>{counts.leave}</b></span>
          <span className={styles.sick}>Өвчтэй <b>{counts.sick}</b></span>
          <span className={styles.absent}>Тасалсан <b>{counts.absent}</b></span>
        </div>
      </div>
    </header>
  );
}
