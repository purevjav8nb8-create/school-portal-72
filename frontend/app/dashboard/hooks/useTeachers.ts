import { useState } from 'react';
import { Teacher } from '../types';
import { mockTeachers } from '../data/mockTeachers';

export function useTeachers(activeUnit: string) {
  const [teachers, setTeachers] =
    useState<Teacher[]>(mockTeachers);

  const displayTeachers =
    activeUnit === 'НИЙТ'
      ? teachers
      : teachers.filter(
          (teacher) =>
            teacher.unit === activeUnit
        );

  return {
    teachers,
    setTeachers,
    displayTeachers,
  };
}