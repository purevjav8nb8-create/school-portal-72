'use client';

import { useMemo } from 'react';
import { formatTeacherName } from '../../utils/teacherName';
import { GradeBand, TeacherRecords } from './adminReviewTypes';

const evaluationLevels = ['VIII', 'VII', 'VI', 'V', 'IV', 'III', 'II', 'I'] as const;
const gradeBands = [
  { id: 'all', label: 'Бүгд', min: 1, max: 12 },
  { id: 'primary', label: 'Бага (1–5)', min: 1, max: 5 },
  { id: 'middle', label: 'Дунд (6–9)', min: 6, max: 9 },
  { id: 'high', label: 'Ахлах (10–12)', min: 10, max: 12 },
] as const;

interface Props {
  records: TeacherRecords[];
  selectedBand: GradeBand;
  setSelectedBand: (band: GradeBand) => void;
  selectedSubject: string;
  setSelectedSubject: (subject: string) => void;
}

export default function EvaluationSummary({
  records,
  selectedBand,
  setSelectedBand,
  selectedSubject,
  setSelectedSubject,
}: Props) {
  const summaries = useMemo(() => {
    const groups = new Map<string, {
      levels: Record<string, number>;
      students: number;
      weightedScore: number;
      teachers: Map<string, { name: string; email: string }>;
    }>();

    records.forEach((record) => record.evaluations.forEach((evaluation) => {
      const grade = Number(evaluation.grade);
      const students = Number(evaluation.students_count);
      const average = Number(evaluation.average_score);
      const section = String(evaluation.section ?? '').trim();
      const subject = String(evaluation.subject ?? '').trim();
      if (!Number.isInteger(grade) || grade < 1 || !section || !subject
        || !evaluationLevels.includes(evaluation.level as typeof evaluationLevels[number])
        || !Number.isFinite(students) || students < 0 || !Number.isFinite(average)) return;

      const key = `${grade}-${section}-${subject}`;
      const current = groups.get(key) ?? {
        levels: {},
        students: 0,
        weightedScore: 0,
        teachers: new Map<string, { name: string; email: string }>(),
      };
      const teacherId = record.user_id || record.teacher.email || record.teacher.name;
      current.teachers.set(teacherId, {
        name: formatTeacherName(record.teacher.name),
        email: record.teacher.email,
      });
      current.levels[evaluation.level] = (current.levels[evaluation.level] ?? 0) + students;
      current.students += students;
      current.weightedScore += average * students;
      groups.set(key, current);
    }));

    return [...groups.entries()].map(([key, value]) => {
      const [grade, section, ...subjectParts] = key.split('-');
      const teachers = [...value.teachers.values()];
      const nameCounts = new Map<string, number>();
      teachers.forEach(({ name }) => nameCounts.set(name, (nameCounts.get(name) ?? 0) + 1));
      return {
        grade: Number(grade),
        section,
        subject: subjectParts.join('-'),
        levels: value.levels,
        students: value.students,
        teacherCount: teachers.length,
        teacherNames: teachers.map(({ name, email }) => nameCounts.get(name) > 1 ? `${name} (${email})` : name).join(', '),
        average: value.students ? value.weightedScore / value.students : 0,
      };
    }).sort((left, right) =>
      left.grade - right.grade || left.section.localeCompare(right.section) || left.subject.localeCompare(right.subject),
    );
  }, [records]);

  const band = gradeBands.find((item) => item.id === selectedBand) ?? gradeBands[0];
  const bandSummary = summaries.filter((item) => item.grade >= band.min && item.grade <= band.max);
  const subjects = [...new Set(bandSummary.map((item) => item.subject))].sort((a, b) => a.localeCompare(b));
  const activeSubject = subjects.includes(selectedSubject) ? selectedSubject : '';
  const rows = activeSubject ? bandSummary.filter((item) => item.subject === activeSubject) : bandSummary;
  const totals = rows.reduce((result, item) => {
    evaluationLevels.forEach((level) => { result.levels[level] += item.levels[level] ?? 0; });
    result.students += item.students;
    result.weightedScore += item.average * item.students;
    return result;
  }, {
    levels: Object.fromEntries(evaluationLevels.map((level) => [level, 0])) as Record<string, number>,
    students: 0,
    weightedScore: 0,
  });

  return (
    <section style={{ padding: 10, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8 }}>
      <h3 style={{ margin: '0 0 8px', fontSize: 16 }}>Хичээлийн нэгтгэл</h3>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
        {gradeBands.map((item) => (
          <button key={item.id} type="button" onClick={() => { setSelectedBand(item.id); setSelectedSubject(''); }} style={tabButton(selectedBand === item.id)}>
            {item.label}
          </button>
        ))}
      </div>
      {!subjects.length ? <p style={{ margin: 0 }}>Энэ түвшинд үнэлгээ оруулаагүй байна.</p> : <>
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 8 }}>
          <button type="button" onClick={() => setSelectedSubject('')} style={subjectTabButton(!activeSubject)}>Бүх хичээл</button>
          {subjects.map((subject) => (
            <button key={subject} type="button" onClick={() => setSelectedSubject(subject)} style={subjectTabButton(activeSubject === subject)}>
              {subject}
            </button>
          ))}
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 12 }}>
            <thead><tr>{['Анги', ...(!activeSubject ? ['Хичээл'] : []), ...evaluationLevels, 'Нийт', 'Дундаж', 'Багш (тоо)'].map((label) => <th key={label} style={{ padding: '4px 6px', background: '#fff' }}>{label}</th>)}</tr></thead>
            <tbody>
              {rows.map((item) => (
                <tr key={`${item.grade}-${item.section}-${item.subject}`} style={{ borderTop: '1px solid #e2e8f0' }}>
                  <td style={{ padding: '4px 6px', fontWeight: 600 }}>{item.grade}-{item.section}</td>
                  {!activeSubject && <td style={{ padding: '4px 6px' }}>{item.subject}</td>}
                  {evaluationLevels.map((level) => <td key={level} style={{ padding: '4px 6px' }}>{item.levels[level] ?? 0}</td>)}
                  <td style={{ padding: '4px 6px' }}>{item.students}</td>
                  <td style={{ padding: '4px 6px' }}>{item.average.toFixed(1)}</td>
                  <td style={{ padding: '4px 6px' }}>{item.teacherNames}{item.teacherCount ? ` (${item.teacherCount})` : ''}</td>
                </tr>
              ))}
              <tr style={{ borderTop: '2px solid #94a3b8', background: '#e2e8f0', fontWeight: 700 }}>
                <td style={{ padding: '4px 6px' }}>Нэгтгэл</td>
                {!activeSubject && <td style={{ padding: '4px 6px' }} />}
                {evaluationLevels.map((level) => <td key={level} style={{ padding: '4px 6px' }}>{totals.levels[level]}</td>)}
                <td style={{ padding: '4px 6px' }}>{totals.students}</td>
                <td style={{ padding: '4px 6px' }}>{(totals.students ? totals.weightedScore / totals.students : 0).toFixed(1)}</td>
                <td style={{ padding: '4px 6px' }} />
              </tr>
            </tbody>
          </table>
        </div>
      </>}
    </section>
  );
}

const tabButton = (active: boolean) => ({
  padding: '5px 10px',
  border: `1px solid ${active ? '#2563eb' : '#cbd5e1'}`,
  borderRadius: 6,
  background: active ? '#2563eb' : '#fff',
  color: active ? '#fff' : '#334155',
  fontSize: 12,
  fontWeight: 700,
  cursor: 'pointer',
});

const subjectTabButton = (active: boolean) => ({
  padding: '4px 9px',
  border: `1px solid ${active ? '#0f766e' : '#cbd5e1'}`,
  borderRadius: 5,
  background: active ? '#ccfbf1' : '#fff',
  color: '#134e4a',
  fontSize: 12,
  cursor: 'pointer',
});
