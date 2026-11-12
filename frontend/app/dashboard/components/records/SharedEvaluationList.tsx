import { EvaluationRecord } from './evaluationTypes';
import { useMemo, useState } from 'react';
import { formatTeacherName } from '../../utils/teacherName';
import RecordFeedCard from './RecordFeedCard';

export default function SharedEvaluationList({ evaluations }: { evaluations: (EvaluationRecord & { evaluator?: string; evaluator_id?: string; evaluator_email?: string })[] }) {
  const [open, setOpen] = useState(false);
  const evaluators = useMemo(() => {
    const unique = new Map<string, { name: string; email: string }>();
    evaluations.forEach((item) => {
      const name = formatTeacherName(item.evaluator || 'Багш');
      unique.set(item.evaluator_id || item.evaluator || item.id, { name, email: item.evaluator_email ?? '' });
    });
    const teachers = [...unique.values()];
    const nameCounts = new Map<string, number>();
    teachers.forEach((teacher) => nameCounts.set(teacher.name, (nameCounts.get(teacher.name) ?? 0) + 1));
    return teachers.map((teacher) => nameCounts.get(teacher.name) > 1 ? `${teacher.name} (${teacher.email})` : teacher.name);
  }, [evaluations]);
  const summary = useMemo(() => {
    const groups = new Map<string, { grade: number; section: string; subject: string; levels: Record<string, number>; students: number; weightedScore: number; date: string }>();
    evaluations.forEach((item) => {
      const key = `${item.grade}-${item.section}-${item.subject}`;
      const group = groups.get(key) ?? { grade: item.grade, section: item.section, subject: item.subject, levels: {}, students: 0, weightedScore: 0, date: '' };
      group.levels[item.level] = (group.levels[item.level] ?? 0) + item.students_count;
      group.students += item.students_count;
      group.weightedScore += item.average_score * item.students_count;
      if (item.evaluation_date > group.date) group.date = item.evaluation_date;
      groups.set(key, group);
    });
    return [...groups.values()].sort((first, second) =>
      first.grade - second.grade || first.section.localeCompare(second.section) || first.subject.localeCompare(second.subject),
    );
  }, [evaluations]);
  return <>
    <button type="button" onClick={() => setOpen(true)} style={{ padding: '8px 12px', border: '1px solid #bfdbfe', borderRadius: 8, background: '#eff6ff', color: '#1e40af', fontWeight: 700, cursor: 'pointer' }}>
      Даасан ангийн үнэлгээ · {summary.length} хичээл
    </button>
    {open && <div role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 55, display: 'grid', placeItems: 'center', padding: 16, background: 'rgba(15,23,42,.5)' }}>
      <section role="dialog" aria-modal="true" aria-label="Даасан ангийн үнэлгээ" style={{ width: 'min(960px, 100%)', maxHeight: '85vh', overflow: 'auto', padding: 18, borderRadius: 12, background: '#fff', boxShadow: '0 24px 70px rgba(15,23,42,.3)' }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <div><h3 style={{ margin: 0, color: '#1e40af' }}>Даасан ангийн үнэлгээ</h3><p style={{ margin: '4px 0 12px', color: '#64748b' }}>Даасан ангийн бүх хичээлийн нэгтгэл · {summary.length} хичээл</p></div>
          <button type="button" onClick={() => setOpen(false)} style={{ padding: '7px 10px', border: '1px solid #cbd5e1', borderRadius: 6, background: '#fff', cursor: 'pointer' }}>Хаах</button>
        </header>
        <div style={{ display: 'grid', gap: 8 }}>
          {!!evaluators.length && <p style={{ margin: '0 0 2px', color: '#475569' }}>Үнэлсэн багш ({evaluators.length}): {evaluators.join(', ')}</p>}
          {summary.length === 0
            ? <p style={{ color: '#64748b' }}>Даасан ангид үнэлгээ оруулаагүй байна.</p>
            : summary.map((item) => <RecordFeedCard
              key={`${item.grade}-${item.section}-${item.subject}`}
              label={`Даасан ангийн үнэлгээ · ${item.subject}`}
              title={`${item.grade}-${item.section} анги`}
              description={['VIII', 'VII', 'VI', 'V', 'IV', 'III', 'II', 'I'].map((level) => `${level}: ${item.levels[level] ?? 0}`).join(' · ')}
              metadata={`Нийт ${item.students} сурагч · Дундаж ${item.students ? (item.weightedScore / item.students).toFixed(1) : '0.0'}`}
              date={item.date}
            />)}
        </div>
      </section>
    </div>}
  </>;
}
