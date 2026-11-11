import { Teacher } from '../types';
import AttendanceMonthGrid from './AttendanceMonthGrid';
import styles from './TeacherDetailModal.module.css';

interface Props {
  teacher: Teacher;
  month: string;
  onClose: () => void;
}

export default function TeacherAttendanceDialog({ teacher, month, onClose }: Props) {
  const records = (teacher.daily_records ?? [])
    .filter((record) => record.date.startsWith(month))
    .sort((left, right) => left.date.localeCompare(right.date));
  const present = records.filter((record) => record.status === 'Ирсэн').length;
  const rate = records.length ? Math.round((present / records.length) * 100) : 0;

  return (
    <div className={styles.overlay} onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="attendance-dialog-title">
        <header className={styles.header}>
          <div className={styles.identity}>
            <h2 className={styles.title} id="attendance-dialog-title">{teacher.last_name} {teacher.first_name}</h2>
            <p className={styles.subtitle}>{teacher.unit} · {teacher.subject} · сарын ирцийн дэлгэрэнгүй</p>
          </div>
          <button className={styles.button} type="button" onClick={onClose}>Хаах</button>
        </header>
        <div className={styles.body}>
          <div className={styles.stats}>
            <Stat label="Ирцийн хувь" value={`${rate}%`} />
            <Stat label="Бүртгэлтэй өдөр" value={String(records.length)} />
            <Stat label="Ирсэн өдөр" value={String(present)} />
            <Stat label="Илүү цаг" value={`${teacher.overtime_hours ?? 0} цаг`} />
          </div>
          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <h3 className={styles.sectionTitle}>Сарын ирц</h3>
              <span className={styles.monthBadge}>{month}</span>
            </div>
            <AttendanceMonthGrid month={month} records={records} />
          </section>
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className={styles.stat}><span className={styles.statLabel}>{label}</span><b className={styles.statValue}>{value}</b></div>;
}
