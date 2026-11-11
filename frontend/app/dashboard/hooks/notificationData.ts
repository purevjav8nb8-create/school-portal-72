import { backendBaseUrl, fetchWithAuth } from '../../../lib/backendApi';
import { DashboardCategory } from '../types';

export type NotificationItem = { id: string; category: DashboardCategory };

type AnnouncementRecord = { id?: string };
type SurveyRecord = { id?: string; response_ids?: string[] };
type TeacherRecord = {
  user_id?: string;
  trainings?: { id?: string }[];
  evaluations?: { id?: string }[];
  activities?: { id?: string }[];
  awards?: { id?: string }[];
  professional_degrees?: { id?: string }[];
  teaching_classes_updated_at?: string;
  program_plan?: { id?: string; submittedAt?: string };
};

const categories: DashboardCategory[] = ['Мэдээлэл', 'Зар', 'Судалгаа', 'Үнэлгээ', 'Сургалт', 'Шагнал', 'Зэрэг', 'Хянах', 'Чат'];
const apiUrl = backendBaseUrl;

async function readResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let detail = `Мэдэгдэл уншигдсангүй (${response.status}).`;
    try {
      detail = (await response.json() as { detail?: string }).detail ?? detail;
    } catch {
      // Keep the HTTP status message when the server does not return JSON.
    }
    throw new Error(detail);
  }
  return await response.json() as T;
}

export function readReadItems(storageKey: string): Set<string> {
  try {
    const stored: unknown = JSON.parse(window.localStorage.getItem(storageKey) ?? '[]');
    if (!Array.isArray(stored) || stored.some((item) => typeof item !== 'string')) {
      throw new Error('Мэдэгдлийн уншсан төлөв буруу байна.');
    }
    return new Set(stored);
  } catch (error) {
    if (error instanceof SyntaxError) throw new Error('Мэдэгдлийн уншсан төлөвийг уншиж чадсангүй.');
    throw error;
  }
}

export async function fetchNotificationItems(
  role: 'admin' | 'manager' | 'teacher',
  personalItems: NotificationItem[],
  accessToken: string,
): Promise<NotificationItem[]> {
  const headers = { Authorization: `Bearer ${accessToken}` };
  const announcementResponses = await Promise.all(
    (['Мэдээлэл', 'Зар'] as const).map((category) =>
      fetchWithAuth(`${apiUrl}/api/teachers/announcements?kind=${encodeURIComponent(category)}`, { headers }),
    ),
  );
  const announcementRecords = await Promise.all(announcementResponses.map((response) => readResponse<AnnouncementRecord[]>(response)));
  const nextItems = role !== 'teacher' ? [...personalItems] : [];
  announcementRecords.forEach((records, index) => {
    const category = (['Мэдээлэл', 'Зар'] as const)[index];
    records.forEach((record) => { if (record.id) nextItems.push({ id: String(record.id), category }); });
  });

  if (role !== 'teacher') {
    const [surveysResponse, reviewResponse] = await Promise.all([
      fetchWithAuth(`${apiUrl}/api/teachers/surveys`, { headers }),
      fetchWithAuth(`${apiUrl}/api/teachers/review`, { headers }),
    ]);
    const [surveys, teacherRecords] = await Promise.all([
      readResponse<SurveyRecord[]>(surveysResponse),
      readResponse<TeacherRecord[]>(reviewResponse),
    ]);
    const surveyIds = new Set<string>();
    surveys.forEach((survey) => {
      if (!survey.id) return;
      const surveyId = String(survey.id);
      if (surveyIds.has(surveyId)) return;
      surveyIds.add(surveyId);
      nextItems.push({ id: surveyId, category: 'Судалгаа' });
      survey.response_ids?.forEach((userId) => nextItems.push({ id: `${surveyId}:${userId}`, category: 'Судалгаа' }));
    });
    teacherRecords.forEach((record) => {
      if (!record.user_id) return;
      const addRecords = (records: { id?: string }[] | undefined, category: DashboardCategory) =>
        records?.forEach((item) => { if (item.id) nextItems.push({ id: `${record.user_id}:${item.id}`, category }); });
      addRecords(record.trainings, 'Сургалт');
      addRecords(record.evaluations, 'Үнэлгээ');
      addRecords(record.activities, 'Хянах');
      addRecords(record.awards, 'Хянах');
      addRecords(record.professional_degrees, 'Хянах');
      if (record.teaching_classes_updated_at) nextItems.push({ id: `${record.user_id}:classes:${record.teaching_classes_updated_at}`, category: 'Хянах' });
      const planId = record.program_plan?.id ?? record.program_plan?.submittedAt;
      if (planId) nextItems.push({ id: `${record.user_id}:${planId}`, category: 'Хянах' });
    });
  }

  return [...new Map(nextItems.map((item) => [`${item.category}:${item.id}`, item])).values()];
}

export function countUnreadItems(items: NotificationItem[], read: Set<string>) {
  return Object.fromEntries(categories.map((category) => [
    category,
    items.filter((item) => item.category === category && !read.has(`${category}:${item.id}`)).length,
  ])) as Partial<Record<DashboardCategory, number>>;
}
