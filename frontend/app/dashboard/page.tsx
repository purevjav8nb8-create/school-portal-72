'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import AdminDashboardView from './components/AdminDashboardView';
import { DashboardCategory, Teacher, UserProfile } from './types';
import { useTeachers } from './hooks/useTeachers';
import { useNotifications } from './hooks/useNotifications';

const apiUrl = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://127.0.0.1:8000';

export default function DashboardPage() {
  const [activeCategory, setActiveCategory] = useState<DashboardCategory>('Ирц');
  const [activeUnit, setActiveUnit] = useState<'НИЙТ' | 'БАЗАН' | 'БУЗАН' | 'НУЗАН'>('НИЙТ');
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [selectedTeacher, setSelectedTeacher] = useState<Teacher | null>(null);
  const { teachers, setTeachers, displayTeachers } = useTeachers(activeUnit);
  const { counts: notificationCounts, markRead } = useNotifications('admin');

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) {
        window.location.href = '/';
        return;
      }
      if (authUser.app_metadata?.role !== 'admin' && authUser.email?.toLowerCase() !== 'admin@moes.edu.mn') {
        window.location.href = '/dashboard/teacher';
        return;
      }
      setUser({
        last_name: authUser.user_metadata?.last_name ?? 'Системийн',
        first_name: authUser.user_metadata?.first_name ?? 'Админ',
        email: authUser.email ?? '',
        unit: authUser.user_metadata?.unit ?? 'Захиргаа',
        subject: authUser.user_metadata?.subject ?? 'Администратор',
        role: 'admin',
      });
      setLoading(false);
    };
    void checkAuth();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = '/';
  };

  const handleAttendanceChange = async (id: number, status: Teacher['attendance']) => {
    const teacher = teachers.find((item) => item.id === id);
    if (!teacher?.auth_id) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    try {
      const response = await fetch(`${apiUrl}/api/teachers/${teacher.auth_id}/attendance`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: new Date().toISOString().slice(0, 10), status }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.detail ?? 'Ирц хадгалагдсангүй.');
      setTeachers((current) => current.map((item) => item.id === id ? { ...item, attendance: status } : item));
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Ирц хадгалагдсангүй.');
    }
  };

  if (loading) return <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>Ачаалж байна...</div>;
  if (!user) return null;

  return (
    <AdminDashboardView
      user={user}
      activeCategory={activeCategory}
      setActiveCategory={setActiveCategory}
      activeUnit={activeUnit}
      setActiveUnit={setActiveUnit}
      selectedMonth={selectedMonth}
      setSelectedMonth={setSelectedMonth}
      teachers={teachers}
      displayTeachers={displayTeachers}
      onLogout={handleLogout}
      onTeacherSelect={setSelectedTeacher}
      selectedTeacher={selectedTeacher}
      onCloseTeacher={() => setSelectedTeacher(null)}
      onAttendanceChange={handleAttendanceChange}
      onTeachersAdded={(newTeachers) => setTeachers((current) => [...newTeachers, ...current])}
      onTeacherRemoved={(authId) => {
        setTeachers((current) => current.filter((teacher) => teacher.auth_id !== authId));
        setSelectedTeacher((current) => current?.auth_id === authId ? null : current);
      }}
      onTeacherUpdated={(updatedTeacher) => {
        setTeachers((current) => current.map((teacher) => teacher.auth_id === updatedTeacher.auth_id ? updatedTeacher : teacher));
        setSelectedTeacher(updatedTeacher);
      }}
      notificationCounts={notificationCounts}
      onCategoryChange={(category) => { markRead(category); setActiveCategory(category); }}
    />
  );
}