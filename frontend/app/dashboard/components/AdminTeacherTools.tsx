'use client';

import { FormEvent, useRef, useState } from 'react';
import { FileUp, Trash2, UserPlus } from 'lucide-react';
import { supabase } from '../../../lib/supabaseClient';
import { Teacher } from '../types';
import FloatingComposer from './records/FloatingComposer';
import { subjectsForUnit } from './records/ClassFields';

interface CreatedTeacher {
  auth_id: string;
  first_name: string;
  last_name: string;
  email: string;
  unit: Teacher['unit'];
  subject: string;
  password?: string;
}

interface Props {
  teachers: Teacher[];
  onTeachersAdded: (teachers: Teacher[]) => void;
  onTeacherRemoved: (authId: string) => void;
}

const apiUrl = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://127.0.0.1:8000';

function toTeacher(record: CreatedTeacher, id: number): Teacher {
  return {
    id,
    auth_id: record.auth_id,
    first_name: record.first_name,
    last_name: record.last_name,
    email: record.email,
    unit: record.unit,
    subject: record.subject,
    attendance: 'Ирсэн',
    monthly_attendance_rate: 0,
    training_status: 'Хамрагдаагүй',
    rating: 0,
    monthly_login_count: 0,
  };
}

export default function AdminTeacherTools({ teachers, onTeachersAdded, onTeacherRemoved }: Props) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [selectedTeacherId, setSelectedTeacherId] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [teacher, setTeacher] = useState({
    first_name: '',
    last_name: '',
    email: '',
    unit: 'БАЗАН' as Teacher['unit'],
    subject: '',
    password: '',
  });
  const fileInput = useRef<HTMLInputElement>(null);

  const accessToken = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Нэвтрэх эрх дууссан байна. Дахин нэвтэрнэ үү.');
    return session.access_token;
  };

  const addTeacher = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      const token = await accessToken();
      const response = await fetch(`${apiUrl}/api/teachers`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(teacher),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.detail ?? 'Багш нэмэхэд алдаа гарлаа.');
      const created = result.teacher as CreatedTeacher;
      onTeachersAdded([toTeacher(created, Date.now())]);
      setMessage(`${created.email} хэрэглэгч үүслээ. Нэвтрэхдээ оруулсан нууц үгийг ашиглана.`);
      setTeacher({ first_name: '', last_name: '', email: '', unit: 'БАЗАН', subject: '', password: '' });
      return true;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Хүсэлт амжилтгүй боллоо.');
      return false;
    } finally {
      setBusy(false);
    }
  };

  const importTeachers = async (file?: File) => {
    if (!file) return;
    setBusy(true);
    setMessage('');
    try {
      const token = await accessToken();
      const formData = new FormData();
      formData.append('file', file);
      const response = await fetch(`${apiUrl}/api/teachers/bulk-upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.detail ?? 'Файл боловсруулахад алдаа гарлаа.');
      const created = result.created as CreatedTeacher[];
      const failed = (result.failed ?? []) as { row: number; detail: string }[];
      onTeachersAdded(created.map((item, index) => toTeacher(item, Date.now() + index)));
      const credentials = created.map((item) => `${item.email}: ${item.password ?? 'Excel файлаас өгсөн нууц үг'}`);
      const failures = failed.map((item) => `Мөр ${item.row}: ${item.detail}`);
      setMessage([...credentials, ...failures].join('\n') || 'Файлаас хэрэглэгч үүсгэсэнгүй.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Файл боловсруулахад алдаа гарлаа.');
    } finally {
      setBusy(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  const downloadTemplate = () => {
    const csv = [
      'first_name,last_name,email,unit,subject,password',
      'Болормаа,Бат,bagsh@example.com,БАЗАН,Математик,12345678',
    ].join('\n');
    const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'teacher-import-template.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const deleteTeacher = async (close: () => void) => {
    if (!selectedTeacherId) return;
    setBusy(true);
    setMessage('');
    try {
      const token = await accessToken();
      const response = await fetch(`${apiUrl}/api/teachers/${selectedTeacherId}`, {
        method: 'DELETE',
        headers: { Authorization: 'Bearer ' + token },
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.detail ?? 'Багшийг устгаж чадсангүй.');
      onTeacherRemoved(selectedTeacherId);
      setSelectedTeacherId('');
      setConfirmDelete(false);
      close();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Багшийг устгаж чадсангүй.');
    } finally {
      setBusy(false);
    }
  };

  const actionStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    width: '100%',
    padding: '7px 10px',
    border: 'none',
    borderRadius: 24,
    background: '#fb923c',
    color: '#fff',
    fontWeight: 600,
    fontSize: 12,
    cursor: busy ? 'wait' : 'pointer',
    textAlign: 'left' as const,
    boxShadow: '0 2px 6px rgba(251, 146, 60, 0.25)',
  };
  const fieldStyle = {
    width: '100%',
    boxSizing: 'border-box' as const,
    padding: '10px 12px',
    border: '1px solid #cbd5e1',
    borderRadius: 8,
    background: '#f8fafc',
    color: '#1e293b',
    fontSize: 13,
    outline: 'none',
  };

  return (
    <section style={{ display: 'grid', gap: 8, marginTop: 16 }}>
      <FloatingComposer
        title="Шинэ багш нэмэх"
        label="Багш нэмэх"
        headerAction={(
          <button type="button" onClick={downloadTemplate} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '6px 9px', border: 0, borderRadius: 8, background: '#fb923c', color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
            <FileUp size={13} /> Загвар файл
          </button>
        )}
        trigger={(
          <button type="button" style={actionStyle} disabled={busy}>
            <UserPlus size={17} /> Багш нэмэх
          </button>
        )}
      >
        {(close) => (
          <form onSubmit={async (event) => { if (await addTeacher(event)) close(); }} style={{ display: 'grid', gap: 12 }}>
            <input required placeholder="Овог" value={teacher.last_name} onChange={(event) => setTeacher({ ...teacher, last_name: event.target.value })} style={fieldStyle} />
            <input required placeholder="Нэр" value={teacher.first_name} onChange={(event) => setTeacher({ ...teacher, first_name: event.target.value })} style={fieldStyle} />
            <input required type="email" placeholder="И-мэйл" value={teacher.email} onChange={(event) => setTeacher({ ...teacher, email: event.target.value })} style={fieldStyle} />
            <select value={teacher.unit} onChange={(event) => {
              const unit = event.target.value as Teacher['unit'];
              setTeacher({ ...teacher, unit, subject: '' });
            }} style={fieldStyle}>
              <option value="БАЗАН">БАЗАН</option>
              <option value="БУЗАН">БУЗАН</option>
              <option value="НУЗАН">НУЗАН</option>
            </select>
            <select required value={teacher.subject} onChange={(event) => setTeacher({ ...teacher, subject: event.target.value })} style={fieldStyle}>
              <option value="" disabled>Заах хичээл сонгох</option>
              {subjectsForUnit(teacher.unit).map((subject) => <option key={subject} value={subject}>{subject}</option>)}
            </select>
            <input required type="password" minLength={8} autoComplete="new-password" placeholder="Нууц үг (дор хаяж 8 тэмдэгт)" value={teacher.password} onChange={(event) => setTeacher({ ...teacher, password: event.target.value })} style={fieldStyle} />
            <button type="submit" disabled={busy} style={{ ...actionStyle, justifyContent: 'center', borderRadius: 9, padding: '10px 12px' }}>{busy ? 'Нэмж байна...' : 'Үүсгэх'}</button>
          </form>
        )}
      </FloatingComposer>
      <button type="button" title="Багана: first_name, last_name, moes, unit, subject; нууц үгийн багана: moes pass" style={actionStyle} disabled={busy} onClick={() => fileInput.current?.click()}>
        <FileUp size={17} /> Excel оруулах
      </button>
      <FloatingComposer title="Багш хасах" label="Багш хасах" trigger={(
        <button type="button" style={actionStyle} disabled={busy}>
          <Trash2 size={17} /> Багш хасах
        </button>
      )}>
        {(close) => (
          <div style={{ display: 'grid', gap: 12 }}>
            <select value={selectedTeacherId} onChange={(event) => { setSelectedTeacherId(event.target.value); setConfirmDelete(false); }} style={fieldStyle}>
              <option value="">Багш сонгох</option>
              {teachers.map((item) => <option key={item.auth_id} value={item.auth_id}>{item.last_name} {item.first_name} — {item.email}</option>)}
            </select>
            {!confirmDelete ? (
              <button type="button" disabled={!selectedTeacherId} onClick={() => setConfirmDelete(true)} style={{ ...actionStyle, justifyContent: 'center', background: '#dc2626', borderRadius: 9 }}>
                Устгах
              </button>
            ) : (
              <div style={{ display: 'grid', gap: 10, padding: 14, borderRadius: 10, background: '#fef2f2', border: '1px solid #fecaca' }}>
                <strong>Сонгосон багшийг устгах уу?</strong>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="button" onClick={() => void deleteTeacher(close)} disabled={busy} style={{ ...actionStyle, justifyContent: 'center', background: '#dc2626', borderRadius: 8 }}>Тийм, устгах</button>
                  <button type="button" onClick={() => setConfirmDelete(false)} style={{ ...actionStyle, justifyContent: 'center', background: '#64748b', borderRadius: 8 }}>Буцах</button>
                </div>
              </div>
            )}
          </div>
        )}
      </FloatingComposer>
      <input ref={fileInput} type="file" accept=".xlsx,.csv" hidden onChange={(event) => void importTeachers(event.target.files?.[0])} />
      {message && <pre role="status" style={{ maxHeight: 180, overflow: 'auto', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', fontSize: 11 }}>{message}</pre>}
    </section>
  );
}
