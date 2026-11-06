import { Teacher } from '../types';

export function useDashboardStats(
  teachers: Teacher[]
) {
  const totalTeachers = teachers.length;

  const bazanTeachers = teachers.filter(
    (t) => t.unit === 'БАЗАН'
  );

  const buzanTeachers = teachers.filter(
    (t) => t.unit === 'БУЗАН'
  );

  const nuzanTeachers = teachers.filter(
    (t) => t.unit === 'НУЗАН'
  );

  const activeTeachers = teachers.filter(
    (t) => t.attendance !== 'Тасалсан'
  ).length;

  const bazanActive = bazanTeachers.filter(
    (t) => t.attendance !== 'Тасалсан'
  ).length;

  const buzanActive = buzanTeachers.filter(
    (t) => t.attendance !== 'Тасалсан'
  ).length;

  const nuzanActive = nuzanTeachers.filter(
    (t) => t.attendance !== 'Тасалсан'
  ).length;

  return {
    totalTeachers,
    activeTeachers,

    bazanTeachers,
    buzanTeachers,
    nuzanTeachers,

    bazanActive,
    buzanActive,
    nuzanActive,
  };
}