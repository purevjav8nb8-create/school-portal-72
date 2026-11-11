'use client';

import { useMemo, useState } from 'react';
import TeacherDashboardView from '../components/TeacherDashboardView';
import { Teacher } from '../types';
import { DashboardCategory } from '../types';
import { useNotifications } from '../hooks/useNotifications';
import useTeacherWorkspace from './useTeacherWorkspace';
import useTeacherRecordActions from './useTeacherRecordActions';

export default function TeacherDashboardPage() {
  const workspace = useTeacherWorkspace();
  const [activeCategory, setActiveCategory] = useState<DashboardCategory>('Ирц');
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const actions = useTeacherRecordActions({
    setTrainings: workspace.setTrainings,
    setActivities: workspace.setActivities,
    setEvaluations: workspace.setEvaluations,
    setProgramPlan: workspace.setProgramPlan,
    setAwards: workspace.setAwards,
    setDegrees: workspace.setDegrees,
    setBusy,
    setErrorMessage,
    setSuccessMessage,
  });
  const personalNotificationItems = useMemo(() => [
    ...workspace.awards.map((item) => ({ id: item.id, category: 'Шагнал' as const })),
    ...workspace.degrees.map((item) => ({ id: item.id, category: 'Зэрэг' as const })),
    ...workspace.homeroomEvaluations.map((item) => ({ id: item.id, category: 'Үнэлгээ' as const })),
  ], [workspace.awards, workspace.degrees, workspace.homeroomEvaluations]);
  const { counts: notificationCounts, errorMessage: notificationError, markRead } = useNotifications(
    'teacher',
    personalNotificationItems,
    !workspace.loading && !!workspace.user,
  );

  if (workspace.loading) return <main style={{ padding: 32 }}>Ачаалж байна...</main>;
  if (!workspace.user) return <main style={{ padding: 32 }} role="alert">{errorMessage || workspace.errorMessage || 'Багшийн мэдээлэл олдсонгүй.'}</main>;

  const user = workspace.user;
  const unit: Teacher['unit'] = ['БАЗАН', 'БУЗАН', 'НУЗАН'].includes(user.unit) ? user.unit as Teacher['unit'] : 'БАЗАН';
  const monthRecords = workspace.attendance.filter((record) => record.date.startsWith(selectedMonth));
  const latestRecord = [...workspace.attendance].sort((a, b) => b.date.localeCompare(a.date))[0];
  const teacher: Teacher = {
    id: 1,
    last_name: user.last_name,
    first_name: user.first_name,
    email: user.email,
    unit,
    subject: user.subject,
    attendance: latestRecord?.status as Teacher['attendance'] ?? 'Ирсэн',
    monthly_attendance_rate: monthRecords.length ? Math.round((monthRecords.filter((record) => record.status === 'Ирсэн').length / monthRecords.length) * 100) : 0,
    training_status: workspace.trainings.length ? 'Хамрагдсан' : 'Хамрагдаагүй',
    rating: workspace.evaluations.at(-1)?.average_score ?? 0,
    monthly_login_count: 0,
    teaching_classes: user.teaching_classes ?? [],
    daily_records: workspace.attendance,
  };

  return <TeacherDashboardView
    user={user}
    teacher={teacher}
    trainings={workspace.trainings}
    evaluations={workspace.evaluations}
    programPlan={workspace.programPlan}
    activities={workspace.activities}
    awards={workspace.awards}
    degrees={workspace.degrees}
    homeroomEvaluations={workspace.homeroomEvaluations}
    activeCategory={activeCategory}
    selectedMonth={selectedMonth}
    setSelectedMonth={setSelectedMonth}
    busy={busy}
    errorMessage={errorMessage || workspace.errorMessage}
    successMessage={successMessage}
    onCategoryChange={setActiveCategory}
    onLogout={actions.handleLogout}
    onTraining={actions.addTraining}
    onProgramPlan={actions.submitProgramPlan}
    onDeleteProgramPlan={actions.deleteProgramPlan}
    onActivity={actions.addActivity}
    onEvaluation={actions.addEvaluation}
    onDeleteEvaluation={actions.deleteEvaluation}
    onProfessionalSave={actions.saveProfessional}
    notificationCounts={notificationCounts}
    notificationError={notificationError}
    onNotificationCategoryChange={(category) => { markRead(category); setActiveCategory(category); }}
  />;
}
