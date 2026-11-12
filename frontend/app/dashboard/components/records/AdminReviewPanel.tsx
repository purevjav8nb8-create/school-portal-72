'use client';

import { useEffect, useMemo, useState } from 'react';
import { PenLine } from 'lucide-react';
import { backendBaseUrl, fetchWithAuth } from '../../../../lib/backendApi';
import { supabase } from '../../../../lib/supabaseClient';
import LosslessCloudinaryUpload, { uploadCloudinaryFile } from '../../../../components/LosslessCloudinaryUpload';
import FileAttachmentActions from './FileAttachmentActions';
import { formatTeacherName } from '../../utils/teacherName';

const apiUrl = backendBaseUrl;
const evaluationLevels = ['VIII', 'VII', 'VI', 'V', 'IV', 'III', 'II', 'I'] as const;
const gradeBands = [
  { id: 'all', label: 'Бүгд', min: 1, max: 12 },
  { id: 'primary', label: 'Бага (1–5)', min: 1, max: 5 },
  { id: 'middle', label: 'Дунд (6–9)', min: 6, max: 9 },
  { id: 'high', label: 'Ахлах (10–12)', min: 10, max: 12 },
] as const;
type GradeBand = (typeof gradeBands)[number]['id'];

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
  program_plan?: { documentUrl: string; note: string; grade?: number; section?: string; subject?: string; approved: boolean; returned?: boolean; review_status?: 'pending' | 'returned' | 'approved'; submittedAt: string };
  activities: Activity[];
  awards: { id: string; name: string; certificate_number: string; certificate_url: string; organization?: string; status?: string; application_url?: string; meeting_minutes_url?: string; reference_url?: string; justification?: string; awarded_date?: string }[];
  professional_degrees: { id: string; name: string; certificate_number: string; certificate_url: string; status: string; issued_date?: string }[];
  evaluations: { id: string; grade: number; section: string; subject: string; level: string; students_count: number; average_score: number; evaluation_date: string }[];
};

interface Props {
  summaryOnly?: boolean;
  selectedBand: GradeBand;
  setSelectedBand: (band: GradeBand) => void;
  selectedSubject: string;
  setSelectedSubject: (subject: string) => void;
}

export default function AdminReviewPanel({
  summaryOnly = false,
  selectedBand,
  setSelectedBand,
  selectedSubject,
  setSelectedSubject,
}: Props) {
  const [records, setRecords] = useState<TeacherRecords[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [approvalAssets, setApprovalAssets] = useState({ signature_url: '', stamp_url: '' });
  const [approvalAssetsDraft, setApprovalAssetsDraft] = useState({ signature_url: '', stamp_url: '' });
  const [approvalAssetsOpen, setApprovalAssetsOpen] = useState(false);
  const [savingApprovalAssets, setSavingApprovalAssets] = useState(false);
  const [reviewingPlan, setReviewingPlan] = useState('');

  const request = async (path: string, method = 'GET', body?: object) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Дахин нэвтэрнэ үү.');
    const response = await fetchWithAuth(`${apiUrl}${path}`, {
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
        evaluations: Array.isArray(record.evaluations) ? record.evaluations.filter((evaluation) => {
          const grade = Number(evaluation.grade);
          const studentsCount = Number(evaluation.students_count);
          const averageScore = Number(evaluation.average_score);
          return Number.isInteger(grade)
            && grade > 0
            && String(evaluation.section ?? '').trim().length > 0
            && String(evaluation.subject ?? '').trim().length > 0
            && evaluationLevels.includes(evaluation.level as typeof evaluationLevels[number])
            && Number.isFinite(studentsCount)
            && studentsCount > 0
            && Number.isFinite(averageScore);
        }) : [],
        awards: Array.isArray(record.awards) ? record.awards : [],
        professional_degrees: Array.isArray(record.professional_degrees) ? record.professional_degrees : [],
      })) : []);
      setErrorMessage('');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Материал уншигдсангүй.');
    } finally {
      setLoading(false);
    }
  };

  const loadApprovalAssets = async () => {
    try {
      const assets = await request('/api/teachers/review/program-plan/approval-assets');
      setApprovalAssets(assets);
      setApprovalAssetsDraft(assets);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Гарын үсэг, тамганы тохиргоо уншигдсангүй.');
    }
  };

  useEffect(() => {
    void loadRecords();
    if (!summaryOnly) void loadApprovalAssets();
  }, []);

  const saveApprovalAssets = async () => {
    if (!approvalAssetsDraft.signature_url || !approvalAssetsDraft.stamp_url) {
      setErrorMessage('Гарын үсэг, тамганы зургийг хоёуланг нь оруулна уу.');
      return;
    }
    setSavingApprovalAssets(true);
    try {
      const saved = await request('/api/teachers/review/program-plan/approval-assets', 'PUT', approvalAssetsDraft);
      setApprovalAssets(saved);
      setApprovalAssetsDraft(saved);
      setApprovalAssetsOpen(false);
      setErrorMessage('');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Гарын үсэг, тамга хадгалагдсангүй.');
    } finally {
      setSavingApprovalAssets(false);
    }
  };

  const reviewPlan = async (userId: string, approved: boolean) => {
    if (approved && (!approvalAssets.signature_url || !approvalAssets.stamp_url)) {
      setErrorMessage('Батлахын өмнө хянах хуудасны гарын үсэг, тамганы тохиргоог хадгална уу.');
      return;
    }
    setReviewingPlan(userId);
    try {
      let signedDocumentUrl: string | undefined;
      if (approved) {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error('Дахин нэвтэрнэ үү.');
        const response = await fetchWithAuth(`${apiUrl}/api/teachers/review/${userId}/program-plan/approved-pdf`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            signature_url: approvalAssets.signature_url,
            stamp_url: approvalAssets.stamp_url,
          }),
        });
        if (!response.ok) {
          const result = await response.json();
          throw new Error(result.detail ?? 'PDF-д гарын үсэг, тамга нэгтгэсэнгүй.');
        }
        const pdf = new File([await response.blob()], `approved-program-plan-${userId}.pdf`, { type: 'application/pdf' });
        const uploaded = await uploadCloudinaryFile(pdf, ['pdf']);
        signedDocumentUrl = uploaded.url;
      }
      await request(`/api/teachers/review/${userId}/program-plan`, 'PATCH', {
        approved,
        ...(signedDocumentUrl ? { signed_document_url: signedDocumentUrl } : {}),
      });
      await loadRecords();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Төлөвлөгөөний төлөв хадгалагдсангүй.');
    } finally {
      setReviewingPlan('');
    }
  };

  const deletePlan = async (userId: string) => {
    if (!window.confirm('Энэ багшийн хөтөлбөр, төлөвлөгөөг устгах уу?')) return;
    setReviewingPlan(userId);
    try {
      await request(`/api/teachers/review/${userId}/program-plan`, 'DELETE');
      setErrorMessage('');
      await loadRecords();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Хөтөлбөр, төлөвлөгөө устгагдсангүй.');
    } finally {
      setReviewingPlan('');
    }
  };

  const returnPlan = async (userId: string) => {
    if (!window.confirm('Энэ хөтөлбөр, төлөвлөгөөг засуулахаар багшид буцаах уу?')) return;
    setReviewingPlan(userId);
    try {
      const result = await request(`/api/teachers/review/${userId}/program-plan/return`, 'POST');
      setErrorMessage('');
      setRecords((current) => current.map((record) => record.user_id === userId
        ? { ...record, program_plan: result.program_plan }
        : record));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Хөтөлбөр, төлөвлөгөөг буцааж чадсангүй.');
    } finally {
      setReviewingPlan('');
    }
  };

  const evaluationSummary = useMemo(() => {
    const summary = new Map<string, { levels: Record<string, number>; students: number; weightedScore: number; entries: number; teachers: Map<string, { name: string; email: string }> }>();
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
        const current = summary.get(key) ?? { levels: {}, students: 0, weightedScore: 0, entries: 0, teachers: new Map<string, { name: string; email: string }>() };
        const teacherId = record.user_id || record.teacher.email || record.teacher.name;
        current.teachers.set(teacherId, { name: formatTeacherName(record.teacher.name), email: record.teacher.email });
        summary.set(key, {
          levels: { ...current.levels, [evaluation.level]: (current.levels[evaluation.level] ?? 0) + studentsCount },
          students: current.students + studentsCount,
          weightedScore: current.weightedScore + averageScore * studentsCount,
          entries: current.entries + 1,
          teachers: current.teachers,
        });
      }
    }
    return [...summary.entries()]
      .map(([key, value]) => {
        const [grade, section, ...subjectParts] = key.split('-');
        const teachers = [...value.teachers.values()];
        const teacherNameCounts = new Map<string, number>();
        teachers.forEach((teacher) => teacherNameCounts.set(teacher.name, (teacherNameCounts.get(teacher.name) ?? 0) + 1));
        return {
          grade: Number(grade),
          section,
          subject: subjectParts.join('-'),
          ...value,
          teacherNames: teachers.map((teacher) => teacherNameCounts.get(teacher.name) > 1 ? `${teacher.name} (${teacher.email})` : teacher.name).join(', '),
          teacherCount: value.teachers.size,
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

  const activeSubject = subjectsInBand.includes(selectedSubject) ? selectedSubject : '';
  const activeSubjectSummary = activeSubject
    ? bandSummary.filter((item) => item.subject === activeSubject)
    : bandSummary;
  const submittedRecords = records.filter((record) => (
    record.program_plan
    && !record.program_plan.returned
    && record.program_plan.review_status !== 'returned'
  ));
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
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
        <h2 style={{ marginTop: 0 }}>{summaryOnly ? 'Үнэлгээний нэгтгэл' : 'Багшийн материал хянах'}</h2>
        {!summaryOnly && <button type="button" aria-label="Гарын үсэг, тамганы тохиргоо" title="Гарын үсэг, тамганы тохиргоо" onClick={() => { setApprovalAssetsDraft(approvalAssets); setApprovalAssetsOpen(true); }} style={{ display: 'grid', placeItems: 'center', width: 36, height: 36, border: '1px solid #cbd5e1', borderRadius: 9, background: '#fff', color: '#1d4ed8', cursor: 'pointer' }}>
          <PenLine size={18} />
        </button>}
      </header>
      {errorMessage && <p role="alert" style={{ color: '#b91c1c' }}>{errorMessage}</p>}
      {approvalAssetsOpen && <div role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setApprovalAssetsOpen(false); }} style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'grid', placeItems: 'center', padding: 16, background: 'rgba(15,23,42,.5)' }}>
        <section role="dialog" aria-modal="true" aria-label="Гарын үсэг, тамганы тохиргоо" style={{ width: 'min(460px,100%)', display: 'grid', gap: 14, padding: 20, borderRadius: 14, background: '#fff', boxShadow: '0 24px 70px rgba(15,23,42,.3)' }}>
          <h3 style={{ margin: 0, color: '#172554' }}>Гарын үсэг, тамганы тохиргоо</h3>
          <LosslessCloudinaryUpload label="Гарын үсэг (PNG/JPG)" formats={['png', 'jpg', 'jpeg']} onUploaded={(file) => setApprovalAssetsDraft((current) => ({ ...current, signature_url: file.url }))} />
          {approvalAssetsDraft.signature_url && <a href={approvalAssetsDraft.signature_url} target="_blank" rel="noreferrer">Оруулсан гарын үсгийг харах</a>}
          <LosslessCloudinaryUpload label="Тамга (PNG/JPG)" formats={['png', 'jpg', 'jpeg']} onUploaded={(file) => setApprovalAssetsDraft((current) => ({ ...current, stamp_url: file.url }))} />
          {approvalAssetsDraft.stamp_url && <a href={approvalAssetsDraft.stamp_url} target="_blank" rel="noreferrer">Оруулсан тамгыг харах</a>}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button type="button" onClick={() => setApprovalAssetsOpen(false)} style={{ padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: 8, background: '#fff', cursor: 'pointer' }}>Болих</button>
            <button type="button" disabled={savingApprovalAssets || !approvalAssetsDraft.signature_url || !approvalAssetsDraft.stamp_url} onClick={() => void saveApprovalAssets()} style={{ padding: '8px 12px', border: 0, borderRadius: 8, background: savingApprovalAssets ? '#94a3b8' : '#2563eb', color: '#fff', fontWeight: 700, cursor: savingApprovalAssets ? 'wait' : 'pointer' }}>{savingApprovalAssets ? 'Хадгалж байна...' : 'Хадгалах'}</button>
          </div>
        </section>
      </div>}
      {summaryOnly && <section style={{ padding: 10, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8 }}>
        <h3 style={{ margin: '0 0 8px', fontSize: 16 }}>Хичээлийн нэгтгэл</h3>
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
              <button type="button" onClick={() => setSelectedSubject('')} style={subjectTabButton(!activeSubject)}>
                Бүх хичээл
              </button>
              {subjectsInBand.map((subject) => (
                <button key={subject} type="button" onClick={() => setSelectedSubject(subject)} style={subjectTabButton(activeSubject === subject)}>
                  {subject}
                </button>
              ))}
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 12 }}>
                <thead><tr>{['Анги', ...(!activeSubject ? ['Хичээл'] : []), 'VIII', 'VII', 'VI', 'V', 'IV', 'III', 'II', 'I', 'Нийт', 'Дундаж', 'Багш (тоо)'].map((label) => <th key={label} style={{ padding: '4px 6px', background: '#fff' }}>{label}</th>)}</tr></thead>
                <tbody>{activeSubjectSummary.map((item) => (
                  <tr key={`${item.grade}-${item.section}-${item.subject}`} style={{ borderTop: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '4px 6px', fontWeight: 600 }}>{item.grade}-{item.section}</td>
                    {!activeSubject && <td style={{ padding: '4px 6px' }}>{item.subject}</td>}
                    {evaluationLevels.map((level) => <td key={level} style={{ padding: '4px 6px' }}>{item.levels[level] ?? 0}</td>)}
                    <td style={{ padding: '4px 6px' }}>{item.students}</td>
                    <td style={{ padding: '4px 6px' }}>{item.average.toFixed(1)}</td>
                    <td style={{ padding: '4px 6px' }}>{item.teacherNames}{item.teacherCount > 0 ? ` (${item.teacherCount})` : ''}</td>
                  </tr>
                ))}
                <tr style={{ borderTop: '2px solid #94a3b8', background: '#e2e8f0', fontWeight: 700 }}>
                  <td style={{ padding: '4px 6px' }}>Нэгтгэл</td>
                  {!activeSubject && <td style={{ padding: '4px 6px' }} />}
                  {evaluationLevels.map((level) => <td key={level} style={{ padding: '4px 6px' }}>{activeSubjectTotals.levels[level]}</td>)}
                  <td style={{ padding: '4px 6px' }}>{activeSubjectTotals.students}</td>
                  <td style={{ padding: '4px 6px' }}>{activeSubjectTotals.average.toFixed(1)}</td>
                  <td style={{ padding: '4px 6px' }} />
                </tr>
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>}
      {!summaryOnly && submittedRecords.length === 0 && <p>Илгээсэн материал алга.</p>}
      {!summaryOnly && <div style={{ display: 'grid', gap: 8 }}>
        {submittedRecords.map((record) => (
          <article key={record.user_id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: 9, border: '1px solid #e2e8f0', borderRadius: 8, background: '#fff' }}>
            <div style={{ flex: '0 0 112px', minWidth: 0 }}>
              <FileAttachmentActions attachment={{ name: 'Хөтөлбөр, төлөвлөгөө.pdf', url: record.program_plan.documentUrl, file_type: 'document' }} inlinePreview previewWidth={112} previewHeight={104} />
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <small style={{ color: '#047857' }}>Хянах · Хөтөлбөр, төлөвлөгөө</small>
              <h3 style={{ margin: '2px 0 3px', color: '#0f172a', fontSize: 16 }}>{formatTeacherName(record.teacher.name)}</h3>
              <small style={{ color: '#64748b' }}>{record.teacher.email} · {record.teacher.unit} · {record.teacher.subject}</small>
              {(record.program_plan.grade || record.program_plan.section || record.program_plan.subject) && <p style={{ margin: '7px 0 3px', color: '#475569' }}>{record.program_plan.grade}-р анги {record.program_plan.section} бүлэг · {record.program_plan.subject}</p>}
              {record.program_plan.note && <p style={{ margin: '5px 0', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{record.program_plan.note}</p>}
              {record.program_plan.returned && <strong style={{ color: '#b91c1c' }}>Засуулахаар буцаасан</strong>}
              {record.program_plan.submittedAt && <small style={{ display: 'block', marginTop: 6, color: '#64748b' }}>{new Date(record.program_plan.submittedAt).toLocaleString('mn-MN')} · {formatTeacherName(record.teacher.name)}</small>}
              <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                {record.program_plan.approved && <strong style={{ color: '#15803d' }}>Батлагдсан</strong>}
                <button
                  type="button"
                  disabled={reviewingPlan === record.user_id || (!record.program_plan.approved && (!approvalAssets.signature_url || !approvalAssets.stamp_url))}
                  onClick={() => void reviewPlan(record.user_id, !record.program_plan.approved)}
                  style={{ padding: '7px 12px', border: 0, borderRadius: 7, background: record.program_plan.approved ? '#64748b' : '#15803d', color: '#fff', fontWeight: 700, cursor: 'pointer' }}
                >
                  {reviewingPlan === record.user_id ? 'Хадгалж байна...' : record.program_plan.approved ? 'Баталгааг цуцлах' : 'Батлах'}
                </button>
                {!record.program_plan.approved && !record.program_plan.returned && <button
                  type="button"
                  disabled={reviewingPlan === record.user_id}
                  onClick={() => void returnPlan(record.user_id)}
                  style={{ padding: '7px 12px', border: 0, borderRadius: 7, background: reviewingPlan === record.user_id ? '#cbd5e1' : '#d97706', color: '#fff', fontWeight: 700, cursor: reviewingPlan === record.user_id ? 'not-allowed' : 'pointer' }}
                >
                  {reviewingPlan === record.user_id ? 'Буцааж байна...' : 'Багшид буцаах'}
                </button>}
                <button
                  type="button"
                  disabled={reviewingPlan === record.user_id}
                  onClick={() => void deletePlan(record.user_id)}
                  style={{ padding: '7px 12px', border: 0, borderRadius: 7, background: reviewingPlan === record.user_id ? '#cbd5e1' : '#dc2626', color: '#fff', fontWeight: 700, cursor: reviewingPlan === record.user_id ? 'not-allowed' : 'pointer' }}
                >
                  {reviewingPlan === record.user_id ? 'Хадгалж байна...' : 'Устгах'}
                </button>
              </div>
            {(record.awards.length > 0 || record.professional_degrees.length > 0) && <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid #e2e8f0' }}>
              <strong>Шагнал, мэргэжлийн зэрэг</strong>
              {record.awards.map((award) => <div key={award.id} style={{ margin: '6px 0' }}>
                <p style={{ margin: '2px 0' }}>Шагнал: {award.name}{award.certificate_number && ` · №${award.certificate_number}`} {award.organization && `· ${award.organization}`} {award.status === 'Хүсэлт' ? '· Хүсэлт' : null}</p>
                {award.justification && <p style={{ margin: '2px 0' }}>Үндэслэл: {award.justification}</p>}
                {award.certificate_url && <FileAttachmentActions attachment={{ name: 'Үнэмлэх PDF', url: award.certificate_url, file_type: 'document' }} />}
                {award.application_url && <FileAttachmentActions attachment={{ name: 'Анкет PDF', url: award.application_url, file_type: 'document' }} />}
                {award.meeting_minutes_url && <FileAttachmentActions attachment={{ name: 'Хамт олны хурлын протокол PDF', url: award.meeting_minutes_url, file_type: 'document' }} />}
                {award.reference_url && <FileAttachmentActions attachment={{ name: 'Тодорхойлолт PDF', url: award.reference_url, file_type: 'document' }} />}
              </div>)}
              {record.professional_degrees.map((degree) => <p key={degree.id} style={{ margin: '6px 0' }}>Зэрэг: {degree.name}{degree.certificate_number && ` · №${degree.certificate_number}`} · {degree.status} {degree.certificate_url && <FileAttachmentActions attachment={{ name: 'Үнэмлэх PDF', url: degree.certificate_url, file_type: 'document' }} />}</p>)}
            </div>}
            </div>
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
