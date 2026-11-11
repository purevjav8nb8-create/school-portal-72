'use client';

import { FormEvent, useState } from 'react';
import { backendBaseUrl, fetchWithAuth } from '../../../lib/backendApi';
import { supabase } from '../../../lib/supabaseClient';
import { Teacher } from '../types';
import { subjectsForUnit } from './records/ClassFields';
import AttendanceMonthGrid from './AttendanceMonthGrid';
import styles from './TeacherDetailModal.module.css';

interface Props {
  teacher: Teacher | null;
  selectedMonth: string;
  onClose: () => void;
  onTeacherUpdated: (teacher: Teacher) => void;
}

export default function TeacherDetailModal({ teacher, selectedMonth, onClose, onTeacherUpdated }: Props) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [form, setForm] = useState(() => teacher ? {
    first_name: teacher.first_name,
    last_name: teacher.last_name,
    unit: teacher.unit,
    subject: teacher.subject,
  } : null);

  if (!teacher) return null;
  const records = (teacher.daily_records ?? []).filter((record) =>
    typeof record.date === 'string' && record.date.startsWith(selectedMonth),
  );
  const present = records.filter((record) => record.status === 'Ирсэн').length;
  const rate = records.length ? Math.round((present / records.length) * 100) : 0;
  const weeklyHours = teacher.weekly_teaching_hours ?? (teacher.teaching_classes ?? []).reduce(
    (sum, item) => sum + item.weekly_hours,
    0,
  );

  async function saveTeacher(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form || !teacher.auth_id) return;
    setSaving(true);
    setErrorMessage('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Нэвтрэх эрх дууссан байна.');
      const response = await fetchWithAuth(`${backendBaseUrl}/api/teachers/${teacher.auth_id}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.detail ?? 'Мэдээлэл шинэчлэгдсэнгүй.');
      onTeacherUpdated({ ...teacher, ...result.teacher });
      setEditing(false);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Мэдээлэл шинэчлэгдсэнгүй.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={styles.overlay} onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="teacher-detail-title">
        <header className={styles.header}>
          <div className={styles.identity}>
            <h2 className={styles.title} id="teacher-detail-title">{teacher.last_name} {teacher.first_name}</h2>
            <p className={styles.subtitle}>{teacher.email} <span aria-hidden="true">·</span> {teacher.unit} <span aria-hidden="true">·</span> {teacher.subject}</p>
          </div>
          <div className={styles.headerActions}>
            {!editing && <button className={styles.primaryButton} type="button" onClick={() => {
              setForm({ first_name: teacher.first_name, last_name: teacher.last_name, unit: teacher.unit, subject: teacher.subject });
              setErrorMessage('');
              setEditing(true);
            }}>Мэдээлэл засах</button>}
            <button className={styles.button} type="button" onClick={onClose}>Хаах</button>
          </div>
        </header>

        <div className={styles.body}>
          {editing && form && (
            <form className={styles.form} onSubmit={saveTeacher}>
              <label className={styles.field}>Овог<input className={styles.input} required value={form.last_name} onChange={(event) => setForm({ ...form, last_name: event.target.value })} /></label>
              <label className={styles.field}>Нэр<input className={styles.input} required value={form.first_name} onChange={(event) => setForm({ ...form, first_name: event.target.value })} /></label>
              <label className={styles.field}>Нэгж<select className={styles.input} value={form.unit} onChange={(event) => setForm({ ...form, unit: event.target.value as Teacher['unit'], subject: '' })}>
                <option value="БАЗАН">БАЗАН</option><option value="БУЗАН">БУЗАН</option><option value="НУЗАН">НУЗАН</option>
              </select></label>
              <label className={styles.field}>Заах хичээл<select className={styles.input} required value={form.subject} onChange={(event) => setForm({ ...form, subject: event.target.value })}>
                <option value="" disabled>Заах хичээл сонгох</option>
                {subjectsForUnit(form.unit).map((subject) => <option key={subject}>{subject}</option>)}
              </select></label>
              {errorMessage && <p className={styles.error} role="alert">{errorMessage}</p>}
              <div className={styles.formActions}>
                <button className={styles.primaryButton} type="submit" disabled={saving}>{saving ? 'Хадгалж байна...' : 'Хадгалах'}</button>
                <button className={styles.secondaryButton} type="button" onClick={() => { setEditing(false); setErrorMessage(''); }}>Буцах</button>
              </div>
            </form>
          )}

          <div className={styles.stats}>
            <Stat label="Сарын ирц" value={`${rate}%`} />
            <Stat label="Бүртгэлтэй өдөр" value={String(records.length)} />
            <Stat label="7 хоногийн цаг" value={String(weeklyHours)} />
            <Stat label="Илүү цаг" value={String(teacher.overtime_hours ?? Math.max(0, weeklyHours - 19))} />
          </div>

          <section className={styles.section}>
            <div className={styles.sectionHeader}><h3 className={styles.sectionTitle}>Заадаг ангиуд</h3></div>
            {(teacher.teaching_classes ?? []).length === 0 ? <p className={styles.empty}>Анги бүртгэгдээгүй байна.</p> : (
              <ul className={styles.classList}>{teacher.teaching_classes?.map((item) => (
                <li className={styles.classItem} key={`${item.grade}-${item.section}`}>{item.grade}-р анги · {item.section} бүлэг · 7 хоногт {item.weekly_hours} цаг</li>
              ))}</ul>
            )}
          </section>

          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <h3 className={styles.sectionTitle}>Сарын ирц</h3>
              <span className={styles.monthBadge}>{selectedMonth}</span>
            </div>
            <AttendanceMonthGrid month={selectedMonth} records={records} />
          </section>
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className={styles.stat}><span className={styles.statLabel}>{label}</span><b className={styles.statValue}>{value}</b></div>;
}
