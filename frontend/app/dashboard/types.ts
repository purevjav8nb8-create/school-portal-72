export interface UserProfile {
  last_name: string;
  first_name: string;
  email: string;
  unit: string;
  subject: string;
  subjects?: string[];
  teaching_classes?: Array<{ grade: number; section: string; weekly_hours: number; homeroom?: boolean }>;
  role: 'admin' | 'manager' | 'teacher';
  lms_username?: string;
}

export interface DailyAttendance {
  day: number; // 1-31
  status: 'Ирсэн' | 'Хоцорсон' | 'Чөлөөтэй' | 'Өвчтэй' | 'Тасалсан' | 'Амралтын өдөр';
}

export interface Teacher {
  id: number;
  auth_id?: string;
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
  teaching_classes?: Array<{ grade: number; section: string; weekly_hours: number; homeroom?: boolean }>;
  weekly_teaching_hours?: number;
  overtime_hours?: number;
  daily_records?: Array<{ date: string; status: DailyAttendance['status'] }>;
  training_records?: Array<{
    id: string;
    name: string;
    startDate: string;
    endDate: string;
    trainingType?: 'Үндсэн' | 'Төрөлжсөн' | 'Сонголтот' | 'Ажлын байран дээрх сургалт' | 'Бусад';
    certificateUrl: string;
    imageUrl?: string | null;
  }>;
  evaluation_records?: Array<{ grade: number; subject?: string }>;
}

export type DashboardCategory = 'Ирц' | 'Сургалт' | 'Үнэлгээ' | 'Хөтөлбөр' | 'Оролцоо' | 'Судалгаа' | 'Мэдээлэл' | 'Шагнал' | 'Зэрэг' | 'Хянах' | 'Зар' | 'Чат';

export type ReportGradeBand = 'all' | 'primary' | 'middle' | 'high';