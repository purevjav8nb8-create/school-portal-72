import { useEffect, useState } from 'react';
import { backendBaseUrl, fetchWithAuth } from '../../../lib/backendApi';
import { Teacher } from '../types';

const apiUrl = backendBaseUrl;

export function useTeachers(activeUnit: string, enabled = true) {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    const loadTeachers = async () => {
      try {
        const response = await fetchWithAuth(`${apiUrl}/api/teachers`);
        if (!response.ok) {
          const result = await response.json().catch(() => ({}));
          throw new Error(result.detail ?? `Багшийн жагсаалт уншигдсангүй (${response.status}).`);
        }
        const records = await response.json() as Teacher[];
        if (active && Array.isArray(records)) {
          setTeachers(records);
          setErrorMessage('');
        }
      } catch (error) {
        if (active) setErrorMessage(error instanceof Error ? error.message : 'Багшийн жагсаалт уншигдсангүй.');
      }
    };
    void loadTeachers();
    return () => {
      active = false;
    };
  }, [enabled]);

  const displayTeachers =
    activeUnit === 'НИЙТ'
      ? teachers
      : teachers.filter((teacher) => teacher.unit === activeUnit);

  return {
    teachers,
    setTeachers,
    displayTeachers,
    errorMessage,
  };
}
