import { backendBaseUrl, fetchWithAuth } from '../../../lib/backendApi';
import { supabase } from '../../../lib/supabaseClient';
import { Teacher } from '../types';
import { schoolToday } from '../../../lib/schoolDate';

export interface CreatedTeacher {
  auth_id: string;
  first_name: string;
  last_name: string;
  email: string;
  unit: Teacher['unit'];
  subject: string;
  invitation_sent?: boolean;
}

export interface ManagedUser {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  role: string;
}

export async function accessToken() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Нэвтрэх эрх дууссан байна. Дахин нэвтэрнэ үү.');
  return session.access_token;
}

export async function requestAdminJson(path: string, init: RequestInit = {}) {
  const token = await accessToken();
  const response = await fetchWithAuth(`${backendBaseUrl}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, ...init.headers },
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.detail ?? 'Хүсэлт амжилтгүй боллоо.');
  return result;
}

export function toTeacher(record: CreatedTeacher, id: number): Teacher {
  const today = schoolToday();
  return {
    id,
    auth_id: record.auth_id,
    first_name: record.first_name,
    last_name: record.last_name,
    email: record.email,
    unit: record.unit,
    subject: record.subject,
    attendance: 'Ирсэн',
    daily_records: [{ date: today, status: 'Ирсэн' }],
    monthly_attendance_rate: 100,
    training_status: 'Хамрагдаагүй',
    rating: 0,
    monthly_login_count: 0,
  };
}
