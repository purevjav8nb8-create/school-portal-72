import { backendBaseUrl, fetchWithAuth } from '../../../lib/backendApi';
import { DashboardCategory } from '../types';

export type NotificationItem = { id: string; category: DashboardCategory };

type AnnouncementRecord = { id?: string };
type SurveyRecord = { id?: string; response_ids?: string[] };
type UpdatedRecord = { id?: string; createdAt?: string; submittedAt?: string; reviewedAt?: string; updatedAt?: string };
type TeacherRecord = {
  user_id?: string;
  trainings?: { id?: string }[];
  evaluations?: { id?: string; createdAt?: string; evaluation_date?: string }[];
  activities?: UpdatedRecord[];
  awards?: UpdatedRecord[];
  professional_degrees?: UpdatedRecord[];
  teaching_classes_updated_at?: string;
  program_plan?: UpdatedRecord;
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
      if (record.evaluations?.length) {
        const latestEvaluation = [...record.evaluations].sort((left, right) =>
          String(right.createdAt ?? right.evaluation_date ?? right.id ?? '')
            .localeCompare(String(left.createdAt ?? left.evaluation_date ?? left.id ?? '')),
        )[0];
        nextItems.push({
          id: `${record.user_id}:evaluations:${latestEvaluation.createdAt ?? latestEvaluation.evaluation_date ?? latestEvaluation.id ?? 'existing'}`,
          category: 'Үнэлгээ',
        });
      }
      const reviewUpdates = [
        ...(record.activities ?? []),
        ...(record.awards ?? []),
        ...(record.professional_degrees ?? []),
        ...(record.program_plan ? [record.program_plan] : []),
        ...(record.teaching_classes_updated_at
          ? [{ id: record.teaching_classes_updated_at, updatedAt: record.teaching_classes_updated_at }]
          : []),
      ].flatMap((item) => {
        const id = item.id ?? item.submittedAt ?? item.createdAt ?? item.updatedAt;
        if (!id) return [];
        return [{ id, timestamp: item.updatedAt ?? item.submittedAt ?? item.createdAt ?? id }];
      });
      const latestReviewUpdate = reviewUpdates.sort((left, right) =>
        right.timestamp.localeCompare(left.timestamp) || right.id.localeCompare(left.id),
      )[0];
      if (latestReviewUpdate) {
        nextItems.push({
          id: `${record.user_id}:${latestReviewUpdate.id}`,
          category: 'Хянах',
        });
      }
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
