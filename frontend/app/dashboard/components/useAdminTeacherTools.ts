'use client';

import { FormEvent, useEffect, useState } from 'react';
import { backendBaseUrl, fetchWithAuth } from '../../../lib/backendApi';
import { Teacher } from '../types';
import { accessToken, CreatedTeacher, ManagedUser, requestAdminJson, toTeacher } from './adminTeacherToolsApi';

export default function useAdminTeacherTools(
  onTeachersAdded: (teachers: Teacher[]) => void,
  onTeacherRemoved: (authId: string) => void,
) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [selectedTeacherId, setSelectedTeacherId] = useState('');
  const [targetPassword, setTargetPassword] = useState('');
  const [managedUsers, setManagedUsers] = useState<ManagedUser[]>([]);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [teacher, setTeacher] = useState({ first_name: '', last_name: '', email: '', unit: 'БАЗАН' as Teacher['unit'], subject: '', password: '' });
  const [isManager, setIsManager] = useState(false);

  useEffect(() => {
    if (!message) return undefined;
    const timer = window.setTimeout(() => setMessage(''), 30_000);
    return () => window.clearTimeout(timer);
  }, [message]);

  useEffect(() => {
    let active = true;
    void requestAdminJson('/api/teachers/users').then((result) => {
      if (active) setManagedUsers(result as ManagedUser[]);
    }).catch((error) => {
      if (active) setMessage(error instanceof Error ? error.message : 'Хэрэглэгчдийн жагсаалт уншигдсангүй.');
    });
    return () => { active = false; };
  }, []);

  const run = async (action: () => Promise<void>, fallback: string) => {
    setBusy(true);
    setMessage('');
    try {
      await action();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : fallback);
      return false;
    } finally {
      setBusy(false);
    }
    return true;
  };

  const addTeacher = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    return run(async () => {
      if (isManager) {
        const result = await requestAdminJson('/api/teachers/managers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            first_name: teacher.first_name,
            last_name: teacher.last_name,
            email: teacher.email,
            password: teacher.password,
          }),
        }) as { manager: { email: string } };
        setMessage(`${result.manager.email} сургалтын менежерийн эрхтэй боллоо.`);
        setTeacher({ first_name: '', last_name: '', email: '', unit: 'БАЗАН', subject: '', password: '' });
        setIsManager(false);
        return;
      }
      const result = await requestAdminJson('/api/teachers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(teacher) });
      const created = (result as { teacher: CreatedTeacher }).teacher;
      onTeachersAdded([toTeacher(created, Date.now())]);
      setMessage(`${created.email} хэрэглэгч үүслээ. Нэвтрэхдээ оруулсан нууц үгийг ашиглана.`);
      setTeacher({ first_name: '', last_name: '', email: '', unit: 'БАЗАН', subject: '', password: '' });
      setIsManager(false);
    }, 'Багш нэмэхэд алдаа гарлаа.');
  };

  const importTeachers = (file?: File) => {
    if (!file) return Promise.resolve(true);
    return run(async () => {
      const formData = new FormData();
      formData.append('file', file);
      const token = await accessToken();
      const response = await fetchWithAuth(`${backendBaseUrl}/api/teachers/bulk-upload`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: formData });
      const result = await response.json();
      if (!response.ok) throw new Error(result.detail ?? 'Файл боловсруулахад алдаа гарлаа.');
      const created = result.created as CreatedTeacher[];
      const failed = (result.failed ?? []) as { row: number; detail: string }[];
      onTeachersAdded(created.map((item, index) => toTeacher(item, Date.now() + index)));
      const credentials = created.map((item) => `${item.email}: ${item.password ?? 'Excel файлаас өгсөн нууц үг'}`);
      const failures = failed.map((item) => `Мөр ${item.row}: ${item.detail}`);
      setMessage([...credentials, ...failures].join('\n') || 'Файлаас хэрэглэгч үүсгэсэнгүй.');
    }, 'Файл боловсруулахад алдаа гарлаа.');
  };

  const deleteTeacher = (close: () => void) => run(async () => {
    await requestAdminJson(`/api/teachers/${selectedTeacherId}`, { method: 'DELETE' });
    onTeacherRemoved(selectedTeacherId);
    setSelectedTeacherId('');
    setConfirmDelete(false);
    close();
  }, 'Багшийг устгаж чадсангүй.');

  const resetTeacherPassword = (event: FormEvent<HTMLFormElement>, close: () => void) => {
    event.preventDefault();
    if (!selectedTeacherId) return Promise.resolve(false);
    return run(async () => {
      await requestAdminJson(`/api/teachers/users/${selectedTeacherId}/password`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: targetPassword }) });
      setMessage('Сонгосон хэрэглэгчийн нууц үг шинэчлэгдлээ.');
      setTargetPassword('');
      setSelectedTeacherId('');
      close();
    }, 'Нууц үг шинэчлэгдсэнгүй.');
  };

  const downloadTemplate = () => {
    const csv = ['first_name,last_name,email,unit,subject,password', 'Болормаа,Бат,bagsh@moes.edu.mn,БАЗАН,Математик,12345678'].join('\n');
    const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'teacher-import-template.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  return {
    busy, message, teacher, setTeacher, isManager, setIsManager, selectedTeacherId, setSelectedTeacherId,
    targetPassword, setTargetPassword, managedUsers, confirmDelete, setConfirmDelete,
    addTeacher, importTeachers, deleteTeacher, resetTeacherPassword, downloadTemplate,
  };
}
