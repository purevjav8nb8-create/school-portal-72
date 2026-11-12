import { backendBaseUrl, fetchWithAuth } from '../../../lib/backendApi';
import { supabase } from '../../../lib/supabaseClient';
import { TeacherTraining } from '../components/TeacherDashboardView';
import { TeacherActivity } from '../components/records/ActivityPanel';
import { EvaluationRecord } from '../components/records/EvaluationPanel';
import { ProgramPlan } from '../components/records/ProgramPlanPanel';
import { UserProfile } from '../types';
import { AttendanceRecord } from '../utils/attendance';

export type TeacherWorkspace = {
  profile: UserProfile;
  teaching_classes?: NonNullable<UserProfile['teaching_classes']>;
  attendance: AttendanceRecord[];
  trainings: TeacherTraining[];
  evaluations: EvaluationRecord[];
  program_plan?: ProgramPlan;
  activities: TeacherActivity[];
  awards: { id: string; name: string; certificate_number: string; certificate_url: string; organization: string; awarded_date?: string; note: string }[];
  professional_degrees: { id: string; name: string; certificate_number: string; certificate_url: string; status: string; issued_date?: string; note: string }[];
  homeroom_evaluations?: (EvaluationRecord & { evaluator?: string; evaluator_id?: string; evaluator_email?: string })[];
};

type LoadResult = {
  workspace?: TeacherWorkspace;
  fallbackUser?: UserProfile;
  errorMessage?: string;
  redirect?: '/' | '/dashboard/admin';
  clearMockToken?: boolean;
};

export async function loadTeacherWorkspace(): Promise<LoadResult> {
  const { data: { user: authUser } } = await supabase.auth.getUser();
  const mockToken = window.localStorage.getItem('school-portal-mock-token');
  if (!authUser && !mockToken) return { redirect: '/' };
  if (mockToken && !authUser) {
    try {
      const response = await fetchWithAuth(`${backendBaseUrl}/api/teachers/me`, { headers: { Authorization: `Bearer ${mockToken}` } });
      const workspace = await response.json() as TeacherWorkspace;
      if (!response.ok) throw new Error('Загвар багшийн мэдээлэл уншигдсангүй.');
      return { workspace };
    } catch {
      return { redirect: '/', clearMockToken: true };
    }
  }
  if (authUser && mockToken) window.localStorage.removeItem('school-portal-mock-token');
  if (authUser?.app_metadata?.role === 'admin' || authUser?.app_metadata?.role === 'manager' || authUser?.email?.toLowerCase() === 'admin@moes.edu.mn') {
    return { redirect: '/dashboard/admin' };
  }
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return { redirect: '/' };

  try {
    const response = await fetchWithAuth(`${backendBaseUrl}/api/teachers/me`, { headers: { Authorization: `Bearer ${session.access_token}` } });
    const result = await response.json();
    if (!response.ok) throw new Error(result.detail ?? 'Багшийн мэдээлэл уншигдсангүй.');
    return { workspace: result as TeacherWorkspace };
  } catch (error) {
    const metadata = authUser!.user_metadata ?? {};
    return {
      fallbackUser: {
        last_name: metadata.last_name ?? metadata.family_name ?? '',
        first_name: metadata.first_name ?? metadata.given_name ?? authUser!.email?.split('@')[0] ?? 'Багш',
        email: authUser!.email ?? '',
        unit: String(metadata.unit ?? 'Нэгж бүртгэгдээгүй').trim().toUpperCase(),
        subject: metadata.subject ?? 'Мэргэжил бүртгэгдээгүй',
        subjects: metadata.subjects ?? (metadata.subject ? [metadata.subject] : []),
        role: 'teacher',
      },
      errorMessage: error instanceof TypeError
        ? 'Сервертэй холбогдож чадсангүй. Backend API-г асаана уу.'
        : error instanceof Error ? error.message : 'Мэдээлэл уншигдсангүй.',
    };
  }
}
