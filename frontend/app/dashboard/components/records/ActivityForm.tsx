'use client';

import { FormEvent, useState } from 'react';
import AnnouncementAttachments, { AnnouncementAttachment } from './AnnouncementAttachments';
import ClassFields from './ClassFields';

export type ActivityCategory =
  | 'Хичээлд суусан'
  | 'Уралдаан, тэмцээн'
  | 'Сургалт, семинар'
  | 'Хурал, зөвлөгөөн'
  | 'Амжилт';

export type ActivityInput = {
  category: ActivityCategory;
  title: string;
  date: string;
  note: string;
  attachments: AnnouncementAttachment[];
  images?: string[];
  grade?: number;
  section?: string;
  subject?: string;
};

interface Props {
  unit: string;
  subjects: string[];
  onSubmit: (activity: ActivityInput) => Promise<void>;
}

export default function ActivityForm({ unit, subjects, onSubmit }: Props) {
  const [category, setCategory] = useState<ActivityCategory>('Хичээлд суусан');
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState('');
  const [grade, setGrade] = useState(0);
  const [section, setSection] = useState('');
  const [subject, setSubject] = useState('');
  const [attachments, setAttachments] = useState<AnnouncementAttachment[]>([]);
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const fieldStyle = {
    width: '100%',
    padding: '11px 12px',
    border: '1px solid #cbd5e1',
    borderRadius: 8,
    background: '#fff',
    color: '#172033',
    boxSizing: 'border-box' as const,
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setErrorMessage('');
    try {
      const lessonAttendance = category === 'Хичээлд суусан';
      await onSubmit({
        category,
        title: lessonAttendance ? subject : title,
        date,
        note,
        attachments,
        ...(lessonAttendance ? { grade, section, subject } : {}),
      });
      setTitle('');
      setNote('');
      setAttachments([]);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Тэмдэглэл хадгалагдсангүй.');
    } finally {
      setBusy(false);
    }
  };

  const lessonAttendance = category === 'Хичээлд суусан';

  return (
    <form onSubmit={submit} style={{ display: 'grid', gap: 10, padding: 14, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8 }}>
      <h3 style={{ margin: 0 }}>Шинэ тэмдэглэл</h3>
      {errorMessage && <p role="alert" style={{ color: '#b91c1c' }}>{errorMessage}</p>}
      <select value={category} onChange={(event) => setCategory(event.target.value as ActivityCategory)} style={fieldStyle}>
        <option>Хичээлд суусан</option>
        <option>Уралдаан, тэмцээн</option>
        <option>Сургалт, семинар</option>
        <option>Хурал, зөвлөгөөн</option>
        <option>Амжилт</option>
      </select>
      {lessonAttendance ? (
        <ClassFields
          unit={unit}
          subjects={subjects}
          grade={grade}
          section={section}
          subject={subject}
          onGradeChange={setGrade}
          onSectionChange={setSection}
          onSubjectChange={setSubject}
        />
      ) : <label style={{ display: 'grid', gap: 4, fontWeight: 600 }}>Гарчиг
        <input required value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Гарчиг" style={fieldStyle} />
      </label>}
      <label style={{ display: 'grid', gap: 4, fontWeight: 600 }}>Огноо
        <input required type="date" value={date} onChange={(event) => setDate(event.target.value)} style={fieldStyle} />
      </label>
      <textarea rows={4} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Тэмдэглэл" style={fieldStyle} />
      <AnnouncementAttachments attachments={attachments} onChange={setAttachments} />
      <button type="submit" disabled={busy} style={{ padding: '8px 12px', border: 0, borderRadius: 6, background: busy ? '#cbd5e1' : '#0f766e', color: '#fff', fontWeight: 700, cursor: busy ? 'wait' : 'pointer' }}>{busy ? 'Хадгалж байна...' : 'Илгээх'}</button>
    </form>
  );
}
