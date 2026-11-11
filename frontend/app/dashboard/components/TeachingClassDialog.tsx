'use client';

import { Teacher } from '../types';
import { gradesForUnit, romanGrade } from './records/ClassFields';

type TeachingClass = NonNullable<Teacher['teaching_classes']>[number];

export default function TeachingClassDialog({
  unit,
  selectedClass,
  dialog,
  draft,
  onDraftChange,
  onDialogChange,
  onSave,
  onDelete,
}: {
  unit: string;
  selectedClass: TeachingClass;
  dialog: 'actions' | 'edit' | 'delete';
  draft: TeachingClass;
  onDraftChange: (value: TeachingClass) => void;
  onDialogChange: (value: 'actions' | 'edit' | 'delete' | null) => void;
  onSave: () => void;
  onDelete: () => void;
}) {
  const grades = gradesForUnit(unit);
  return (
    <div role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onDialogChange(null)} style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'grid', placeItems: 'center', padding: 16, background: 'rgba(15, 23, 42, .45)' }}>
      <section role="dialog" aria-modal="true" style={{ width: 'min(360px, 100%)', padding: 18, borderRadius: 10, background: '#fff', boxShadow: '0 20px 60px rgba(0,0,0,.25)' }}>
        {dialog === 'actions' && <>
          <h3 style={{ margin: '0 0 14px', fontSize: 16 }}>{selectedClass.grade}-р анги {selectedClass.section}</h3>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button type="button" onClick={() => { onDraftChange(selectedClass); onDialogChange('edit'); }} style={dialogButton('#2563eb')}>Засах</button>
            <button type="button" onClick={() => onDialogChange('delete')} style={dialogButton('#dc2626')}>Устгах</button>
            <button type="button" onClick={() => onDialogChange(null)} style={dialogButton('#64748b')}>Буцах</button>
          </div>
        </>}
        {dialog === 'edit' && <>
          <h3 style={{ margin: '0 0 12px', fontSize: 16 }}>Анги засах</h3>
          <label>Анги<select value={draft.grade} onChange={(event) => onDraftChange({ ...draft, grade: Number(event.target.value) })} style={fieldStyle}>{grades.map((grade) => <option key={grade} value={grade}>{romanGrade(grade)} анги</option>)}</select></label>
          <label>Бүлэг<select value={draft.section} onChange={(event) => onDraftChange({ ...draft, section: event.target.value })} style={fieldStyle}>{['А', 'Б', 'В', 'Г', 'Д', 'Е'].map((section) => <option key={section}>{section}</option>)}</select></label>
          <label>7 хоногийн цаг<input type="number" min={1} value={draft.weekly_hours} onChange={(event) => onDraftChange({ ...draft, weekly_hours: Math.max(1, Number(event.target.value)) })} style={fieldStyle} /></label>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
            <button type="button" onClick={onSave} style={dialogButton('#16a34a')}>Хадгалах</button>
            <button type="button" onClick={() => onDialogChange('actions')} style={dialogButton('#64748b')}>Буцах</button>
          </div>
        </>}
        {dialog === 'delete' && <>
          <h3 style={{ margin: '0 0 8px', fontSize: 16 }}>Анги устгах уу?</h3>
          <p style={{ margin: '0 0 16px', color: '#475569' }}>{selectedClass.grade}-р анги {selectedClass.section} ангийг устгах гэж байна.</p>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button type="button" onClick={onDelete} style={dialogButton('#dc2626')}>Устгах</button>
            <button type="button" onClick={() => onDialogChange('actions')} style={dialogButton('#64748b')}>Буцах</button>
          </div>
        </>}
      </section>
    </div>
  );
}

const fieldStyle = { display: 'block', width: '100%', marginTop: 4, padding: 9, border: '1px solid #cbd5e1', borderRadius: 6, boxSizing: 'border-box' as const };
const dialogButton = (background: string) => ({ padding: '7px 10px', border: 0, borderRadius: 6, background, color: '#fff', cursor: 'pointer', fontSize: 12 });
