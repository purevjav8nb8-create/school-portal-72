export const EVALUATION_LEVELS = ['VIII', 'VII', 'VI', 'V', 'IV', 'III', 'II', 'I'] as const;

export type EvaluationRecord = {
  id: string;
  grade: number;
  section: string;
  subject: string;
  level: typeof EVALUATION_LEVELS[number];
  students_count: number;
  average_score: number;
  evaluation_date: string;
  createdAt: string;
};
