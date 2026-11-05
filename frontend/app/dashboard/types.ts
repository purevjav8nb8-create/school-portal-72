export interface UserProfile {
  last_name: string;
  first_name: string;
  email: string;
  unit: string;
  subject: string;
  role: 'admin' | 'teacher';
  lms_username?: string;
}

export interface DailyAttendance {
  day: number; // 1-31
  status: 'Ирсэн' | 'Хоцорсон' | 'Чөлөөтэй' | 'Өвчтэй' | 'Тасалсан' | 'Амралтын өдөр';
}

export interface Teacher {
  id: number;
  last_name: string;
  first_name: string;
  email: string;
  unit: 'БАЗАН' | 'БУЗАН' | 'НУЗАН';
  subject: string;
  attendance: 'Ирсэн' | 'Хоцорсон' | 'Чөлөөтэй' | 'Өвчтэй' | 'Тасалсан';
  monthly_attendance_rate: number;
  training_status: 'Хамрагдсан' | 'Хамрагдаж байгаа' | 'Хамрагдаагүй';
  rating: number;
  monthly_login_count: number;
  daily_records?: Record<string, DailyAttendance[]>; // "2026-01": [{day: 1, status: 'Ирсэн'}, ...]
}