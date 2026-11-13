'use client';

import { useMemo, useState } from 'react';
import FileAttachmentActions from './records/FileAttachmentActions';
import { cloudinaryPdfPreview } from './records/cloudinaryUrls';
import { Teacher } from '../types';
import { formatTeacherName } from '../utils/teacherName';

type Training = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  trainingType?: string;
  certificateUrl: string;
  imageUrl?: string | null;
};

interface Props {
  teachers: Teacher[];
}

export default function AdminTrainingPanel({ teachers }: Props) {
  const [selected, setSelected] = useState<{ teacher: Teacher; training: Training } | null>(null);
  const [teacherId, setTeacherId] = useState('');
  const [teacherSearch, setTeacherSearch] = useState('');
  const [teacherPickerOpen, setTeacherPickerOpen] = useState(false);
  const selectedTeacher = teachers.find((teacher) => teacher.auth_id === teacherId);
  const matchingTeachers = useMemo(() => teachers.filter((teacher) =>
    `${teacher.last_name} ${teacher.first_name} ${formatTeacherName(`${teacher.last_name} ${teacher.first_name}`)}`
      .toLocaleLowerCase().includes(teacherSearch.trim().toLocaleLowerCase()),
  ), [teacherSearch, teachers]);
  const filteredTeachers = teacherId ? teachers.filter((teacher) => teacher.auth_id === teacherId) : teachers;
  const rows = filteredTeachers.flatMap((teacher) =>
    (teacher.training_records ?? []).map((training) => ({ teacher, training: training as Training })),
  ).sort((left, right) =>
    right.training.endDate.localeCompare(left.training.endDate)
    || right.training.startDate.localeCompare(left.training.startDate),
  );
  const groupedTypes = rows.reduce<Record<string, number>>((summary, row) => {
    const type = row.training.trainingType || 'Бусад';
    summary[type] = (summary[type] ?? 0) + 1;
    return summary;
  }, {});

  return (
    <section>
      <h2 style={{ marginTop: 0 }}>Сургалт</h2>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '8px 0', color: '#334155', fontWeight: 600 }}>
        <span style={{ position: 'relative', display: 'inline-block', minWidth: 220 }}>
          <input
            role="combobox"
            aria-label="Багшаар шүүх"
            aria-expanded={teacherPickerOpen}
            aria-controls="training-teacher-options"
            aria-autocomplete="list"
            value={teacherPickerOpen ? teacherSearch : selectedTeacher ? formatTeacherName(`${selectedTeacher.last_name} ${selectedTeacher.first_name}`) : 'Бүх багш'}
            onFocus={() => { setTeacherSearch(''); setTeacherPickerOpen(true); }}
            onChange={(event) => { setTeacherSearch(event.target.value); setTeacherPickerOpen(true); }}
            onBlur={() => window.setTimeout(() => setTeacherPickerOpen(false), 120)}
            style={{ width: '100%', padding: '7px 9px', border: '1px solid #cbd5e1', borderRadius: 7, background: '#fff' }}
          />
          {teacherPickerOpen && <div id="training-teacher-options" role="listbox" style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 20, maxHeight: 220, overflowY: 'auto', border: '1px solid #cbd5e1', borderRadius: 7, background: '#fff', boxShadow: '0 8px 20px rgba(15,23,42,.12)' }}>
            <button type="button" role="option" aria-selected={!teacherId} onMouseDown={(event) => event.preventDefault()} onClick={() => { setTeacherId(''); setTeacherPickerOpen(false); }} style={pickerOption}>Бүх багш</button>
            {matchingTeachers.map((teacher) => <button key={teacher.auth_id} type="button" role="option" aria-selected={teacher.auth_id === teacherId} onMouseDown={(event) => event.preventDefault()} onClick={() => { setTeacherId(teacher.auth_id); setTeacherPickerOpen(false); }} style={pickerOption}>
              {formatTeacherName(`${teacher.last_name} ${teacher.first_name}`)}
            </button>)}
            {matchingTeachers.length === 0 && <span style={{ display: 'block', padding: '7px 9px', color: '#64748b', fontWeight: 400 }}>Багш олдсонгүй.</span>}
          </div>}
        </span>
      </label>
      <p style={{ color: '#475569' }}>Нийт бүртгэл: <b>{rows.length}</b> · Сургалтад хамрагдсан багш: <b>{new Set(rows.map((row) => row.teacher.auth_id)).size}</b></p>
      <div style={summaryGrid}>{['Үндсэн', 'Төрөлжсөн', 'Сонголтот', 'Ажлын байран дээрх сургалт', 'Бусад'].map((type) => <div key={type} style={summaryCard}><span>{type}</span><b>{groupedTypes[type] ?? 0}</b></div>)}</div>
      {rows.length === 0 ? <p>Сургалтын бүртгэл алга.</p> : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>{['Багш', 'Сургалтын нэр', 'Төрөл', 'Хугацаа', 'Файл'].map((item) => <th key={item} style={cell}>{item}</th>)}</tr></thead>
            <tbody>{rows.map(({ teacher, training }) => (
              <tr key={`${teacher.auth_id}-${training.id}`} style={{ borderTop: '1px solid #e2e8f0' }}>
                <td style={cell}>{formatTeacherName(`${teacher.last_name} ${teacher.first_name}`)}</td>
                <td style={cell}>
                  <button type="button" onClick={() => setSelected({ teacher, training })} style={linkButton}>{training.name}</button>
                </td>
                <td style={cell}>{training.trainingType || 'Бусад'}</td>
                <td style={cell}>{training.startDate} – {training.endDate}</td>
                <td style={cell}><FileAttachmentActions attachment={{ name: 'Сертификат', url: training.certificateUrl, file_type: training.certificateUrl.toLowerCase().includes('.pdf') ? 'document' : 'image' }} /></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
      {selected && (
        <div role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setSelected(null)} style={overlay}>
          <section role="dialog" aria-modal="true" style={dialog}>
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0 }}>{selected.training.name}</h3>
              <button type="button" onClick={() => setSelected(null)} style={closeButton}>Хаах</button>
            </header>
            <p style={{ margin: '10px 0', color: '#475569' }}>{formatTeacherName(`${selected.teacher.last_name} ${selected.teacher.first_name}`)} · {selected.training.trainingType || 'Бусад'} · {selected.training.startDate} – {selected.training.endDate}</p>
            <div style={attachmentGrid}>
              <div style={attachmentCard}>
                <strong>Сертификат</strong>
                <div style={previewFrame}>
                  <img src={cloudinaryPdfPreview(selected.training.certificateUrl)} alt="Сертификат" style={previewImage} />
                </div>
                <FileAttachmentActions attachment={{ name: 'Сертификат', url: selected.training.certificateUrl, file_type: selected.training.certificateUrl.toLowerCase().includes('.pdf') ? 'document' : 'image' }} />
              </div>
              {selected.training.imageUrl && (
                <div style={attachmentCard}>
                  <strong>Сургалтын зураг</strong>
                  <div style={previewFrame}>
                    <img src={selected.training.imageUrl} alt="Сургалтын зураг" style={previewImage} />
                  </div>
                  <FileAttachmentActions attachment={{ name: 'Сургалтын зураг', url: selected.training.imageUrl, file_type: 'image' }} />
                </div>
              )}
            </div>
          </section>
        </div>
      )}
    </section>
  );
}

const cell = { padding: '3px 6px', textAlign: 'left' as const, fontSize: 12 };
const summaryGrid = { display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 6, margin: '8px 0 10px' };
const summaryCard = { display: 'grid', gap: 2, padding: '6px 8px', borderRadius: 7, background: '#f1f5f9', color: '#475569', fontSize: 11 };
const linkButton = { border: 0, background: 'transparent', color: '#2563eb', textDecoration: 'underline', cursor: 'pointer', padding: 0, fontWeight: 700 };
const overlay = { position: 'fixed' as const, inset: 0, zIndex: 60, display: 'grid', placeItems: 'center', padding: 16, background: 'rgba(15,23,42,.5)' };
const dialog = { width: 'min(1100px, 92vw)', maxHeight: '92vh', overflow: 'auto', padding: 18, borderRadius: 14, background: '#fff' };
const attachmentGrid = { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 14 };
const attachmentCard = { display: 'grid', alignContent: 'start', gap: 8, minWidth: 0, padding: 12, border: '1px solid #e2e8f0', borderRadius: 10, background: '#fff' };
const previewFrame = { display: 'grid', placeItems: 'center', minHeight: 260, padding: 8, borderRadius: 8, background: '#f8fafc' };
const previewImage = { display: 'block', maxWidth: '100%', maxHeight: 420, objectFit: 'contain' as const };
const closeButton = { border: 0, borderRadius: 6, padding: '7px 10px', cursor: 'pointer' };
const pickerOption = { display: 'block', width: '100%', padding: '7px 9px', border: 0, background: '#fff', color: '#172033', textAlign: 'left' as const, cursor: 'pointer' };
