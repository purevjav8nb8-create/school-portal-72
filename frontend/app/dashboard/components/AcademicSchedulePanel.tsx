'use client';

import { ChangeEvent, useEffect, useMemo, useState } from 'react';
import { schoolMonth } from '../../../lib/schoolDate';
import {
  AcademicTerm,
  AcademicYear,
  OvertimeReport,
  ScheduleStatus,
  downloadScheduleTemplate,
  deleteAcademicYear,
  getOvertimeReport,
  getScheduleStatus,
  importSchedule,
  listAcademicYears,
  saveAcademicYear,
  saveSubstituteHours,
} from './schoolScheduleApi';

function createDefaultYear(startYear: number): AcademicYear {
  const followingYear = startYear + 1;
  const academicYear = `${startYear}-${followingYear}`;
  const makeTerm = (
    index: number,
    name: string,
    start_date: string,
    end_date: string,
    grades: number[] = [],
    modality: AcademicTerm['modality'] = 'in_person',
  ): AcademicTerm => ({
    id: `${String(startYear).padStart(4, '0')}0000-0000-4000-8000-${String(index).padStart(12, '0')}`,
    name,
    start_date,
    end_date,
    grades,
    modality,
  });
  return {
    academic_year: academicYear,
    start_date: `${startYear}-09-01`,
    end_date: `${followingYear}-06-30`,
    terms: [
      makeTerm(1, 'I улирал', `${startYear}-09-01`, `${startYear}-10-30`),
      makeTerm(2, 'II улирал', `${startYear}-11-09`, `${startYear}-12-25`),
      makeTerm(3, 'III улирал · цахим', `${followingYear}-01-11`, `${followingYear}-01-15`, [10, 11, 12], 'online'),
      makeTerm(4, 'III улирал', `${followingYear}-01-18`, `${followingYear}-03-26`),
      makeTerm(5, 'IV улирал', `${followingYear}-04-05`, `${followingYear}-06-04`),
    ],
  };
}

function gradeScopeText(grades: number[]) {
  if (!grades.length) return '';
  const sorted = [...grades].sort((a, b) => a - b);
  const consecutive = sorted.every((grade, index) => index === 0 || grade === sorted[index - 1] + 1);
  return consecutive ? `${sorted[0]}-${sorted[sorted.length - 1]}` : sorted.join(', ');
}

function parseGradeScope(value: string): number[] {
  const text = value.trim();
  if (!text || text.toLocaleLowerCase() === 'бүгд') return [];
  const range = text.match(/^(\d{1,2})\s*-\s*(\d{1,2})$/);
  const grades = range
    ? Array.from({ length: Number(range[2]) - Number(range[1]) + 1 }, (_, index) => Number(range[1]) + index)
    : text.split(',').map((item) => Number(item.trim()));
  if (
    !grades.length
    || grades.some((grade) => !Number.isInteger(grade) || grade < 1 || grade > 12)
    || new Set(grades).size !== grades.length
  ) {
    throw new Error('Ангиа 1-12, жишээ нь 10-12 эсвэл 5, 6 гэж оруулна уу.');
  }
  return grades.sort((a, b) => a - b);
}

function errorText(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

type ScheduleFeedback = { kind: 'success' | 'warning' | 'error'; message: string };

export default function AcademicSchedulePanel() {
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [draft, setDraft] = useState<AcademicYear>(() => createDefaultYear(2026));
  const [scopeDraft, setScopeDraft] = useState<Record<string, string>>({});
  const [yearText, setYearText] = useState('2026');
  const [month, setMonth] = useState(schoolMonth);
  const [scheduleStatus, setScheduleStatus] = useState<ScheduleStatus | null>(null);
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
  const [scheduleFeedback, setScheduleFeedback] = useState<ScheduleFeedback | null>(null);

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
      setScheduleStatus(null);
      setReport(null);
      return;
    }
    let active = true;
    setScheduleStatus(null);
    setReport(null);
    void getScheduleStatus(draft.academic_year)
      .then((result) => { if (active) setScheduleStatus(result); })
      .catch((error: unknown) => { if (active) setErrorMessage(errorText(error, 'Хуваарийн төлөв уншигдсангүй.')); });
    return () => { active = false; };
  }, [draft.academic_year, savedYear]);

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
    setScopeDraft({});
    setYearText(academicYear.split('-')[0]);
    setErrorMessage('');
    setSuccessMessage('');
    setScheduleFeedback(null);
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

  const uploadSchedule = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !savedYear) return;
    setUploading(true);
    setErrorMessage('');
    setSuccessMessage('');
    setScheduleFeedback(null);
    try {
      const result = await importSchedule(draft.academic_year, file);
      setScheduleStatus({
        uploaded: true,
        imported_lessons: result.imported_lessons,
        teachers: result.teachers,
        updated_at: new Date().toISOString(),
      });
      const homeroomSummary = result.homeroom_teachers
        ? ` ${result.homeroom_teachers} багшийн даасан ангийн мэдээлэл шинэчлэгдлээ (${result.homeroom_classes} анги).`
        : '';
      const importedMessage = `${result.teachers} багшийн ${result.imported_lessons} хичээлийн цаг импортлогдлоо.${homeroomSummary} Өмнөх хуваарь бүхэлдээ шинэчлэгдсэн.`;
      setSuccessMessage(importedMessage);
      setScheduleFeedback({ kind: 'success', message: `Хуваарь хадгалагдлаа. ${importedMessage}` });
      try {
        setScheduleStatus(await getScheduleStatus(draft.academic_year));
      } catch (error) {
        const detail = errorText(error, 'Хуваарийн төлөв шинэчлэгдсэнгүй.');
        setErrorMessage(detail);
        setScheduleFeedback({ kind: 'warning', message: `Импортын хүсэлт амжилттай боловч хадгалсан төлөвийг дахин шалгаж чадсангүй: ${detail}` });
      }
      await calculateReport();
    } catch (error) {
      const detail = errorText(error, 'Хуваарийн файл импортлогдсонгүй.');
      setErrorMessage(detail);
      try {
        const status = await getScheduleStatus(draft.academic_year);
        setScheduleStatus(status);
        setScheduleFeedback({
          kind: 'error',
          message: status.uploaded
            ? `Импортын дараах алхам алдаатай: ${detail} Хуваарь өөрөө хадгалагдсан (${status.teachers} багш, ${status.imported_lessons} цаг).`
            : `Импорт амжилтгүй: ${detail} Одоогоор энэ жилийн хуваарь хадгалагдаагүй байна.`,
        });
      } catch (statusError) {
        const statusDetail = errorText(statusError, 'Хуваарийн төлөв уншигдсангүй.');
        setErrorMessage(`${detail} ${statusDetail}`);
        setScheduleFeedback({ kind: 'error', message: `Импорт амжилттай эсэхийг баталгаажуулж чадсангүй: ${detail} Төлөв шалгах алдаа: ${statusDetail}` });
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
          {savedYear && <button type="button" disabled={savingYear || deletingYear} onClick={() => void removeYear()} style={buttonStyle('#dc2626')}>
            {deletingYear ? 'Устгаж байна...' : 'Сонгосон жилийг устгах'}
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
          {draft.terms.map((term, index) => (
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
              <button type="button" disabled={draft.terms.length <= 1} aria-label={`${term.name || `Улирал ${index + 1}`} хасах`} onClick={() => {
                setDraft((current) => ({ ...current, terms: current.terms.filter((item) => item.id !== term.id) }));
                setScopeDraft((current) => {
                  const next = { ...current };
                  delete next[term.id];
                  return next;
                });
              }} style={buttonStyle('#dc2626')}>Хасах</button>
            </div>
          ))}
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
        <h3 style={sectionTitle}>Багшийн хуваарь импортлох</h3>
        {!savedYear && <p style={{ color: '#b45309' }}>Эхлээд хичээлийн жилийн бүтцийг хадгална уу.</p>}
        <p style={{ margin: '0 0 9px', color: '#475569', fontSize: 13 }}>
          XLSX-ийн мөр бүр нэг хичээлийн цаг байна. Стандарт загвар эсвэл багшийн нэр, мэргэжил, өдөр/ээлж/цагийн хүснэгтийг оруулж болно. Хүснэгтэн файлаас даасан ангийг мөн шинэчилнэ; хоосон даасан ангитай багшийн өмнөх даасан анги арилна. Импорт хийхэд тухайн жилийн өмнөх хуваарь бүхэлдээ солигдоно.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 9 }}>
          <button type="button" disabled={downloading} onClick={() => void downloadTemplate()} style={buttonStyle('#475569')}>
            {downloading ? 'Татаж байна...' : 'XLSX загвар татах'}
          </button>
          <label style={{ ...buttonStyle('#2563eb'), cursor: !savedYear || uploading ? 'not-allowed' : 'pointer', opacity: !savedYear || uploading ? 0.6 : 1 }}>
            {!savedYear
              ? 'Эхлээд хичээлийн жилийг хадгална уу'
              : uploading
              ? scheduleStatus?.uploaded ? 'Хуваарь шинэчилж байна...' : 'Импортолж байна...'
              : scheduleStatus?.uploaded ? 'Хуваарийн XLSX шинэчлэх' : 'Хуваарийн XLSX оруулах'}
            <input type="file" accept=".xlsx" disabled={!savedYear || uploading} onChange={(event) => void uploadSchedule(event)} style={{ display: 'none' }} />
          </label>
          {scheduleStatus?.uploaded && <span style={{ color: '#15803d', fontSize: 13 }}>Хадгалсан: {scheduleStatus.teachers} багш · {scheduleStatus.imported_lessons} цаг · {scheduleStatus.updated_at?.slice(0, 10)}</span>}
          {scheduleStatus && !scheduleStatus.uploaded && <span style={{ color: '#b91c1c', fontSize: 13 }}>Төлөв: энэ жилд хадгалсан хуваарь алга.</span>}
          {!scheduleStatus && savedYear && <span style={{ color: '#475569', fontSize: 13 }}>Хуваарийн төлөв шалгаж байна...</span>}
          {!savedYear && <span style={{ color: '#b45309', fontSize: 13 }}>Төлөв тодорхойгүй: хичээлийн жилийн бүтцийг эхлээд хадгална уу.</span>}
        </div>
        {scheduleFeedback && <p role={scheduleFeedback.kind === 'error' ? 'alert' : 'status'} style={messageStyle(scheduleFeedback.kind === 'success' ? '#15803d' : scheduleFeedback.kind === 'warning' ? '#b45309' : '#b91c1c')}>{scheduleFeedback.message}</p>}
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
