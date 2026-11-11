'use client';

import { Dispatch, SetStateAction } from 'react';
import { backendBaseUrl, fetchWithAuth } from '../../../lib/backendApi';
import { supabase } from '../../../lib/supabaseClient';
import { TeacherTraining } from '../components/TeacherDashboardView';
import { ActivityInput } from '../components/records/ActivityForm';
import { TeacherActivity } from '../components/records/ActivityPanel';
import { EvaluationRecord } from '../components/records/EvaluationPanel';
import { ProgramPlan } from '../components/records/ProgramPlanPanel';
import { TeacherWorkspace } from './teacherWorkspaceApi';

type ActionsState = {
  setTrainings: Dispatch<SetStateAction<TeacherTraining[]>>;
  setActivities: Dispatch<SetStateAction<TeacherActivity[]>>;
  setEvaluations: Dispatch<SetStateAction<EvaluationRecord[]>>;
  setProgramPlan: Dispatch<SetStateAction<ProgramPlan | undefined>>;
  setAwards: Dispatch<SetStateAction<TeacherWorkspace['awards']>>;
  setDegrees: Dispatch<SetStateAction<TeacherWorkspace['professional_degrees']>>;
  setBusy: Dispatch<SetStateAction<boolean>>;
  setErrorMessage: Dispatch<SetStateAction<string>>;
  setSuccessMessage: Dispatch<SetStateAction<string>>;
};

export default function useTeacherRecordActions(state: ActionsState) {
  const saveRecord = async (path: string, payload: object, method = 'POST') => {
    let { data: { session } } = await supabase.auth.getSession();
    const mockToken = window.localStorage.getItem('school-portal-mock-token');
    if (!session && mockToken) session = { access_token: mockToken } as typeof session;
    if (!session && !mockToken) throw new Error('Дахин нэвтэрнэ үү.');
    const response = await fetchWithAuth(`${backendBaseUrl}${path}`, {
      method,
      headers: { Authorization: `Bearer ${session!.access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const responseText = await response.text();
    let result: { detail?: string; [key: string]: unknown };
    try {
      result = JSON.parse(responseText) as typeof result;
    } catch {
      throw new Error(`Серверийн хариу буруу байна (${response.status}). Backend-ээ restart хийнэ үү.`);
    }
    if (!response.ok) throw new Error(result.detail ?? 'Мэдээлэл хадгалагдсангүй.');
    return result;
  };

  const perform = async (action: () => Promise<void>, fallback: string, showSuccess = true) => {
    state.setBusy(true);
    state.setErrorMessage('');
    if (showSuccess) state.setSuccessMessage('');
    try {
      await action();
    } catch (error) {
      state.setErrorMessage(error instanceof Error ? error.message : fallback);
      throw error;
    } finally {
      state.setBusy(false);
    }
  };

  const addTraining = (training: Omit<TeacherTraining, 'id' | 'createdAt'>) => perform(async () => {
    const result = await saveRecord('/api/teachers/me/trainings', training);
    state.setTrainings((current) => [result.training as TeacherTraining, ...current]);
    state.setSuccessMessage('Сургалтын мэдээлэл хадгалагдлаа.');
  }, 'Сургалт хадгалагдсангүй.');

  const addActivity = (activity: ActivityInput) => perform(async () => {
    const result = await saveRecord('/api/teachers/me/activities', activity);
    state.setActivities((current) => [...current, result.activity as TeacherActivity]);
    state.setSuccessMessage('Тэмдэглэл админд хянуулахаар илгээгдлээ.');
  }, 'Тэмдэглэл хадгалагдсангүй.');

  const saveProfessional = async (path: string, payload: object) => {
    state.setBusy(true);
    try {
      const result = await saveRecord(path, payload);
      if (path.includes('/awards')) state.setAwards((current) => [...current, result.award as TeacherWorkspace['awards'][number]]);
      else state.setDegrees((current) => [...current, result.degree as TeacherWorkspace['professional_degrees'][number]]);
    } finally {
      state.setBusy(false);
    }
  };

  const addEvaluation = (evaluation: Omit<EvaluationRecord, 'id' | 'createdAt'>) => perform(async () => {
    const result = await saveRecord('/api/teachers/me/evaluations', evaluation);
    state.setEvaluations((current) => [...current, result.evaluation as EvaluationRecord]);
    state.setSuccessMessage('Үнэлгээ хадгалагдлаа.');
  }, 'Үнэлгээ хадгалагдсангүй.');

  const deleteEvaluation = (evaluationId: string) => perform(async () => {
    await saveRecord(`/api/teachers/me/evaluations/${evaluationId}`, {}, 'DELETE');
    state.setEvaluations((current) => current.filter((item) => item.id !== evaluationId));
    state.setSuccessMessage('Үнэлгээ устгагдлаа.');
  }, 'Үнэлгээ устгагдсангүй.');

  const submitProgramPlan = (documentUrl: string, note: string, grade: number, section: string, subject: string) => perform(async () => {
    const result = await saveRecord('/api/teachers/me/program-plan', { documentUrl, note, grade, section, subject }, 'PUT');
    state.setProgramPlan(result.program_plan as ProgramPlan);
    state.setSuccessMessage('Хөтөлбөр, төлөвлөгөөг админд илгээлээ.');
  }, 'Хөтөлбөр хадгалагдсангүй.');

  const deleteProgramPlan = () => perform(async () => {
    await saveRecord('/api/teachers/me/program-plan', {}, 'DELETE');
    state.setProgramPlan(undefined);
    state.setSuccessMessage('Хөтөлбөр, төлөвлөгөө устгагдлаа.');
  }, 'Хөтөлбөр, төлөвлөгөө устгагдсангүй.');

  const handleLogout = async () => {
    window.localStorage.removeItem('school-portal-mock-token');
    await supabase.auth.signOut();
    window.location.href = '/';
  };

  return { addTraining, addActivity, saveProfessional, addEvaluation, deleteEvaluation, submitProgramPlan, deleteProgramPlan, handleLogout };
}
