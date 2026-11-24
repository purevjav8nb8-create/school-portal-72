'use client';

import { ChangeEvent, useEffect, useMemo, useState } from 'react';
import { Eye, Trash2 } from 'lucide-react';
import { schoolMonth } from '../../../lib/schoolDate';
import {
  AcademicTerm,
  AcademicYear,
  OvertimeReport,
  ScheduleStatus,
  downloadScheduleTemplate,
  downloadSavedSchedule as downloadSavedScheduleFile,
  deleteAcademicYear,
  getOvertimeReport,
  getScheduleStatus,
  importSchedule,
  listAcademicYears,
  saveAcademicYear,
  saveSubstituteHours,
} from './schoolScheduleApi';
import { createDefaultYear, gradeScopeText, parseGradeScope } from './academicScheduleUtils';
import SchedulePreviewModal from './SchedulePreviewModal';

function errorText(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export default function AcademicSchedulePanel() {
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [draft, setDraft] = useState<AcademicYear>(() => createDefaultYear(2026));
  const [scopeDraft, setScopeDraft] = useState<Record<string, string>>({});
  const [yearText, setYearText] = useState('2026');
  const [month, setMonth] = useState(schoolMonth);
  const [termStatuses, setTermStatuses] = useState<Record<string, ScheduleStatus>>({});
  const [report, setReport] = useState<OvertimeReport | null>(null);
  const [loadingYears, setLoadingYears] = useState(true);
  const [savingYear, setSavingYear] = useState(false);
  const [deletingYear, setDeletingYear] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [savingSubstitutes, setSavingSubstitutes] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [selectedTermId, setSelectedTermId] = useState('');
  const [previewTermId, setPreviewTermId] = useState('');

  const savedYear = years.find((item) => item.academic_year === draft.academic_year);
  const yearChoices = useMemo(() => {
    const values = new Set(years.map((item) => item.academic_year));
    if (!values.has(draft.academic_year)) values.add(draft.academic_year);
    return [...values].sort((first, second) => second.localeCompare(first));
  }, [draft.academic_year, years]);

  useEffect(() => {
    let active = true;
    void listAcademicYears()
      .then((result) => {
        if (!active) return;
        setYears(result);
        if (result.length) {
          setDraft(result[0]);
          setYearText(result[0].academic_year.split('-')[0]);
        }
      })
      .catch((error: unknown) => {
        if (active) setErrorMessage(errorText(error, 'Хичээлийн жилүүд уншигдсангүй.'));
      })
      .finally(() => {
        if (active) setLoadingYears(false);
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!savedYear) {
      setTermStatuses({});
      setReport(null);
      return;
    }
    let active = true;
    if (!selectedTermId && draft.terms.length) {
      setSelectedTermId(draft.terms[0].id);
    }
    setTermStatuses({});
    setReport(null);
    void Promise.all(draft.terms.map(async (term) => {
      try {
        return [term.id, await getScheduleStatus(draft.academic_year, term.id)] as const;
      } catch (error) {
        if (active) setErrorMessage(errorText(error, 'Хуваарийн төлөв уншигдсангүй.'));
        return [term.id, null] as const;
      }
    })).then((results) => {
      if (!active) return;
      setTermStatuses(Object.fromEntries(
        results.filter((item): item is readonly [string, ScheduleStatus] => item[1] !== null),
      ));
    });
    return () => { active = false; };
  }, [draft.academic_year, draft.terms, savedYear, selectedTermId]);

  useEffect(() => {
    const firstMonth = draft.start_date.slice(0, 7);
    const lastMonth = draft.end_date.slice(0, 7);
    if (firstMonth && lastMonth && (month < firstMonth || month > lastMonth)) {
      setMonth(firstMonth);
      setReport(null);
    }
  }, [draft.start_date, draft.end_date, month]);

  const chooseYear = (academicYear: string) => {
    const existing = years.find((item) => item.academic_year === academicYear);
    const next = existing ?? createDefaultYear(Number(academicYear.split('-')[0]));
    setDraft(next);
    setSelectedTermId(next.terms[0]?.id ?? '');
    setScopeDraft({});
    setTermStatuses({});
    setYearText(academicYear.split('-')[0]);
    setErrorMessage('');
    setSuccessMessage('');
  };

  const createYear = () => {
    const startYear = Number(yearText);
    if (!/^\d{4}$/.test(yearText) || startYear < 1900 || startYear >= 2200) {
      setErrorMessage('Хичээлийн жилийн эхлэх оныг зөв оруулна уу.');
      return;
    }
    chooseYear(`${startYear}-${startYear + 1}`);
  };

  const updateTerm = (termId: string, updates: Partial<AcademicTerm>) => {
    setDraft((current) => ({
      ...current,
      terms: current.terms.map((term) => term.id === termId ? { ...term, ...updates } : term),
    }));
  };

  const updateTermGrades = (termId: string, value: string) => {
    setScopeDraft((current) => ({ ...current, [termId]: value }));
    setErrorMessage('');
  };

  const saveYear = async () => {
    let structure: AcademicYear;
    try {
      structure = {
        ...draft,
        terms: draft.terms.map((term) => ({
          ...term,
          grades: parseGradeScope(scopeDraft[term.id] ?? gradeScopeText(term.grades)),
        })),
      };
    } catch (error) {
      setErrorMessage(errorText(error, 'Ангиудын хүрээ буруу байна.'));
      return;
    }
    setSavingYear(true);
    setErrorMessage('');
    setSuccessMessage('');
    try {
      const saved = await saveAcademicYear(structure);
      setYears((current) => [
        ...current.filter((item) => item.academic_year !== saved.academic_year),
        saved,
      ].sort((first, second) => second.start_date.localeCompare(first.start_date)));
      setDraft(saved);
      setSelectedTermId((current) => saved.terms.some((term) => term.id === current) ? current : saved.terms[0]?.id ?? '');
      setScopeDraft({});
      setSuccessMessage(`${saved.academic_year} оны хичээлийн жилийн бүтэц хадгалагдлаа.`);
    } catch (error) {
      setErrorMessage(errorText(error, 'Хичээлийн жилийн бүтэц хадгалагдсангүй.'));
    } finally {
      setSavingYear(false);
    }
  };

  const removeYear = async () => {
    if (!savedYear || savingYear || deletingYear) return;
    const academicYear = savedYear.academic_year;
    const confirmed = window.confirm(
      `${academicYear} хичээлийн жилийг устгах уу? Тухайн жилийн хуваарь болон орлон цагийн бүртгэл хамт устна. Энэ үйлдлийг буцаах боломжгүй.`,
    );
    if (!confirmed) return;

    setDeletingYear(true);
    setErrorMessage('');
    setSuccessMessage('');
    try {
      await deleteAcademicYear(academicYear);
      const remainingYears = years.filter((item) => item.academic_year !== academicYear);
      setYears(remainingYears);
      const next = remainingYears[0] ?? createDefaultYear(Number(academicYear.split('-')[0]));
      setDraft(next);
      setScopeDraft({});
      setYearText(next.academic_year.split('-')[0]);
      setSuccessMessage(`${academicYear} хичээлийн жил болон холбогдох өгөгдөл устгагдлаа.`);
    } catch (error) {
      setErrorMessage(errorText(error, 'Хичээлийн жилийг устгаж чадсангүй.'));
    } finally {
      setDeletingYear(false);
    }
  };

  const downloadTemplate = async () => {
    setDownloading(true);
    setErrorMessage('');
    try {
      const blob = await downloadScheduleTemplate(draft.academic_year);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'teacher_schedule_template.xlsx';
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      setErrorMessage(errorText(error, 'Хуваарийн загварыг татаж чадсангүй.'));
    } finally {
      setDownloading(false);
    }
  };

  const downloadSavedSchedule = async (termId?: string) => {
    setDownloading(true);
    setErrorMessage('');
    try {
      const blob = await downloadSavedScheduleFile(draft.academic_year, termId);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${draft.academic_year}_teacher_schedule.xlsx`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      setErrorMessage(errorText(error, 'Хадгалагдсан хуваарийг татаж чадсангүй.'));
    } finally {
      setDownloading(false);
    }
  };

  const uploadSchedule = async (event: ChangeEvent<HTMLInputElement>, termId?: string) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !savedYear) return;
    const targetTermId = termId || selectedTermId || undefined;
    if (targetTermId) setSelectedTermId(targetTermId);
    setUploading(true);
    setErrorMessage('');
    setSuccessMessage('');
    try {
      const result = await importSchedule(draft.academic_year, file, targetTermId);
      const homeroomSummary = result.homeroom_teachers
        ? ` ${result.homeroom_teachers} багшийн даасан ангийн мэдээлэл шинэчлэгдлээ (${result.homeroom_classes} анги).`
        : '';
      const importedMessage = `${result.teachers} багшийн ${result.imported_lessons} хичээлийн цаг импортлогдлоо.${homeroomSummary} Өмнөх хуваарь бүхэлдээ шинэчлэгдсэн.`;
      setSuccessMessage(importedMessage);
      try {
        if (targetTermId) {
          const status = await getScheduleStatus(draft.academic_year, targetTermId);
          setTermStatuses((current) => ({ ...current, [targetTermId]: status }));
        }
      } catch (error) {
        const detail = errorText(error, 'Хуваарийн төлөв шинэчлэгдсэнгүй.');
        setErrorMessage(detail);
      }
      await calculateReport();
    } catch (error) {
      const detail = errorText(error, 'Хуваарийн файл импортлогдсонгүй.');
      setErrorMessage(detail);
      try {
        const status = await getScheduleStatus(draft.academic_year, targetTermId);
        if (targetTermId) setTermStatuses((current) => ({ ...current, [targetTermId]: status }));
      } catch (statusError) {
        const statusDetail = errorText(statusError, 'Хуваарийн төлөв уншигдсангүй.');
        setErrorMessage(`${detail} ${statusDetail}`);
      }
    } finally {
      setUploading(false);
    }
  };

  const calculateReport = async () => {
    if (!savedYear) {
      setErrorMessage('Эхлээд хичээлийн жилийн бүтцийг хадгална уу.');
      return;
    }
    setCalculating(true);
    setErrorMessage('');
    try {
      setReport(await getOvertimeReport(draft.academic_year, month));
    } catch (error) {
      setErrorMessage(errorText(error, 'Сарын цагийн тооцоолол хийгдсэнгүй.'));
    } finally {
      setCalculating(false);
    }
  };

  const saveSubstitutes = async () => {
    if (!report) return;
    setSavingSubstitutes(true);
    setErrorMessage('');
    setSuccessMessage('');
    try {
      await saveSubstituteHours(draft.academic_year, report.month, report.teachers);
      setSuccessMessage('Орлон заасан цаг хадгалагдаж, тооцоолол шинэчлэгдлээ.');
      setReport(await getOvertimeReport(draft.academic_year, report.month));
    } catch (error) {
      setErrorMessage(errorText(error, 'Орлон заасан цаг хадгалагдсангүй.'));
    } finally {
      setSavingSubstitutes(false);
    }
  };

  const setSubstituteHours = (teacherId: string, value: number) => {
    setReport((current) => current && ({
      ...current,
      teachers: current.teachers.map((teacher) => teacher.teacher_id === teacherId
        ? {
          ...teacher,
          substitute_hours: value,
          actual_hours: teacher.active_workdays ? teacher.scheduled_hours + value : 0,
          overtime_hours: Math.max(0, (teacher.active_workdays ? teacher.scheduled_hours + value : 0) - teacher.norm_hours),
        }
        : teacher),
    }));
  };

  const previewTerm = draft.terms.find((term) => term.id === previewTermId);
  const previewStatus = previewTermId ? termStatuses[previewTermId] : undefined;

  return (
    <section style={{ display: 'grid', gap: 16 }}>
      <header>
        <h2 style={{ margin: 0 }}>Хичээлийн жил, хуваарь, илүү цаг</h2>
        <p style={{ margin: '6px 0 0', color: '#475569', fontSize: 13 }}>
          Багш бүрийн долоо хоногийн норм 19 цаг. Хуваарь болон улирлын өдрүүдээр сарын бодит цаг, норм, илүү цагийг автоматаар бодно.
        </p>
      </header>
      {errorMessage && <p role="alert" style={messageStyle('#b91c1c')}>{errorMessage}</p>}
      {successMessage && <p role="status" style={messageStyle('#15803d')}>{successMessage}</p>}

      <section style={cardStyle}>
        <h3 style={sectionTitle}>Хичээлийн жилийн бүтэц</h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'end', gap: 9 }}>
          <label style={fieldStyle}>Хадгалсан жил
            <select value={draft.academic_year} onChange={(event) => chooseYear(event.target.value)} style={inputStyle}>
              {yearChoices.map((year) => <option key={year} value={year}>{year}</option>)}
            </select>
          </label>
          <label style={fieldStyle}>Шинэ жилийн эхлэх он
            <input type="number" min={1900} max={2199} value={yearText} onChange={(event) => setYearText(event.target.value)} style={inputStyle} />
          </label>
          <button type="button" disabled={loadingYears} onClick={createYear} style={buttonStyle('#475569')}>Жил шинээр үүсгэх</button>
          {savedYear && <button
            type="button"
            disabled={savingYear || deletingYear}
            onClick={() => void removeYear()}
            aria-label="Сонгосон жилийг устгах"
            title="Сонгосон жилийг устгах"
            style={{
              width: 36,
              height: 36,
              padding: 0,
              border: 'none',
              borderRadius: 8,
              background: '#fee2e2',
              color: '#ef4444',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: savingYear || deletingYear ? 'not-allowed' : 'pointer',
              opacity: savingYear || deletingYear ? 0.6 : 1,
            }}
          >
            <Trash2 size={17} aria-hidden="true" />
          </button>}
          {savedYear && <button type="button" disabled={downloading} onClick={() => void downloadTemplate()} style={{ ...buttonStyle('#475569'), marginLeft: 'auto' }}>
            {downloading ? 'Татаж байна...' : 'Загвар татах'}
          </button>}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 9, marginTop: 10 }}>
          <label style={fieldStyle}>Хичээлийн жилийн эхлэх өдөр
            <input type="date" value={draft.start_date} onChange={(event) => setDraft((current) => ({ ...current, start_date: event.target.value }))} style={inputStyle} />
          </label>
          <label style={fieldStyle}>Хичээлийн жилийн дуусах өдөр
            <input type="date" value={draft.end_date} onChange={(event) => setDraft((current) => ({ ...current, end_date: event.target.value }))} style={inputStyle} />
          </label>
        </div>
        <div style={{ display: 'grid', gap: 9, marginTop: 12 }}>
          {draft.terms.map((term, index) => {
            const termStatus = termStatuses[term.id];
            const hasOwnSchedule = termStatus?.uploaded
              && termStatus.source_term_id === term.id;
            return (
            <div key={term.id} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', alignItems: 'end', gap: 8, padding: 9, border: '1px solid #e2e8f0', borderRadius: 9 }}>
              <label style={fieldStyle}>Улирлын нэр
                <input value={term.name} maxLength={120} onChange={(event) => updateTerm(term.id, { name: event.target.value })} style={inputStyle} />
              </label>
              <label style={fieldStyle}>Эхлэх өдөр
                <input type="date" value={term.start_date} onChange={(event) => updateTerm(term.id, { start_date: event.target.value })} style={inputStyle} />
              </label>
              <label style={fieldStyle}>Дуусах өдөр
                <input type="date" value={term.end_date} onChange={(event) => updateTerm(term.id, { end_date: event.target.value })} style={inputStyle} />
              </label>
              <label style={fieldStyle}>Хамрах анги
                <input value={scopeDraft[term.id] ?? gradeScopeText(term.grades)} placeholder="Бүх анги" onChange={(event) => updateTermGrades(term.id, event.target.value)} style={inputStyle} />
              </label>
              <label style={fieldStyle}>Сургалтын хэлбэр
                <select value={term.modality} onChange={(event) => updateTerm(term.id, { modality: event.target.value as AcademicTerm['modality'] })} style={inputStyle}>
                  <option value="in_person">Танхим</option>
                  <option value="online">Цахим</option>
                </select>
              </label>
              <div style={{ display: 'grid', gap: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <label style={{
                  ...buttonStyle('#2563eb'),
                  cursor: !savedYear || uploading ? 'not-allowed' : 'pointer',
                  opacity: !savedYear || uploading ? 0.6 : 1,
                  textAlign: 'center',
                }}>
                  {hasOwnSchedule ? 'Хуваарь шинэчлэх' : 'Хуваарь оруулах'}
                  <input
                    type="file"
                    accept=".xlsx"
                    disabled={!savedYear || uploading}
                    onChange={(event) => void uploadSchedule(event, term.id)}
                    style={{ display: 'none' }}
                  />
                </label>
                {hasOwnSchedule && (
                  <button
                    type="button"
                    onClick={() => setPreviewTermId(term.id)}
                    aria-label={`${term.name} хуваарийг харах`}
                    title={`${term.name} хуваарийг харах`}
                    style={{
                      width: 36,
                      height: 36,
                      padding: 0,
                      border: '1px solid #bfdbfe',
                      borderRadius: 8,
                      background: '#eff6ff',
                      color: '#1d4ed8',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                    }}
                  >
                    <Eye size={17} aria-hidden="true" />
                  </button>
                )}
                <button
                  type="button"
                  disabled={draft.terms.length <= 1}
                  aria-label={`${term.name || `Улирал ${index + 1}`} хасах`}
                  title={`${term.name || `Улирал ${index + 1}`} хасах`}
                  onClick={() => {
                    setDraft((current) => ({ ...current, terms: current.terms.filter((item) => item.id !== term.id) }));
                    setScopeDraft((current) => {
                      const next = { ...current };
                      delete next[term.id];
                      return next;
                    });
                    if (selectedTermId === term.id) {
                      setSelectedTermId(draft.terms.find((item) => item.id !== term.id)?.id ?? '');
                    }
                  }}
                  style={{
                    width: 30,
                    height: 30,
                    padding: 0,
                    border: 'none',
                    borderRadius: 7,
                    background: '#fecaca',
                    color: '#b91c1c',
                    fontWeight: 900,
                    lineHeight: 1,
                    cursor: draft.terms.length <= 1 ? 'not-allowed' : 'pointer',
                    opacity: draft.terms.length <= 1 ? 0.45 : 1,
                  }}
                ><Trash2 size={15} aria-hidden="true" /></button>
                </div>
                {termStatus?.uploaded && (
                  <span style={{ color: '#15803d', fontSize: 12 }}>
                    {termStatus.source_term_id && termStatus.source_term_id !== term.id
                      ? 'Өмнөх улирлын хуваариар тооцогдоно'
                      : `Хадгалсан: ${termStatus.teachers} багш · ${termStatus.imported_lessons} цаг · ${termStatus.updated_at?.slice(0, 10)}`}
                  </span>
                )}
                {termStatus && !termStatus.uploaded && (
                  <span style={{ color: '#b45309', fontSize: 12 }}>Энэ улиралд хуваарь хадгалагдаагүй байна.</span>
                )}
                {!termStatus && savedYear && (
                  <span style={{ color: '#64748b', fontSize: 12 }}>Хуваарийн төлөв шалгаж байна...</span>
                )}
              </div>
            </div>
            );
          })}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
          <button type="button" onClick={() => setDraft((current) => ({
            ...current,
            terms: [...current.terms, {
              id: crypto.randomUUID(),
              name: `Улирал ${current.terms.length + 1}`,
              start_date: current.start_date,
              end_date: current.start_date,
              grades: [],
              modality: 'in_person',
            }],
          }))} style={buttonStyle('#475569')}>Улирал нэмэх</button>
          <button type="button" onClick={() => void saveYear()} disabled={savingYear || deletingYear} style={buttonStyle('#2563eb')}>
            {savingYear ? 'Хадгалж байна...' : `${savedYear ? 'Өөрчлөлт' : 'Хичээлийн жил'} хадгалах`}
          </button>
        </div>
        <small style={{ display: 'block', marginTop: 8, color: '#64748b' }}>
          Хугацаа хоорондын хүүхдийн амралтад цаг тооцохгүй. Улирлын огноо давхардахгүй байх ёстой. Тэгш/сондгой мөчлөг хичээлийн жилийн эхний долоо хоногийг сондгойгоос эхлэн завсарлагаар таслахгүй үргэлжилнэ.
        </small>
      </section>

      <section style={cardStyle}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'end', gap: 9 }}>
          <h3 style={{ ...sectionTitle, margin: '0 auto 0 0' }}>Сарын цагийн тооцоо</h3>
          <label style={fieldStyle}>Сар
            <input type="month" value={month} min={draft.start_date.slice(0, 7)} max={draft.end_date.slice(0, 7)} onChange={(event) => {
              if (event.target.value) {
                setMonth(event.target.value);
                setReport(null);
              }
            }} style={inputStyle} />
          </label>
          <button type="button" disabled={!savedYear || calculating} onClick={() => void calculateReport()} style={buttonStyle('#2563eb')}>
            {calculating ? 'Тооцоолж байна...' : 'Тооцоо шинэчлэх'}
          </button>
        </div>
        {!report ? <p style={{ margin: '12px 0 0', color: '#64748b' }}>Сар сонгоод тооцоог шинэчилнэ үү. Менежер орлон цагийг багш бүрээр оруулаад хадгална.</p> : <>
          <p style={{ margin: '8px 0', color: '#475569', fontSize: 13 }}>Сарын бодит цаг = хуваарийн цаг + орлон цаг · Сарын норм = 19 ÷ 5 × цэвэр хичээлийн өдөр · Илүү цаг = бодит − норм (доод тал нь 0).</p>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1050 }}>
              <thead><tr>{['Багш', 'Долоо хоногт үндсэн / тэгш / сондгой', 'Хичээллэх өдөр', 'Хуваарийн цаг', 'Орлон цаг (менежер)', 'Бодит цаг', 'Норм цаг', 'Илүү цаг'].map((title) => <th key={title} style={tableCell}>{title}</th>)}</tr></thead>
              <tbody>
                {report.teachers.map((teacher) => (
                  <tr key={teacher.teacher_id} style={{ borderTop: '1px solid #e2e8f0' }}>
                    <td style={tableCell}><strong>{teacher.teacher_name || teacher.email}</strong><small style={{ display: 'block', color: '#64748b' }}>{teacher.email}</small></td>
                    <td style={tableCell}>{teacher.weekly_base_hours} / {teacher.weekly_even_hours} / {teacher.weekly_odd_hours}</td>
                    <td style={tableCell}>{teacher.active_workdays}</td>
                    <td style={tableCell}>{teacher.scheduled_hours}</td>
                    <td style={tableCell}><input type="number" min={0} max={400} step={0.5} value={teacher.substitute_hours} onChange={(event) => setSubstituteHours(teacher.teacher_id, Math.max(0, Number(event.target.value)))} style={{ ...inputStyle, minWidth: 90 }} /></td>
                    <td style={tableCell}>{teacher.actual_hours}</td>
                    <td style={tableCell}>{teacher.norm_hours}</td>
                    <td style={{ ...tableCell, color: teacher.overtime_hours > 0 ? '#b91c1c' : '#15803d', fontWeight: 800 }}>{teacher.overtime_hours}</td>
                  </tr>
                ))}
                {report.teachers.length === 0 && <tr><td colSpan={8} style={tableCell}>Багшийн хуваарь олдсонгүй.</td></tr>}
              </tbody>
            </table>
          </div>
          <button type="button" disabled={savingSubstitutes} onClick={() => void saveSubstitutes()} style={{ ...buttonStyle('#15803d'), marginTop: 10 }}>
            {savingSubstitutes ? 'Хадгалж байна...' : 'Орлон цаг хадгалах'}
          </button>
        </>}
      </section>
      <SchedulePreviewModal
        open={!!previewTerm && !!previewStatus}
        termName={previewTerm?.name || 'Сонгосон улирал'}
        lessons={previewStatus?.preview_lessons ?? []}
        onDownload={() => void downloadSavedSchedule(previewTermId)}
        downloading={downloading}
        onClose={() => setPreviewTermId('')}
      />
    </section>
  );
}

const cardStyle = { padding: 14, border: '1px solid #e2e8f0', borderRadius: 12, background: '#fff' };
const sectionTitle = { margin: '0 0 10px', color: '#0f172a', fontSize: 16 };
const fieldStyle = { display: 'grid', gap: 5, minWidth: 160, color: '#475569', fontSize: 12, fontWeight: 700 };
const inputStyle = { width: '100%', minHeight: 36, padding: '7px 9px', border: '1px solid #cbd5e1', borderRadius: 7, boxSizing: 'border-box' as const, background: '#fff', color: '#172033', font: 'inherit' };
const buttonStyle = (background: string) => ({ display: 'inline-flex', minHeight: 36, alignItems: 'center', justifyContent: 'center', padding: '7px 11px', border: 0, borderRadius: 7, background, color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: 12 });
const tableCell = { padding: '7px 8px', textAlign: 'left' as const, fontSize: 12, whiteSpace: 'nowrap' as const };
const messageStyle = (color: string) => ({ margin: 0, color, whiteSpace: 'pre-wrap' as const, fontSize: 13 });
