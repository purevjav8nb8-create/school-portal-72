'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import ClassFields from './ClassFields';
import FloatingComposer from './FloatingComposer';
import EvaluationTable, { EvaluationClassSummary } from './EvaluationTable';
import SharedEvaluationList from './SharedEvaluationList';
import { EVALUATION_LEVELS } from './evaluationTypes';
import type { EvaluationRecord } from './evaluationTypes';
import type { TeachingScheduleAssignment } from '../../types';
import { schoolToday } from '../../../../lib/schoolDate';
export { EVALUATION_LEVELS } from './evaluationTypes';
export type { EvaluationRecord } from './evaluationTypes';

interface Props {
  unit: string;
  subjects: string[];
  teachingSchedule: TeachingScheduleAssignment[];
  evaluations: EvaluationRecord[];
  onSubmit: (evaluation: Omit<EvaluationRecord, 'id' | 'createdAt'>) => Promise<void>;
  onDelete: (evaluationId: string) => Promise<void>;
  sharedEvaluations?: (EvaluationRecord & { evaluator?: string; evaluator_id?: string; evaluator_email?: string })[];
}

const inputStyle = { width: '100%', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: 8, boxSizing: 'border-box' as const };

export default function EvaluationPanel({ unit, subjects, teachingSchedule, evaluations, onSubmit, onDelete, sharedEvaluations = [] }: Props) {
  const [grade, setGrade] = useState(0);
  const [section, setSection] = useState('');
  const [subject, setSubject] = useState('');
  const [levelCounts, setLevelCounts] = useState<Record<typeof EVALUATION_LEVELS[number], string>>(
    Object.fromEntries(EVALUATION_LEVELS.map((item) => [item, ''])) as Record<typeof EVALUATION_LEVELS[number], string>
  );
  const [averageScore, setAverageScore] = useState('');
  const [evaluationDate, setEvaluationDate] = useState(schoolToday);
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const availableClasses = useMemo(() => {
    const classes = new Map<string, { grade: number; section: string; subject: string }>();
    for (const assignment of teachingSchedule) {
      if (evaluationDate < assignment.start_date || evaluationDate > assignment.end_date) continue;
      const key = `${assignment.grade}-${assignment.section}-${assignment.subject}`;
      classes.set(key, {
        grade: assignment.grade,
        section: assignment.section,
        subject: assignment.subject,
      });
    }
    return [...classes.values()];
  }, [evaluationDate, teachingSchedule]);

  useEffect(() => {
    if (!availableClasses.length) {
      if (grade || section || subject) {
        setGrade(0);
        setSection('');
        setSubject('');
      }
      return;
    }
    if (grade && !availableClasses.some((item) => item.grade === grade)) {
      setGrade(0);
      setSection('');
      setSubject('');
      return;
    }
    if (section && !availableClasses.some((item) => item.grade === grade && item.section === section)) {
      setSection('');
      setSubject('');
      return;
    }
    if (subject && !availableClasses.some((item) => item.grade === grade && item.section === section && item.subject === subject)) {
      setSubject('');
    }
  }, [availableClasses, grade, section, subject]);

  const classes = useMemo<EvaluationClassSummary[]>(() => {
    const grouped = new Map<string, EvaluationRecord[]>();
    for (const record of evaluations) {
      const key = `${record.grade}-${record.section}-${record.subject}`;
      grouped.set(key, [...(grouped.get(key) ?? []), record]);
    }
    return [...grouped.entries()].map(([className, rows]) => {
      const byLevel = Object.fromEntries(rows.map((row) => [row.level, row.students_count])) as Record<string, number>;
      const students = rows.reduce((total, row) => total + row.students_count, 0);
      return {
        className,
        rows,
        counts: EVALUATION_LEVELS.map((level) => byLevel[level] ?? 0),
        students,
        average: rows[0]?.average_score ?? 0,
        date: rows.map((row) => row.evaluation_date).sort().at(-1) ?? '',
      };
    }).sort((firstGroup, secondGroup) => {
      const first = firstGroup.rows[0];
      const second = secondGroup.rows[0];
      return first.grade - second.grade || first.section.localeCompare(second.section) || first.subject.localeCompare(second.subject);
    });
  }, [evaluations]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setErrorMessage('');
    try {
      if (!availableClasses.some((item) => (
        item.grade === grade && item.section === section && item.subject === subject
      ))) {
        throw new Error('Сонгосон огноо, анги, хичээл таны хуваарьт байхгүй байна.');
      }
      const entries = EVALUATION_LEVELS
        .map((item) => ({ level: item, students_count: Number(levelCounts[item] || 0) }))
        .filter((item) => item.students_count > 0);
      if (entries.length === 0) throw new Error('Ядаж нэг түвшний хүүхдийн тоог оруулна уу.');
      for (const entry of entries) {
        await onSubmit({
          grade,
          section,
          subject,
          level: entry.level,
          students_count: entry.students_count,
          average_score: Number(averageScore),
          evaluation_date: evaluationDate,
        });
      }
      setLevelCounts(Object.fromEntries(EVALUATION_LEVELS.map((item) => [item, ''])) as Record<typeof EVALUATION_LEVELS[number], string>);
      setAverageScore('');
      return true;
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Үнэлгээ хадгалагдсангүй.');
      return false;
    } finally {
      setBusy(false);
    }
  };

  return (
    <section style={{ display: 'grid', gap: 18 }}>
      <header>
        <h2 style={{ margin: 0 }}>Үнэлгээ</h2>
        <p style={{ margin: '6px 0 0', color: '#64748b' }}>Түвшин бүрийн үнэлэгдсэн хүүхдийн тоо, ангийн дундажийг оруулна.</p>
      </header>
      <SharedEvaluationList evaluations={sharedEvaluations} />
      <FloatingComposer title="Үнэлгээ оруулах" label="Үнэлгээ оруулах">
        {(close) => <form onSubmit={async (event) => { if (await submit(event)) close(); }} style={{ display: 'grid', gap: 12, padding: 16, border: '1px solid #e2e8f0', borderRadius: 8 }}>
        {!teachingSchedule.length && <p role="status" style={{ color: '#b45309', margin: 0 }}>Таны хуваарьт хичээл бүртгэгдээгүй байна. Үнэлгээ оруулахын өмнө хуваарийг шинэчлүүлнэ үү.</p>}
        {teachingSchedule.length > 0 && !availableClasses.length && <p role="status" style={{ color: '#b45309', margin: 0 }}>Сонгосон огноонд таны хуваарьт хичээл алга.</p>}
        <ClassFields
          unit={unit}
          subjects={subjects}
          allowedClasses={availableClasses}
          grade={grade}
          section={section}
          subject={subject}
          onGradeChange={setGrade}
          onSectionChange={setSection}
          onSubjectChange={setSubject}
          evaluationSubjects
        />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 10 }}>
          {EVALUATION_LEVELS.map((item) => (
            <label key={item} style={{ display: 'grid', gap: 5 }}>{item}
              <input type="number" min="0" step="1" value={levelCounts[item]} onChange={(event) => setLevelCounts((current) => ({ ...current, [item]: event.target.value }))} style={inputStyle} />
            </label>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
          <label style={{ display: 'grid', gap: 5 }}>Дундаж үнэлгээ (0–100)
            <input required type="number" min="0" max="100" step="0.1" value={averageScore} onChange={(event) => setAverageScore(event.target.value)} style={inputStyle} />
          </label>
        </div>
        <label style={{ display: 'grid', gap: 5 }}>Үнэлсэн огноо
          <input required type="date" value={evaluationDate} onChange={(event) => setEvaluationDate(event.target.value)} style={inputStyle} />
        </label>
        {errorMessage && <p role="alert" style={{ color: '#b91c1c', margin: 0 }}>{errorMessage}</p>}
        <button type="submit" disabled={busy} style={{ padding: '8px 12px', border: 0, borderRadius: 6, background: busy ? '#cbd5e1' : '#0f766e', color: '#fff', fontWeight: 700 }}>
          {busy ? 'Хадгалж байна...' : 'Үнэлгээ хадгалах'}
        </button>
        </form>}
      </FloatingComposer>
      <EvaluationTable classes={classes} onDelete={onDelete} />
    </section>
  );
}
