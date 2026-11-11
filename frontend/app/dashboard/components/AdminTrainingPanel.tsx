'use client';

import { useState } from 'react';
import FileAttachmentActions from './records/FileAttachmentActions';
import { Teacher } from '../types';

type Training = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  trainingType?: string;
  certificateUrl: string;
  imageUrl?: string | null;
};

function previewUrl(url: string) {
  const normalized = url.replace('/upload/fl_inline/', '/upload/').replace('/upload/fl_attachment/', '/upload/');
  return normalized.includes('/image/upload/')
    ? normalized.replace('/image/upload/', '/image/upload/pg_1,f_jpg/')
    : normalized;
}

interface Props {
  teachers: Teacher[];
}

export default function AdminTrainingPanel({ teachers }: Props) {
  const [selected, setSelected] = useState<{ teacher: Teacher; training: Training } | null>(null);
  const [teacherId, setTeacherId] = useState('');
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
        Багшаар шүүх
        <select value={teacherId} onChange={(event) => setTeacherId(event.target.value)} style={{ minWidth: 220, padding: '7px 9px', border: '1px solid #cbd5e1', borderRadius: 7, background: '#fff' }}>
          <option value="">Бүх багш</option>
          {teachers.map((teacher) => <option key={teacher.auth_id} value={teacher.auth_id}>{teacher.last_name} {teacher.first_name}</option>)}
        </select>
      </label>
      <p style={{ color: '#475569' }}>Нийт бүртгэл: <b>{rows.length}</b> · Сургалтад хамрагдсан багш: <b>{new Set(rows.map((row) => row.teacher.auth_id)).size}</b></p>
      <div style={summaryGrid}>{['Үндсэн', 'Төрөлжсөн', 'Сонголтот', 'Ажлын байран дээрх сургалт', 'Бусад'].map((type) => <div key={type} style={summaryCard}><span>{type}</span><b>{groupedTypes[type] ?? 0}</b></div>)}</div>
      {rows.length === 0 ? <p>Сургалтын бүртгэл алга.</p> : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>{['Багш', 'Сургалтын нэр', 'Төрөл', 'Хугацаа', 'Файл'].map((item) => <th key={item} style={cell}>{item}</th>)}</tr></thead>
            <tbody>{rows.map(({ teacher, training }) => (
              <tr key={`${teacher.auth_id}-${training.id}`} style={{ borderTop: '1px solid #e2e8f0' }}>
                <td style={cell}>{teacher.last_name} {teacher.first_name}</td>
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
            <p style={{ margin: '10px 0', color: '#475569' }}>{selected.teacher.last_name} {selected.teacher.first_name} · {selected.training.trainingType || 'Бусад'} · {selected.training.startDate} – {selected.training.endDate}</p>
            <div style={attachmentGrid}>
              <div style={attachmentCard}>
                <strong>Сертификат</strong>
                <div style={previewFrame}>
                  <img src={previewUrl(selected.training.certificateUrl)} alt="Сертификат" style={previewImage} />
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
