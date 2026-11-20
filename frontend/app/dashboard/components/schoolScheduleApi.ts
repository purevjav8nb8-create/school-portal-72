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

export function getScheduleStatus(academicYear: string) {
  return request<ScheduleStatus>(`/api/teachers/academic-years/${encodeURIComponent(academicYear)}/schedule`);
}

export function importSchedule(academicYear: string, file: File) {
  const body = new FormData();
  body.set('file', file);
  return request<{ imported_lessons: number; teachers: number }>(
    `/api/teachers/academic-years/${encodeURIComponent(academicYear)}/schedule`,
    { method: 'POST', body },
  );
}

export function getOvertimeReport(academicYear: string, month: string) {
  return request<OvertimeReport>(
    `/api/teachers/academic-years/${encodeURIComponent(academicYear)}/overtime?month=${month}-01`,
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
