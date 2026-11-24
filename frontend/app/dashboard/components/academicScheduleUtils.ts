import type { AcademicTerm, AcademicYear } from './schoolScheduleApi';

export function createDefaultYear(startYear: number): AcademicYear {
  const followingYear = startYear + 1;
  const makeTerm = (
    index: number,
    name: string,
    start_date: string,
    end_date: string,
    grades: number[] = [],
    modality: AcademicTerm['modality'] = 'in_person',
  ): AcademicTerm => ({
    id: `${String(startYear).padStart(4, '0')}0000-0000-4000-8000-${String(index).padStart(12, '0')}`,
    name,
    start_date,
    end_date,
    grades,
    modality,
  });
  return {
    academic_year: `${startYear}-${followingYear}`,
    start_date: `${startYear}-09-01`,
    end_date: `${followingYear}-06-30`,
    terms: [
      makeTerm(1, 'I улирал', `${startYear}-09-01`, `${startYear}-10-30`),
      makeTerm(2, 'II улирал', `${startYear}-11-09`, `${startYear}-12-25`),
      makeTerm(3, 'III улирал · цахим', `${followingYear}-01-11`, `${followingYear}-01-15`, [10, 11, 12], 'online'),
      makeTerm(4, 'III улирал', `${followingYear}-01-18`, `${followingYear}-03-26`),
      makeTerm(5, 'IV улирал', `${followingYear}-04-05`, `${followingYear}-06-04`),
    ],
  };
}

export function gradeScopeText(grades: number[]) {
  if (!grades.length) return '';
  const sorted = [...grades].sort((a, b) => a - b);
  const consecutive = sorted.every((grade, index) => index === 0 || grade === sorted[index - 1] + 1);
  return consecutive ? `${sorted[0]}-${sorted[sorted.length - 1]}` : sorted.join(', ');
}

export function parseGradeScope(value: string): number[] {
  const text = value.trim();
  if (!text || text.toLocaleLowerCase() === 'бүгд') return [];
  const range = text.match(/^(\d{1,2})\s*-\s*(\d{1,2})$/);
  const grades = range
    ? Array.from({ length: Number(range[2]) - Number(range[1]) + 1 }, (_, index) => Number(range[1]) + index)
    : text.split(',').map((item) => Number(item.trim()));
  if (
    !grades.length
    || grades.some((grade) => !Number.isInteger(grade) || grade < 1 || grade > 12)
    || new Set(grades).size !== grades.length
  ) {
    throw new Error('Ангиа 1-12, жишээ нь 10-12 эсвэл 5, 6 гэж оруулна уу.');
  }
  return grades.sort((a, b) => a - b);
}
