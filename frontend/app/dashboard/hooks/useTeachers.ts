import { useEffect, useState } from 'react';
import { backendBaseUrl } from '../../../lib/backendApi';
import { Teacher } from '../types';
import { supabase } from '../../../lib/supabaseClient';

const apiUrl = backendBaseUrl;

export function useTeachers(activeUnit: string) {
  const [teachers, setTeachers] = useState<Teacher[]>([]);

  useEffect(() => {
    let active = true;
    const loadTeachers = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const mockToken = window.localStorage.getItem('school-portal-mock-token');
      if (!session && !mockToken) return;
      try {
        const response = await fetch(`${apiUrl}/api/teachers`, {
          headers: { Authorization: `Bearer ${session?.access_token ?? mockToken}` },
        });
        if (!response.ok) throw new Error('Багшийн жагсаалт уншигдсангүй.');
        const records = await response.json() as Teacher[];
        if (active && Array.isArray(records)) setTeachers(records);
      } catch {
        if (active) setTeachers([]);
      }
    };
    void loadTeachers();
    return () => {
      active = false;
    };
  }, []);

  const displayTeachers =
    activeUnit === 'НИЙТ'
      ? teachers
      : teachers.filter((teacher) => teacher.unit === activeUnit);

  return {
    teachers,
    setTeachers,
    displayTeachers,
  };
}
