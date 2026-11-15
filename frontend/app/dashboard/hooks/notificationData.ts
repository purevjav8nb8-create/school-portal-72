import { backendBaseUrl, fetchWithAuth } from '../../../lib/backendApi';
import { DashboardCategory } from '../types';

export type NotificationItem = { id: string; category: DashboardCategory };

type AnnouncementRecord = { id?: string; kind?: 'Мэдээлэл' | 'Зар' };
type SurveyRecord = { id?: string; response_ids?: string[] };
type ChatConversationRecord = { unread_message_ids?: string[] };
type UpdatedRecord = { id?: string; createdAt?: string; submittedAt?: string; reviewedAt?: string; updatedAt?: string };
export type EvaluationNotificationRecord = {
  grade?: number | string;
  section?: string;
  subject?: string;
  level?: string;
  students_count?: number | string;
  average_score?: number | string;
};
type TeacherRecord = {
  user_id?: string;
  trainings?: { id?: string }[];
  evaluations?: (EvaluationNotificationRecord & {
    id?: string;
    createdAt?: string;
    evaluation_date?: string;
  })[];
  activities?: UpdatedRecord[];
  program_plan?: UpdatedRecord & {
    approved?: boolean;
    returned?: boolean;
    review_status?: 'pending' | 'returned' | 'approved';
  };
};

const categories: DashboardCategory[] = ['Мэдээлэл', 'Зар', 'Судалгаа', 'Үнэлгээ', 'Сургалт', 'Оролцоо', 'Шагнал', 'Зэрэг', 'Хянах', 'Хөтөлбөр', 'Чат'];
const apiUrl = backendBaseUrl;
const transientStatuses = [502, 503, 504];

export function reviewPlanNotificationId(userId: string, submittedAt?: string, id?: string) {
  return `${userId}:program-plan:${submittedAt ?? id ?? 'pending'}`;
}

export function returnedPlanNotificationId(submittedAt: string, reviewedAt?: string) {
  return `returned-program-plan:${submittedAt}:${reviewedAt ?? 'returned'}`;
}

export function evaluationNotificationId(userId: string, evaluation: UpdatedRecord) {
  return `${userId}:evaluations:${evaluation.createdAt ?? evaluation.submittedAt ?? evaluation.reviewedAt ?? evaluation.updatedAt ?? evaluation.id ?? 'existing'}`;
}

export function isValidEvaluationRecord(evaluation: EvaluationNotificationRecord) {
  const grade = Number(evaluation.grade);
  const studentsCount = Number(evaluation.students_count);
  const averageScore = Number(evaluation.average_score);
  return Number.isInteger(grade)
    && grade > 0
    && String(evaluation.section ?? '').trim().length > 0
    && String(evaluation.subject ?? '').trim().length > 0
    && ['VIII', 'VII', 'VI', 'V', 'IV', 'III', 'II', 'I'].includes(evaluation.level ?? '')
    && Number.isFinite(studentsCount)
    && studentsCount > 0
    && Number.isFinite(averageScore);
}

async function fetchNotificationResponse(url: string, headers: HeadersInit): Promise<Response> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetchWithAuth(url, { headers });
      if (!transientStatuses.includes(response.status) || attempt === 1) return response;
    } catch (error) {
      const retryable = error instanceof TypeError
        || (error instanceof Error && error.message.includes('Нэвтрэх эрхийг шалгаж чадсангүй'));
      if (!retryable || attempt === 1) throw error;
    }
    await new Promise((resolve) => window.setTimeout(resolve, 500));
  }
  throw new Error('Мэдэгдлийн мэдээллийг татаж чадсангүй.');
}

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
  if (role === 'admin') return [];
  const headers = { Authorization: `Bearer ${accessToken}` };
  const [announcementsResponse, conversationsResponse] = await Promise.all([
    fetchNotificationResponse(`${apiUrl}/api/teachers/announcements`, headers),
    fetchNotificationResponse(`${apiUrl}/api/teachers/chat/conversations`, headers),
  ]);
  const announcementRecords = await readResponse<AnnouncementRecord[]>(announcementsResponse);
  const nextItems = [...personalItems];
  announcementRecords.forEach((record) => {
    if (!record.id) return;
    nextItems.push({
      id: String(record.id),
      category: record.kind === 'Мэдээлэл' ? 'Мэдээлэл' : 'Зар',
    });
  });

  const conversations = await readResponse<ChatConversationRecord[]>(conversationsResponse);
  conversations.forEach((conversation) => {
    conversation.unread_message_ids?.forEach((id) => nextItems.push({ id, category: 'Чат' }));
  });

  if (role === 'manager') {
    const [surveysResponse, reviewResponse] = await Promise.all([
      fetchNotificationResponse(`${apiUrl}/api/teachers/surveys`, headers),
      fetchNotificationResponse(`${apiUrl}/api/teachers/review`, headers),
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
      addRecords(record.activities, 'Оролцоо');
      const validEvaluations = record.evaluations?.filter(isValidEvaluationRecord) ?? [];
      if (validEvaluations.length) {
        const latestEvaluation = [...validEvaluations].sort((left, right) =>
          String(right.createdAt ?? right.evaluation_date ?? right.id ?? '')
            .localeCompare(String(left.createdAt ?? left.evaluation_date ?? left.id ?? '')),
        )[0];
        nextItems.push({
          id: evaluationNotificationId(record.user_id, {
            ...latestEvaluation,
            submittedAt: latestEvaluation.evaluation_date,
          }),
          category: 'Үнэлгээ',
        });
      }
      const plan = record.program_plan;
      if (plan && !plan.approved && !plan.returned && plan.review_status !== 'returned' && plan.review_status !== 'approved') {
        nextItems.push({
          id: reviewPlanNotificationId(record.user_id, plan.submittedAt, plan.id),
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
