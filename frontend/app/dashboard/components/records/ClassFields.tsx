'use client';

interface Props {
  unit: string;
  subjects: string[];
  grade: number;
  section: string;
  subject: string;
  onGradeChange: (grade: number) => void;
  onSectionChange: (section: string) => void;
  onSubjectChange: (subject: string) => void;
  evaluationSubjects?: boolean;
}

const sections = ['А', 'Б', 'В', 'Г', 'Д', 'Е', 'Ё', 'Ж', 'З'];
export const SUBJECTS = ['Монгол хэл', 'Математик', 'Англи хэл', 'Орос хэл', 'Физик', 'Хими', 'Биологи', 'Газарзүй', 'Түүх', 'Нийгэм судлал', 'Мэдээллийн технологи', 'Дүрслэх урлаг', 'Хөгжим', 'Биеийн тамир', 'Технологи'];
export const SUBJECTS_BY_UNIT = {
  БАЗАН: ['Бага ангийн багш'],
  НУЗАН: ['Монгол хэл', 'Англи хэл', 'Орос хэл', 'Түүх', 'Нийгэм', 'Газар зүй'],
  БУЗАН: ['Математик', 'Физик', 'Хими', 'Биологи', 'Мэдээллийн технологи', 'Дүрслэх урлаг', 'Хөгжим', 'Биеийн тамир', 'Технологи'],
} as const;
export const EVALUATION_SUBJECTS_BY_UNIT = {
  БАЗАН: ['Монгол хэл', 'Математик', 'Хүн ба байгаль', 'Хүн ба нийгэм', 'Англи хэл', 'Дүрслэх урлаг', 'Хөгжим', 'Биеийн тамир', 'Технологи'],
  НУЗАН: SUBJECTS_BY_UNIT.НУЗАН,
  БУЗАН: SUBJECTS_BY_UNIT.БУЗАН,
} as const;

export function subjectsForUnit(unit: string): string[] {
  const normalizedUnit = unit.trim().toUpperCase() as keyof typeof SUBJECTS_BY_UNIT;
  return [...(SUBJECTS_BY_UNIT[normalizedUnit] ?? SUBJECTS)];
}

export function evaluationSubjectsForUnit(unit: string): string[] {
  const normalizedUnit = unit.trim().toUpperCase() as keyof typeof EVALUATION_SUBJECTS_BY_UNIT;
  return [...(EVALUATION_SUBJECTS_BY_UNIT[normalizedUnit] ?? SUBJECTS)];
}
const fieldStyle = {
  width: '100%',
  padding: '11px 12px',
  border: '1px solid #cbd5e1',
  borderRadius: 8,
  background: '#fff',
  color: '#172033',
  boxSizing: 'border-box' as const,
};

export function gradesForUnit(unit: string) {
  const normalizedUnit = unit.trim().toUpperCase();
  if (normalizedUnit === 'БАЗАН') return [1, 2, 3, 4, 5];
  if (normalizedUnit === 'БУЗАН' || normalizedUnit === 'НУЗАН') return [6, 7, 8, 9, 10, 11, 12];
  // Profiles created before unit metadata was added must still be usable.
  return Array.from({ length: 12 }, (_, index) => index + 1);
}

export function romanGrade(grade: number) {
  return ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'][grade] ?? String(grade);
}

export default function ClassFields({
  unit, subjects, grade, section, subject,
  onGradeChange, onSectionChange, onSubjectChange,
  evaluationSubjects = false,
}: Props) {
  const grades = gradesForUnit(unit);
  const ownSubjects = subjects.map((item) => item.trim()).filter(Boolean);
  const subjectOptions = [...new Set([
    ...ownSubjects,
    ...(evaluationSubjects ? evaluationSubjectsForUnit(unit) : subjectsForUnit(unit)),
  ])];
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 }}>
      <label style={{ display: 'grid', gap: 5, color: '#475569', fontSize: 13, fontWeight: 600 }}>
        Анги
        <select required value={grade || ''} onChange={(event) => onGradeChange(Number(event.target.value))} style={fieldStyle}>
          <option value="" disabled>Анги сонгох</option>
          {grades.map((item) => <option key={item} value={item}>{item}-р анги</option>)}
        </select>
      </label>
      <label style={{ display: 'grid', gap: 5, color: '#475569', fontSize: 13, fontWeight: 600 }}>
        Бүлэг
        <select required value={section} onChange={(event) => onSectionChange(event.target.value)} style={fieldStyle}>
          <option value="" disabled>Бүлэг сонгох</option>
          {sections.map((item) => <option key={item}>{item}</option>)}
        </select>
      </label>
      <label style={{ display: 'grid', gap: 5, color: '#475569', fontSize: 13, fontWeight: 600 }}>
        Хичээл
        <select required value={subject} onChange={(event) => onSubjectChange(event.target.value)} style={fieldStyle}>
          <option value="" disabled>Хичээл сонгох</option>
          {subjectOptions.map((item) => <option key={item}>{item}</option>)}
        </select>
      </label>
    </div>
  );
}
