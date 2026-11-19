'use client';

import { useEffect, useState } from 'react';
import { backendBaseUrl, fetchWithAuth } from '../../lib/backendApi';
import { supabase } from '../../lib/supabaseClient';
import AdminDashboardView from './components/AdminDashboardView';
import { DashboardCategory, ReportGradeBand, Teacher, UserProfile } from './types';
import { useTeachers } from './hooks/useTeachers';
import { useNotifications } from './hooks/useNotifications';
import { reviewPlanNotificationId } from './hooks/notificationData';
import { schoolMonth, schoolToday } from '../../lib/schoolDate';

const apiUrl = backendBaseUrl;

export default function DashboardPage() {
  const [activeCategory, setActiveCategory] = useState<DashboardCategory>('Ирц');
  const [activeUnit, setActiveUnit] = useState<'НИЙТ' | 'БАЗАН' | 'БУЗАН' | 'НУЗАН'>('НИЙТ');
  const [selectedMonth, setSelectedMonth] = useState(schoolMonth);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState('');
  const [user, setUser] = useState<UserProfile | null>(null);
  const [selectedTeacher, setSelectedTeacher] = useState<Teacher | null>(null);
  const [reportGradeBand, setReportGradeBand] = useState<ReportGradeBand>('all');
  const [reportSubject, setReportSubject] = useState('');
  const { teachers, setTeachers, displayTeachers, errorMessage: teacherLoadError } = useTeachers(activeUnit, !loading && !!user);
  const { counts: notificationCounts, unreadItems, errorMessage: notificationError, markItemRead } = useNotifications(
    user?.role ?? 'admin',
    undefined,
    !loading && user?.role === 'manager',
  );

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) throw error;
        const authUser = session?.user;
        if (!authUser) {
          window.location.href = '/';
          return;
        }
        const role = authUser.app_metadata?.role;
        if (role !== 'admin' && role !== 'manager' && authUser.email?.toLowerCase() !== 'admin@moes.edu.mn') {
          window.location.href = '/dashboard/teacher';
          return;
        }
        setUser({
          last_name: authUser.user_metadata?.last_name ?? 'Системийн',
          first_name: authUser.user_metadata?.first_name ?? 'Админ',
          email: authUser.email ?? '',
          unit: authUser.user_metadata?.unit ?? 'Захиргаа',
          subject: authUser.user_metadata?.subject ?? 'Администратор',
          role: role === 'manager' ? 'manager' : 'admin',
        });
      } catch {
        setAuthError('Нэвтрэх эрхийг шалгаж чадсангүй. Дахин ачаална уу.');
      } finally {
        setLoading(false);
      }
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
      const response = await fetchWithAuth(`${apiUrl}/api/teachers/${teacher.auth_id}/attendance`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: schoolToday(), status }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.detail ?? 'Ирц хадгалагдсангүй.');
      setTeachers((current) => current.map((item) => item.id === id ? { ...item, attendance: status } : item));
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Ирц хадгалагдсангүй.');
    }
  };

  if (loading) return <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>Ачаалж байна...</div>;
  if (authError) return <div role="alert" style={{ padding: 24, color: '#b91c1c' }}>{authError}</div>;
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
      notificationError={notificationError}
      unreadNotificationKeys={unreadItems}
      teacherLoadError={teacherLoadError}
      reportGradeBand={reportGradeBand}
      setReportGradeBand={setReportGradeBand}
      reportSubject={reportSubject}
      setReportSubject={setReportSubject}
      onCategoryChange={setActiveCategory}
      onNotificationItemViewed={markItemRead}
      onReviewMaterialViewed={(userId, submittedAt) => markItemRead('Хянах', reviewPlanNotificationId(userId, submittedAt))}
    />
  );
}