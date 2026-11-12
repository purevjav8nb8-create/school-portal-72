export type SurveyQuestionType = 'single_choice' | 'multiple_choice' | 'short_text' | 'rating';
export type SurveyQuestion = { text: string; type: SurveyQuestionType; options: string[] };
export type SurveyAnswer = string | string[];
export type Survey = {
  id: string;
  title: string;
  description: string;
  author?: string;
  can_view_results?: boolean;
  can_delete?: boolean;
  questions?: (Partial<SurveyQuestion> | string)[];
  options?: string[];
  target_units: string[];
  starts_at?: string;
  ends_at?: string;
  accepts_responses?: boolean;
  responses?: Record<string, SurveyAnswer>;
  response_ids?: string[];
  respondent_names?: string[];
  response_summary?: Record<string, Record<string, number>>;
};

export function normalizeQuestion(question: Partial<SurveyQuestion> | string, surveyOptions: string[] = []): SurveyQuestion {
  if (typeof question === 'string') return { text: question, type: 'single_choice', options: surveyOptions };
  return { text: question.text ?? '', type: question.type ?? 'single_choice', options: question.options ?? surveyOptions };
}
