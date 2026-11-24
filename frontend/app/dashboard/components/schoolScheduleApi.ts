import { backendBaseUrl, fetchWithAuth } from '../../../lib/backendApi';

export interface AcademicTerm {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  grades: number[];
  modality: 'in_person' | 'online';
}

export interface AcademicYear {
  academic_year: string;
  start_date: string;
  end_date: string;
  terms: AcademicTerm[];
  updated_at?: string;
}

export interface ScheduleStatus {
  uploaded: boolean;
  imported_lessons: number;
  teachers: number;
  updated_at: string | null;
  source_term_id?: string;
  preview_lessons?: SchedulePreviewLesson[];
}

export interface SchedulePreviewLesson {
  grade: number;
  section: string;
  subject: string;
  weekday: number;
  week_type: 'all' | 'even' | 'odd';
  lesson_number: number;
  teacher_name: string;
  teacher_email: string;
}

export interface OvertimeTeacher {
  teacher_id: string;
  teacher_name: string;
  email: string;
  weekly_norm: 19;
  weekly_base_hours: number;
  weekly_even_hours: number;
  weekly_odd_hours: number;
  active_workdays: number;
  scheduled_hours: number;
  substitute_hours: number;
  actual_hours: number;
  norm_hours: number;
  overtime_hours: number;
}

export interface OvertimeReport {
  academic_year: string;
  month: string;
  first_week_type: 'odd';
  teachers: OvertimeTeacher[];
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetchWithAuth(`${backendBaseUrl}${path}`, init);
  if (!response.ok) {
    let detail = 'Хуваарийн хүсэлт амжилтгүй боллоо.';
    try {
      const result = await response.json() as { detail?: unknown };
      if (typeof result.detail === 'string') detail = result.detail;
    } catch {
      throw new Error(`Хуваарийн серверийн хариу буруу байна (${response.status}).`);
    }
    throw new Error(detail);
  }
  return response.json() as Promise<T>;
}

export function listAcademicYears() {
  return request<AcademicYear[]>('/api/teachers/academic-years');
}

export function saveAcademicYear(structure: AcademicYear) {
  return request<AcademicYear>('/api/teachers/academic-years', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(structure),
  });
}

export function deleteAcademicYear(academicYear: string) {
  return request<{ deleted: boolean }>(`/api/teachers/academic-years/${encodeURIComponent(academicYear)}`, {
    method: 'DELETE',
  });
}

export function getScheduleStatus(academicYear: string, termId?: string) {
  const query = termId ? `?term_id=${encodeURIComponent(termId)}` : '';
  return request<ScheduleStatus>(`/api/teachers/academic-years/${encodeURIComponent(academicYear)}/schedule${query}`);
}

export function importSchedule(academicYear: string, file: File, termId?: string) {
  const body = new FormData();
  body.set('file', file);
  const query = termId ? `?term_id=${encodeURIComponent(termId)}` : '';
  return request<{
    imported_lessons: number;
    teachers: number;
    homeroom_teachers: number;
    homeroom_classes: number;
  }>(
    `/api/teachers/academic-years/${encodeURIComponent(academicYear)}/schedule${query}`,
    { method: 'POST', body },
  );
}

export function getOvertimeReport(academicYear: string, month: string) {
  return request<OvertimeReport>(
    `/api/teachers/academic-years/${encodeURIComponent(academicYear)}/overtime?month=${month}-01`,
  );
}

export function getMyOvertimeReport(month: string) {
  return request<OvertimeReport>(
    `/api/teachers/me/schedule-overtime?month=${month}-01`,
  );
}

export function saveSubstituteHours(academicYear: string, month: string, teachers: OvertimeTeacher[]) {
  return request<{ saved: number }>(
    `/api/teachers/academic-years/${encodeURIComponent(academicYear)}/substitute-hours?month=${month}-01`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        entries: teachers.map((teacher) => ({
          teacher_id: teacher.teacher_id,
          hours: teacher.substitute_hours,
        })),
      }),
    },
  );
}

export function saveTeacherSubstituteHours(
  academicYear: string,
  month: string,
  teacherId: string,
  hours: number,
) {
  return saveSubstituteHours(academicYear, month, [{
    teacher_id: teacherId,
    teacher_name: '',
    email: '',
    weekly_norm: 19,
    weekly_base_hours: 0,
    weekly_even_hours: 0,
    weekly_odd_hours: 0,
    active_workdays: 0,
    scheduled_hours: 0,
    substitute_hours: hours,
    actual_hours: 0,
    norm_hours: 0,
    overtime_hours: 0,
  }]);
}

export async function downloadSavedSchedule(academicYear: string, termId?: string): Promise<Blob> {
  const query = termId ? `?term_id=${encodeURIComponent(termId)}` : '';
  const response = await fetchWithAuth(
    `${backendBaseUrl}/api/teachers/academic-years/${encodeURIComponent(academicYear)}/schedule-export${query}`,
  );
  if (!response.ok) {
    throw new Error('Хадгалагдсан хуваарийг гаргаж чадсангүй.');
  }
  return response.blob();
}

export async function downloadScheduleTemplate(academicYear: string): Promise<Blob> {
  const response = await fetchWithAuth(`${backendBaseUrl}/api/teachers/academic-years/${encodeURIComponent(academicYear)}/schedule-template`);
  if (!response.ok) {
    let detail = 'Хуваарийн загварыг татаж чадсангүй.';
    try {
      const result = await response.json() as { detail?: unknown };
      if (typeof result.detail === 'string') detail = result.detail;
    } catch {
      throw new Error(`Хуваарийн загварын серверийн хариу буруу байна (${response.status}).`);
    }
    throw new Error(detail);
  }
  return response.blob();
}
