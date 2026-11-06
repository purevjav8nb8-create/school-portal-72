'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

import Header from './components/Header';
import SideMenu from './components/SideMenu';
import AttendanceTable from './components/AttendanceTable';
import UnitTabs from './components/UnitTabs';
import QuickActions from './components/QuickActions';

import { Teacher, UserProfile } from './types';

import { useTeachers } from './hooks/useTeachers';

export default function DashboardPage() {
  const [activeCategory, setActiveCategory] = useState<
    'Ирц' | 'Сургалт' | 'Үнэлгээ'
  >('Ирц');

  const [activeUnit, setActiveUnit] = useState<
    'НИЙТ' | 'БАЗАН' | 'БУЗАН' | 'НУЗАН'
  >('НИЙТ');

  const [selectedMonth, setSelectedMonth] =
    useState('2026-03');

  const [loading, setLoading] =
    useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        window.location.href = '/';
        return;
      }

      setLoading(false);
    };

    checkAuth();
  }, []);

  const user: UserProfile = {
    last_name: 'Админ',
    first_name: 'Систем',
    email: 'admin@moes.edu.mn',
    unit: 'БАЗАН',
    subject: 'Administrator',
    role: 'admin',
  };

  const {
    teachers,
    setTeachers,
    displayTeachers,
  } = useTeachers(activeUnit);

  const handleLogout = () => {
    window.location.href = '/';
  };

  const handleAttendanceChange = (
    id: number,
    status: Teacher['attendance']
  ) => {
    setTeachers((prev) =>
      prev.map((teacher) =>
        teacher.id === id
          ? {
              ...teacher,
              attendance: status,
            }
          : teacher
      )
    );
  };

  const handleTeacherSelect = (
    teacher: Teacher
  ) => {
    alert(
      `${teacher.last_name} ${teacher.first_name} багшийн дэлгэрэнгүй мэдээлэл`
    );
  };

  if (loading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        Ачаалж байна...
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: '#f8fafc',
        padding: '10px',
      }}
    >
      <Header
        user={user}
        onLogout={handleLogout}
      />

      <div
        style={{
          display: 'grid',
          gridTemplateColumns:
            '180px 1fr 220px',
          gap: '20px',
          marginTop: '16px',
          alignItems: 'start',
        }}
      >
        <div>
          <SideMenu
            activeCategory={activeCategory}
            setActiveCategory={
              setActiveCategory
            }
          />
        </div>

        <div>
          <UnitTabs
            activeUnit={activeUnit}
            setActiveUnit={setActiveUnit}
            totalTeachers={teachers.length}
            activeTeachers={
              teachers.filter(
                (t) =>
                  t.attendance !==
                  'Тасалсан'
              ).length
            }
            bazanTotal={
              teachers.filter(
                (t) =>
                  t.unit === 'БАЗАН'
              ).length
            }
            bazanActive={
              teachers.filter(
                (t) =>
                  t.unit === 'БАЗАН' &&
                  t.attendance !==
                    'Тасалсан'
              ).length
            }
            buzanTotal={
              teachers.filter(
                (t) =>
                  t.unit === 'БУЗАН'
              ).length
            }
            buzanActive={
              teachers.filter(
                (t) =>
                  t.unit === 'БУЗАН' &&
                  t.attendance !==
                    'Тасалсан'
              ).length
            }
            nuzanTotal={
              teachers.filter(
                (t) =>
                  t.unit === 'НУЗАН'
              ).length
            }
            nuzanActive={
              teachers.filter(
                (t) =>
                  t.unit === 'НУЗАН' &&
                  t.attendance !==
                    'Тасалсан'
              ).length
            }
          />

          <div
            style={{
              backgroundColor:
                'white',
              borderRadius: '14px',
              padding: '16px',
              boxShadow:
                '0 2px 10px rgba(0,0,0,0.06)',
            }}
          >
            {activeCategory ===
              'Ирц' && (
              <AttendanceTable
                teachers={
                  displayTeachers
                }
                activeUnit={
                  activeUnit
                }
                selectedMonth={
                  selectedMonth
                }
                setSelectedMonth={
                  setSelectedMonth
                }
                onSelectTeacher={
                  handleTeacherSelect
                }
                onAttendanceChange={
                  handleAttendanceChange
                }
              />
            )}

            {activeCategory ===
              'Сургалт' && (
              <div>
                <h2>📚 Сургалт</h2>
                <p>
                  Сургалтын модуль
                  энд орно.
                </p>
              </div>
            )}

            {activeCategory ===
              'Үнэлгээ' && (
              <div>
                <h2>⭐ Үнэлгээ</h2>
                <p>
                  Үнэлгээний модуль
                  энд орно.
                </p>
              </div>
            )}
          </div>
        </div>

        <QuickActions />
      </div>
    </div>
  );
}