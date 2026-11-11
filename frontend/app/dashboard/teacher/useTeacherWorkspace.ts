'use client';

import { useEffect, useState } from 'react';
import { TeacherTraining } from '../components/TeacherDashboardView';
import { TeacherActivity } from '../components/records/ActivityPanel';
import { EvaluationRecord } from '../components/records/EvaluationPanel';
import { ProgramPlan } from '../components/records/ProgramPlanPanel';
import { UserProfile } from '../types';
import { AttendanceRecord } from '../utils/attendance';
import { loadTeacherWorkspace, TeacherWorkspace } from './teacherWorkspaceApi';

export default function useTeacherWorkspace() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [trainings, setTrainings] = useState<TeacherTraining[]>([]);
  const [evaluations, setEvaluations] = useState<EvaluationRecord[]>([]);
  const [programPlan, setProgramPlan] = useState<ProgramPlan>();
  const [activities, setActivities] = useState<TeacherActivity[]>([]);
  const [awards, setAwards] = useState<TeacherWorkspace['awards']>([]);
  const [degrees, setDegrees] = useState<TeacherWorkspace['professional_degrees']>([]);
  const [homeroomEvaluations, setHomeroomEvaluations] = useState<NonNullable<TeacherWorkspace['homeroom_evaluations']>>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    let active = true;
    void loadTeacherWorkspace().then((result) => {
      if (!active) return;
      if (result.clearMockToken) window.localStorage.removeItem('school-portal-mock-token');
      if (result.redirect) {
        window.location.href = result.redirect;
        return;
      }
      if (result.workspace) {
        const workspace = result.workspace;
        setUser({ ...workspace.profile, unit: workspace.profile.unit.trim().toUpperCase(), teaching_classes: workspace.profile.teaching_classes ?? workspace.teaching_classes ?? [], role: 'teacher' });
        setAttendance(workspace.attendance);
        setTrainings(workspace.trainings);
        setEvaluations(workspace.evaluations);
        setProgramPlan(workspace.program_plan);
        setActivities(workspace.activities ?? []);
        setAwards(workspace.awards ?? []);
        setDegrees(workspace.professional_degrees ?? []);
        setHomeroomEvaluations(workspace.homeroom_evaluations ?? []);
      }
      if (result.fallbackUser) setUser(result.fallbackUser);
      if (result.errorMessage) setErrorMessage(result.errorMessage);
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, []);

  return {
    user, attendance, trainings, setTrainings, evaluations, setEvaluations, programPlan, setProgramPlan,
    activities, setActivities, awards, setAwards, degrees, setDegrees, homeroomEvaluations,
    loading, errorMessage, setErrorMessage,
  };
}
