'use client';

import { Trash2 } from 'lucide-react';
import { EVALUATION_LEVELS, EvaluationRecord } from './evaluationTypes';
import RecordFeedCard from './RecordFeedCard';

export type EvaluationClassSummary = {
  className: string;
  rows: EvaluationRecord[];
  counts: number[];
  students: number;
  average: number;
  date: string;
};

export default function EvaluationTable({
  classes,
  onDelete,
}: {
  classes: EvaluationClassSummary[];
  onDelete: (evaluationId: string) => Promise<void>;
}) {
  const subjectGroups = new Map<string, EvaluationClassSummary[]>();
  classes.forEach((item) => {
    const subject = item.rows[0].subject;
    subjectGroups.set(subject, [...(subjectGroups.get(subject) ?? []), item]);
  });

  return (
    <div style={{ display: 'grid', gap: 10 }}>
      {classes.length === 0 ? <p style={{ padding: 12 }}>Одоогоор үнэлгээ оруулаагүй байна.</p> : [...subjectGroups.entries()].map(([subjectName, subjectClasses]) => (
        <section key={subjectName} style={{ display: 'grid', gap: 8 }}>
          {subjectClasses.map(({ className, rows, counts, students, average, date }) => (
            <RecordFeedCard
              key={className}
              label={`Үнэлгээ · ${subjectName}`}
              title={`${rows[0].grade}-${rows[0].section} анги`}
              description={EVALUATION_LEVELS.map((level, index) => `${level}: ${counts[index] ?? 0}`).join(' · ')}
              metadata={`Нийт ${students} сурагч · Дундаж ${average}`}
              date={date}
              action={<button type="button" onClick={async () => {
                    if (!window.confirm('Энэ үнэлгээний мөрийг устгах уу?')) return;
                    await Promise.all(rows.map((row) => onDelete(row.id)));
                  }} style={deleteButton} aria-label="Үнэлгээ устгах" title="Үнэлгээ устгах"><Trash2 size={14} strokeWidth={2} /></button>}
            />
          ))}
          <RecordFeedCard
            label="Нэгтгэл"
            title={subjectName}
            description={EVALUATION_LEVELS.map((level, index) => `${level}: ${subjectClasses.reduce((sum, item) => sum + (item.counts[index] ?? 0), 0)}`).join(' · ')}
            metadata={`Нийт ${subjectClasses.reduce((sum, item) => sum + item.students, 0)} сурагч · Дундаж ${subjectClasses.length ? (subjectClasses.reduce((sum, item) => sum + item.average, 0) / subjectClasses.length).toFixed(1) : '0'}`}
          />
        </section>
      ))}
    </div>
  );
}

const deleteButton = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 5, border: 0, borderRadius: 5, background: '#fee2e2', color: '#b91c1c', cursor: 'pointer' };
