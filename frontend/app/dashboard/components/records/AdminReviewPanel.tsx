'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../../../lib/supabaseClient';
import FileAttachmentActions from './FileAttachmentActions';
import { romanGrade } from './ClassFields';

const apiUrl = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://127.0.0.1:8000';
const evaluationLevels = ['VIII', 'VII', 'VI', 'V', 'IV', 'III', 'II', 'I'] as const;
const gradeBands = [
  { id: 'Бага', label: 'Бага (1–5)', min: 1, max: 5 },
  { id: 'Дунд', label: 'Дунд (6–9)', min: 6, max: 9 },
  { id: 'Ахлах', label: 'Ахлах (10–12)', min: 10, max: 12 },
] as const;

type Activity = {
  id: string;
  category: string;
  title: string;
  date: string;
  note: string;
  grade?: number;
  section?: string;
  subject?: string;
  images?: string[];
  attachments?: { name: string; url: string; file_type: 'image' | 'document' }[];
  review_status: 'pending' | 'approved' | 'rejected';
  admin_note: string;
};

type TeacherRecords = {
  user_id: string;
  teacher: { name: string; email: string; unit: string; subject: string };
  program_plan?: { documentUrl: string; note: string; grade?: number; section?: string; subject?: string; approved: boolean; submittedAt: string };
  activities: Activity[];
  evaluations: { id: string; grade: number; section: string; subject: string; level: string; students_count: number; average_score: number; evaluation_date: string }[];
};

interface Props {
  summaryOnly?: boolean;
}

export default function AdminReviewPanel({ summaryOnly = false }: Props) {
  const [records, setRecords] = useState<TeacherRecords[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [selectedBand, setSelectedBand] = useState<(typeof gradeBands)[number]['id']>('Бага');
  const [selectedSubject, setSelectedSubject] = useState('');

  const request = async (path: string, method = 'GET', body?: object) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Дахин нэвтэрнэ үү.');
    const response = await fetch(`${apiUrl}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.detail ?? 'Хүсэлт амжилтгүй боллоо.');
    return result;
  };

  const loadRecords = async () => {
    setLoading(true);
    try {
      const result = await request('/api/teachers/review');
      setRecords(Array.isArray(result) ? result.map((record) => ({
        ...record,
        evaluations: Array.isArray(record.evaluations) ? record.evaluations : [],
      })) : []);
      setErrorMessage('');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Материал уншигдсангүй.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadRecords(); }, []);

  const reviewPlan = async (userId: string, approved: boolean) => {
    try {
      await request(`/api/teachers/review/${userId}/program-plan`, 'PATCH', { approved });
      await loadRecords();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Төлөвлөгөөний төлөв хадгалагдсангүй.');
    }
  };

  const evaluationSummary = useMemo(() => {
    const summary = new Map<string, { levels: Record<string, number>; students: number; weightedScore: number; entries: number }>();
    for (const record of records) {
      for (const evaluation of record.evaluations) {
        const grade = Number(evaluation.grade);
        const section = String(evaluation.section ?? '').trim();
        const subject = String(evaluation.subject ?? '').trim();
        const studentsCount = Number(evaluation.students_count);
        const averageScore = Number(evaluation.average_score);
        if (
          !Number.isInteger(grade) ||
          !section ||
          !subject ||
          !evaluationLevels.includes(evaluation.level as typeof evaluationLevels[number]) ||
          !Number.isFinite(studentsCount) ||
          studentsCount < 0 ||
          !Number.isFinite(averageScore)
        ) continue;
        const key = `${grade}-${section}-${subject}`;
        const current = summary.get(key) ?? { levels: {}, students: 0, weightedScore: 0, entries: 0 };
        summary.set(key, {
          levels: { ...current.levels, [evaluation.level]: (current.levels[evaluation.level] ?? 0) + studentsCount },
          students: current.students + studentsCount,
          weightedScore: current.weightedScore + averageScore * studentsCount,
          entries: current.entries + 1,
        });
      }
    }
    return [...summary.entries()]
      .map(([key, value]) => {
        const [grade, section, ...subjectParts] = key.split('-');
        return {
          grade: Number(grade),
          section,
          subject: subjectParts.join('-'),
          ...value,
          average: value.students ? value.weightedScore / value.students : 0,
        };
      })
      .sort((first, second) => first.grade - second.grade || first.section.localeCompare(second.section) || first.subject.localeCompare(second.subject));
  }, [records]);

  const bandSummary = useMemo(() => {
    const band = gradeBands.find((item) => item.id === selectedBand) ?? gradeBands[0];
    return evaluationSummary.filter((item) => item.grade >= band.min && item.grade <= band.max);
  }, [evaluationSummary, selectedBand]);

  const subjectsInBand = useMemo(
    () => [...new Set(bandSummary.map((item) => item.subject))].sort((first, second) => first.localeCompare(second)),
    [bandSummary]
  );

  const activeSubject = subjectsInBand.includes(selectedSubject) ? selectedSubject : (subjectsInBand[0] ?? '');
  const activeSubjectSummary = bandSummary.filter((item) => item.subject === activeSubject);
  const activeSubjectTotals = useMemo(() => ({
    levels: Object.fromEntries(evaluationLevels.map((level) => [
      level,
      activeSubjectSummary.reduce((total, item) => total + (item.levels[level] ?? 0), 0),
    ])) as Record<string, number>,
    students: activeSubjectSummary.reduce((total, item) => total + item.students, 0),
    average: (() => {
      const students = activeSubjectSummary.reduce((total, item) => total + item.students, 0);
      const weightedScore = activeSubjectSummary.reduce((total, item) => total + item.average * item.students, 0);
      return students ? weightedScore / students : 0;
    })(),
  }), [activeSubjectSummary]);

  if (loading) return <p>Материал ачаалж байна...</p>;

  return (
    <section>
      <h2 style={{ marginTop: 0 }}>{summaryOnly ? 'Үнэлгээний нэгтгэл' : 'Багшийн материал хянах'}</h2>
      {errorMessage && <p role="alert" style={{ color: '#b91c1c' }}>{errorMessage}</p>}
      {summaryOnly && <section style={{ padding: 10, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8 }}>
        <h3 style={{ margin: '0 0 8px', fontSize: 16 }}>Хичээл бүрийн нэгтгэл (бүх анги)</h3>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
          {gradeBands.map((band) => (
            <button key={band.id} type="button" onClick={() => { setSelectedBand(band.id); setSelectedSubject(''); }} style={tabButton(selectedBand === band.id)}>
              {band.label}
            </button>
          ))}
        </div>
        {subjectsInBand.length === 0 ? <p style={{ margin: 0 }}>Энэ түвшинд үнэлгээ оруулаагүй байна.</p> : (
          <>
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 8 }}>
              {subjectsInBand.map((subject) => (
                <button key={subject} type="button" onClick={() => setSelectedSubject(subject)} style={subjectTabButton(activeSubject === subject)}>
                  {subject}
                </button>
              ))}
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 12 }}>
                <thead><tr>{['Анги', 'VIII', 'VII', 'VI', 'V', 'IV', 'III', 'II', 'I', 'Нийт', 'Дундаж'].map((label) => <th key={label} style={{ padding: '4px 6px', background: '#fff' }}>{label}</th>)}</tr></thead>
                <tbody>{activeSubjectSummary.map((item) => (
                  <tr key={`${item.grade}-${item.section}-${item.subject}`} style={{ borderTop: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '4px 6px', fontWeight: 600 }}>{item.grade}-{item.section}</td>
                    {evaluationLevels.map((level) => <td key={level} style={{ padding: '4px 6px' }}>{item.levels[level] ?? 0}</td>)}
                    <td style={{ padding: '4px 6px' }}>{item.students}</td>
                    <td style={{ padding: '4px 6px' }}>{item.average.toFixed(1)}</td>
                  </tr>
                ))}
                <tr style={{ borderTop: '2px solid #94a3b8', background: '#e2e8f0', fontWeight: 700 }}>
                  <td style={{ padding: '4px 6px' }}>Нэгтгэл</td>
                  {evaluationLevels.map((level) => <td key={level} style={{ padding: '4px 6px' }}>{activeSubjectTotals.levels[level]}</td>)}
                  <td style={{ padding: '4px 6px' }}>{activeSubjectTotals.students}</td>
                  <td style={{ padding: '4px 6px' }}>{activeSubjectTotals.average.toFixed(1)}</td>
                </tr>
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>}
      {!summaryOnly && records.length === 0 && <p>Багшийн материал алга.</p>}
      {!summaryOnly && <div style={{ display: 'grid', gap: 16 }}>
        {records.map((record) => (
          <article key={record.user_id} style={{ padding: 16, border: '1px solid #e2e8f0', borderRadius: 8 }}>
            <h3 style={{ margin: '0 0 4px' }}>{record.teacher.name}</h3>
            <p style={{ margin: '0 0 12px', color: '#64748b' }}>{record.teacher.email} · {record.teacher.unit} · {record.teacher.subject}</p>
            <div style={{ padding: 12, background: '#f8fafc', borderRadius: 6 }}>
              <strong>Хөтөлбөр, төлөвлөгөө</strong>
              {!record.program_plan ? <p>Материал ирээгүй.</p> : (
                <>
                  <p><FileAttachmentActions attachment={{ name: 'Хөтөлбөр, төлөвлөгөө.pdf', url: record.program_plan.documentUrl, file_type: 'document' }} /></p>
                  {(record.program_plan.grade || record.program_plan.section || record.program_plan.subject) && <p>{record.program_plan.grade}-р анги {record.program_plan.section} бүлэг · {record.program_plan.subject}</p>}
                  {record.program_plan.note && <p>{record.program_plan.note}</p>}
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input type="checkbox" checked={record.program_plan.approved} onChange={(event) => void reviewPlan(record.user_id, event.target.checked)} />
                    Баталсан
                  </label>
                </>
              )}
            </div>
            <h4>Түвшний үнэлгээ</h4>
            {record.evaluations.length === 0 ? <p>Үнэлгээ оруулаагүй.</p> : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead><tr>{['Анги', 'Хичээл', 'Түвшин', 'Үнэлэгдсэн', 'Дундаж', 'Огноо'].map((label) => <th key={label} style={{ padding: 8 }}>{label}</th>)}</tr></thead>
                  <tbody>{record.evaluations.map((evaluation) => (
                    <tr key={evaluation.id} style={{ borderTop: '1px solid #e2e8f0' }}>
                      <td style={{ padding: 8 }}>{romanGrade(evaluation.grade)}-{evaluation.section}</td>
                      <td style={{ padding: 8 }}>{evaluation.subject}</td>
                      <td style={{ padding: 8 }}>{evaluation.level}</td>
                      <td style={{ padding: 8 }}>{evaluation.students_count}</td>
                      <td style={{ padding: 8 }}>{evaluation.average_score}</td>
                      <td style={{ padding: 8 }}>{evaluation.evaluation_date}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            )}
          </article>
        ))}
      </div>}
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
