import { useEffect, useState } from 'react';
import { backendBaseUrl, fetchWithAuth } from '../../../lib/backendApi';
import { Teacher } from '../types';

const apiUrl = backendBaseUrl;
const retryDelays = [500, 1500] as const;

export function useTeachers(activeUnit: string, enabled = true) {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    const loadTeachers = async () => {
      for (let attempt = 0; attempt <= retryDelays.length; attempt += 1) {
        if (!active) return;
        try {
          const response = await fetchWithAuth(`${apiUrl}/api/teachers`);
          if (response.ok) {
            const records = await response.json() as Teacher[];
            if (active && Array.isArray(records)) {
              setTeachers(records);
              setErrorMessage('');
            }
            return;
          }
          const result = await response.json().catch(() => ({}));
          const error = new Error(result.detail ?? `Багшийн жагсаалт уншигдсангүй (${response.status}).`);
          if (![502, 503, 504].includes(response.status) || attempt === retryDelays.length) throw error;
        } catch (error) {
          const retryable = error instanceof TypeError
            || (error instanceof Error && error.message.includes('Нэвтрэх эрхийг шалгаж чадсангүй'));
          if (!retryable || attempt === retryDelays.length) {
            if (active) setErrorMessage(error instanceof Error ? error.message : 'Багшийн жагсаалт уншигдсангүй.');
            return;
          }
        }
        await new Promise((resolve) => window.setTimeout(resolve, retryDelays[attempt]));
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
