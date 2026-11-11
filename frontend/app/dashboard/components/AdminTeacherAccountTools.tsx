'use client';

import { Dispatch, SetStateAction } from 'react';
import { Trash2 } from 'lucide-react';
import { Teacher } from '../types';
import FloatingComposer from './records/FloatingComposer';

const actionStyle = { display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '7px 10px', border: 'none', borderRadius: 24, background: '#fb923c', color: '#fff', fontWeight: 600, fontSize: 12, cursor: 'pointer', textAlign: 'left' as const, boxShadow: '0 2px 6px rgba(251, 146, 60, 0.25)' };
const fieldStyle = { width: '100%', boxSizing: 'border-box' as const, padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: 8, background: '#f8fafc', color: '#1e293b', fontSize: 13, outline: 'none' };

export default function AdminTeacherAccountTools({
  teachers, busy, selectedTeacherId, setSelectedTeacherId,
  confirmDelete, setConfirmDelete, onDelete,
}: {
  teachers: Teacher[];
  busy: boolean;
  selectedTeacherId: string;
  setSelectedTeacherId: Dispatch<SetStateAction<string>>;
  confirmDelete: boolean;
  setConfirmDelete: Dispatch<SetStateAction<boolean>>;
  onDelete: (close: () => void) => Promise<boolean>;
}) {
  return <>
    <FloatingComposer title="Багш хасах" label="Багш хасах" trigger={<button type="button" style={actionStyle} disabled={busy}><Trash2 size={17} /> Багш хасах</button>}>
      {(close) => <div style={{ display: 'grid', gap: 12 }}>
        <select value={selectedTeacherId} onChange={(event) => { setSelectedTeacherId(event.target.value); setConfirmDelete(false); }} style={fieldStyle}>
          <option value="">Багш сонгох</option>
          {teachers.map((item) => <option key={item.auth_id} value={item.auth_id}>{item.last_name} {item.first_name} — {item.email}</option>)}
        </select>
        {!confirmDelete ? <button type="button" disabled={!selectedTeacherId} onClick={() => setConfirmDelete(true)} style={{ ...actionStyle, justifyContent: 'center', background: '#dc2626', borderRadius: 9 }}>Устгах</button> : (
          <div style={{ display: 'grid', gap: 10, padding: 14, borderRadius: 10, background: '#fef2f2', border: '1px solid #fecaca' }}>
            <strong>Сонгосон багшийг устгах уу?</strong>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" onClick={() => void onDelete(close)} disabled={busy} style={{ ...actionStyle, justifyContent: 'center', background: '#dc2626', borderRadius: 8 }}>Тийм, устгах</button>
              <button type="button" onClick={() => setConfirmDelete(false)} style={{ ...actionStyle, justifyContent: 'center', background: '#64748b', borderRadius: 8 }}>Буцах</button>
            </div>
          </div>
        )}
      </div>}
    </FloatingComposer>
  </>;
}
