'use client';

import { ChangeEvent, Dispatch, FormEvent, SetStateAction, useRef, useState } from 'react';
import { FileUp, UserPlus } from 'lucide-react';
import { Teacher } from '../types';
import FloatingComposer from './records/FloatingComposer';
import { subjectsForUnit } from './records/ClassFields';
import { ManagedUser } from './adminTeacherToolsApi';
import { formatTeacherName } from '../utils/teacherName';

type TeacherDraft = { first_name: string; last_name: string; email: string; unit: Teacher['unit']; subject: string; password: string };
const actionStyle = { display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '7px 10px', border: 'none', borderRadius: 24, background: '#fb923c', color: '#fff', fontWeight: 600, fontSize: 12, cursor: 'pointer', textAlign: 'left' as const, boxShadow: '0 2px 6px rgba(251, 146, 60, 0.25)' };
const fieldStyle = { width: '100%', boxSizing: 'border-box' as const, padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: 8, background: '#f8fafc', color: '#1e293b', fontSize: 13, outline: 'none' };

export default function AdminTeacherCreationTools({
  busy, teacher, setTeacher, isManager, setIsManager, managedUsers, selectedUserId,
  setSelectedUserId, targetPassword, setTargetPassword, onAddTeacher, onResetPassword,
  onDownloadTemplate, onImport,
}: {
  busy: boolean;
  teacher: TeacherDraft;
  setTeacher: Dispatch<SetStateAction<TeacherDraft>>;
  isManager: boolean;
  setIsManager: Dispatch<SetStateAction<boolean>>;
  managedUsers: ManagedUser[];
  selectedUserId: string;
  setSelectedUserId: Dispatch<SetStateAction<string>>;
  targetPassword: string;
  setTargetPassword: Dispatch<SetStateAction<string>>;
  onAddTeacher: (event: React.FormEvent<HTMLFormElement>) => Promise<boolean>;
  onResetPassword: (event: FormEvent<HTMLFormElement>, close: () => void) => Promise<boolean>;
  onDownloadTemplate: () => void;
  onImport: (file?: File) => Promise<boolean>;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [resetMode, setResetMode] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const [userOptionsOpen, setUserOptionsOpen] = useState(false);
  const filteredUsers = managedUsers.filter((item) =>
    `${item.last_name} ${item.first_name} ${item.email} ${item.role}`.toLocaleLowerCase().includes(userSearch.trim().toLocaleLowerCase())
  );
  const selectedUser = managedUsers.find((item) => item.id === selectedUserId);
  const userLabel = (item: ManagedUser) => `${formatTeacherName(`${item.last_name} ${item.first_name}`)} — ${item.email} (${item.role})`;
  return <>
    <FloatingComposer title={resetMode ? 'Нууц үг шинэчлэх' : 'Шинэ хэрэглэгч нэмэх'} label="Багш нэмэх" onOpen={() => setResetMode(false)} headerAction={resetMode ? <button type="button" onClick={() => setResetMode(false)} style={{ ...actionStyle, width: 'auto', padding: '6px 9px' }}>Багш нэмэх</button> : <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <button type="button" onClick={onDownloadTemplate} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '6px 9px', border: 0, borderRadius: 8, background: '#fb923c', color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}><FileUp size={13} /> Загвар файл</button>
      <button type="button" onClick={() => setResetMode(true)} style={{ ...actionStyle, width: 'auto', padding: '6px 9px', borderRadius: 8 }}>Нууц үг солих</button>
    </div>} trigger={<button type="button" style={actionStyle} disabled={busy}><UserPlus size={17} /> Багш нэмэх</button>}>
      {(close) => resetMode ? <form onSubmit={(event) => void onResetPassword(event, close)} style={{ display: 'grid', gap: 12 }}>
        <div style={labelStyle}>
          <label htmlFor="password-user-search">Хэрэглэгч</label>
          <div style={{ position: 'relative' }}>
            <input
              id="password-user-search"
              type="search"
              role="combobox"
              aria-autocomplete="list"
              aria-expanded={userOptionsOpen}
              aria-controls="password-user-options"
              aria-label="Хэрэглэгч хайж сонгох"
              required
              value={selectedUser ? userLabel(selectedUser) : userSearch}
              onFocus={() => setUserOptionsOpen(true)}
              onBlur={() => setUserOptionsOpen(false)}
              onChange={(event) => {
                setSelectedUserId('');
                setUserSearch(event.target.value);
                setUserOptionsOpen(true);
              }}
              placeholder="Нэр, овог эсвэл имэйлээр хайх"
              style={fieldStyle}
            />
            {userOptionsOpen && <div id="password-user-options" role="listbox" style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 5, maxHeight: 220, overflowY: 'auto', border: '1px solid #cbd5e1', borderRadius: 8, background: '#fff', boxShadow: '0 8px 20px rgba(15,23,42,.14)' }}>
              {filteredUsers.length ? filteredUsers.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  role="option"
                  aria-selected={item.id === selectedUserId}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    setSelectedUserId(item.id);
                    setUserSearch(userLabel(item));
                    setUserOptionsOpen(false);
                  }}
                  style={{ display: 'block', width: '100%', padding: '9px 10px', border: 0, borderBottom: '1px solid #e2e8f0', background: item.id === selectedUserId ? '#eff6ff' : '#fff', color: '#1e293b', textAlign: 'left', cursor: 'pointer' }}
                >
                  {userLabel(item)}
                </button>
              )) : <p style={{ margin: 0, padding: 10, color: '#b91c1c', fontWeight: 400 }}>Хайлтад тохирох хэрэглэгч олдсонгүй.</p>}
            </div>}
          </div>
        </div>
        <label style={labelStyle}>Шинэ нууц үг (8+ тэмдэгт)
          <input required type="password" minLength={8} autoComplete="new-password" value={targetPassword} onChange={(event) => setTargetPassword(event.target.value)} style={fieldStyle} />
        </label>
        <button type="submit" disabled={busy || !selectedUserId} style={{ ...submitStyle, justifyContent: 'center' }}>{busy ? 'Шинэчилж байна...' : 'Нууц үг шинэчлэх'}</button>
      </form> : <form onSubmit={async (event) => { if (await onAddTeacher(event)) close(); }} style={{ display: 'grid', gap: 12 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600 }}><input type="checkbox" checked={isManager} onChange={(event) => setIsManager(event.target.checked)} /> Сургалтын менежер</label>
        <label style={labelStyle}>Овог<input required placeholder="Овог" value={teacher.last_name} onChange={(event) => setTeacher({ ...teacher, last_name: event.target.value })} style={fieldStyle} /></label>
        <label style={labelStyle}>Нэр<input required placeholder="Нэр" value={teacher.first_name} onChange={(event) => setTeacher({ ...teacher, first_name: event.target.value })} style={fieldStyle} /></label>
        <label style={labelStyle}>И-мэйл<input required type="email" pattern=".+@moes\.edu\.mn" placeholder="Нэр@moes.edu.mn" value={teacher.email} onChange={(event) => setTeacher({ ...teacher, email: event.target.value })} style={fieldStyle} /></label>
        {!isManager && <>
          <label style={labelStyle}>Нэгж<select value={teacher.unit} onChange={(event) => setTeacher({ ...teacher, unit: event.target.value as Teacher['unit'], subject: '' })} style={fieldStyle}><option>БАЗАН</option><option>БУЗАН</option><option>НУЗАН</option></select></label>
          <label style={labelStyle}>Заах хичээл<select required value={teacher.subject} onChange={(event) => setTeacher({ ...teacher, subject: event.target.value })} style={fieldStyle}><option value="" disabled>Заах хичээл сонгох</option>{subjectsForUnit(teacher.unit).map((subject) => <option key={subject}>{subject}</option>)}</select></label>
        </>}
        <label style={labelStyle}>Нууц үг<input required type="password" minLength={isManager ? 6 : 8} autoComplete="new-password" placeholder={isManager ? 'Дор хаяж 6 тэмдэгт' : 'Дор хаяж 8 тэмдэгт'} value={teacher.password} onChange={(event) => setTeacher({ ...teacher, password: event.target.value })} style={fieldStyle} /></label>
        {isManager && <small style={{ color: '#b45309' }}>Менежер анх нэвтэрсний дараа нууц үгээ солино уу.</small>}
        <button type="submit" disabled={busy} style={submitStyle}>{busy ? 'Нэмж байна...' : `${isManager ? 'Менежер' : 'Багш'} үүсгэх`}</button>
      </form>}
    </FloatingComposer>
    <button type="button" title="Багана: first_name, last_name, moes, unit, subject, password" style={actionStyle} disabled={busy} onClick={() => fileInput.current?.click()}><FileUp size={17} /> Excel оруулах</button>
    <input ref={fileInput} type="file" accept=".xlsx,.csv" hidden onChange={async (event: ChangeEvent<HTMLInputElement>) => {
      await onImport(event.target.files?.[0]);
      event.target.value = '';
    }} />
  </>;
}

const labelStyle = { display: 'grid', gap: 4, fontWeight: 600 as const };
const submitStyle = { ...actionStyle, justifyContent: 'center' as const, borderRadius: 9, padding: '10px 12px' };
