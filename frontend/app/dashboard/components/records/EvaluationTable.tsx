'use client';

import { Trash2 } from 'lucide-react';
import { EVALUATION_LEVELS, EvaluationRecord } from './evaluationTypes';

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
    <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: 8 }}>
      {classes.length === 0 ? <p style={{ padding: 12 }}>Одоогоор үнэлгээ оруулаагүй байна.</p> : [...subjectGroups.entries()].map(([subjectName, subjectClasses]) => (
        <section key={subjectName} style={{ borderBottom: '1px solid #e2e8f0' }}>
          <h3 style={{ margin: 0, padding: 12, background: '#f1f5f9' }}>{subjectName}</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 12 }}>
            <thead><tr>{['Анги', ...EVALUATION_LEVELS, 'Нийт', 'Дундаж', 'Огноо', ''].map((head) => <th key={head} style={{ padding: '5px 7px', background: '#f8fafc' }}>{head}</th>)}</tr></thead>
            <tbody>{subjectClasses.map(({ className, rows, counts, students, average, date }) => (
              <tr key={className} style={{ borderTop: '1px solid #e2e8f0' }}>
                <td style={{ padding: '5px 7px', fontWeight: 700 }}>{`${rows[0].grade}${String(rows[0].section ?? '').toLowerCase()}`}</td>
                {[...counts, students, average, date].map((value, index) => <td key={index} style={{ padding: '5px 7px' }}>{value}</td>)}
                <td style={{ padding: '5px 7px' }}>
                  <button type="button" onClick={async () => {
                    if (!window.confirm('Энэ үнэлгээний мөрийг устгах уу?')) return;
                    await Promise.all(rows.map((row) => onDelete(row.id)));
                  }} style={deleteButton} aria-label="Үнэлгээ устгах" title="Үнэлгээ устгах"><Trash2 size={14} strokeWidth={2} /></button>
                </td>
              </tr>
            ))}</tbody>
            <tfoot><tr style={{ background: '#f8fafc', borderTop: '2px solid #cbd5e1', fontWeight: 700 }}>
              <td style={{ padding: '5px 7px' }}>Нэгтгэл</td>
              {EVALUATION_LEVELS.map((level, index) => <td key={level} style={{ padding: '5px 7px' }}>{subjectClasses.reduce((sum, item) => sum + (item.counts[index] ?? 0), 0)}</td>)}
              <td style={{ padding: '5px 7px' }}>{subjectClasses.reduce((sum, item) => sum + item.students, 0)}</td>
              <td style={{ padding: '5px 7px' }}>{subjectClasses.length ? (subjectClasses.reduce((sum, item) => sum + item.average, 0) / subjectClasses.length).toFixed(1) : '0'}</td>
              <td style={{ padding: '5px 7px' }}>-</td><td style={{ padding: '5px 7px' }}>-</td>
            </tr></tfoot>
          </table>
        </section>
      ))}
    </div>
  );
}

const deleteButton = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 5, border: 0, borderRadius: 5, background: '#fee2e2', color: '#b91c1c', cursor: 'pointer' };
