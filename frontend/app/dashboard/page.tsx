'use client';

import { useState } from 'react';

import Header from './components/Header';
import SummaryCards from './components/SummaryCards';
import SideMenu from './components/SideMenu';
import AttendanceTable from './components/AttendanceTable';
import UnitTabs from './components/UnitTabs';

import { Teacher, UserProfile } from './types';

export default function DashboardV2() {
  const [activeCategory, setActiveCategory] = useState<
    'Ирц' | 'Сургалт' | 'Үнэлгээ'
  >('Ирц');

  const [activeUnit, setActiveUnit] = useState<
    'НИЙТ' | 'БАЗАН' | 'БУЗАН' | 'НУЗАН'
  >('НИЙТ');

  const [selectedMonth, setSelectedMonth] = useState('2026-03');

  const user: UserProfile = {
    last_name: 'Админ',
    first_name: 'Систем',
    email: 'admin@moes.edu.mn',
    unit: 'БАЗАН',
    subject: 'Administrator',
    role: 'admin',
  };

  const [teachers, setTeachers] = useState<Teacher[]>([
    {
      id: 1,
      last_name: 'Батболд',
      first_name: 'Бат',
      email: 'teacher1@moes.edu.mn',
      unit: 'БАЗАН',
      subject: 'Математик',
      attendance: 'Ирсэн',
      monthly_attendance_rate: 96,
      training_status: 'Хамрагдсан',
      rating: 92,
      monthly_login_count: 20,
    },
    {
      id: 2,
      last_name: 'Сүрэн',
      first_name: 'Од',
      email: 'teacher2@moes.edu.mn',
      unit: 'БУЗАН',
      subject: 'Физик',
      attendance: 'Хоцорсон',
      monthly_attendance_rate: 87,
      training_status: 'Хамрагдаагүй',
      rating: 88,
      monthly_login_count: 18,
    },
    {
      id: 3,
      last_name: 'Эрдэнэ',
      first_name: 'Туяа',
      email: 'teacher3@moes.edu.mn',
      unit: 'НУЗАН',
      subject: 'Монгол хэл',
      attendance: 'Ирсэн',
      monthly_attendance_rate: 98,
      training_status: 'Хамрагдсан',
      rating: 95,
      monthly_login_count: 24,
    },
  ]);

  const displayTeachers =
    activeUnit === 'НИЙТ'
      ? teachers
      : teachers.filter((t) => t.unit === activeUnit);

  const handleLogout = () => {
    window.location.href = '/';
  };

  const handleAttendanceChange = (
    id: number,
    status: Teacher['attendance']
  ) => {
    setTeachers((prev) =>
      prev.map((t) =>
        t.id === id
          ? {
              ...t,
              attendance: status,
            }
          : t
      )
    );
  };

  const handleTeacherSelect = (teacher: Teacher) => {
    alert(
      `${teacher.last_name} ${teacher.first_name} багшийн дэлгэрэнгүй мэдээлэл`
    );
  };

  const totalTeachers = teachers.length;

  const bazanTeachers = teachers.filter((t) => t.unit === 'БАЗАН');
  const buzanTeachers = teachers.filter((t) => t.unit === 'БУЗАН');
  const nuzanTeachers = teachers.filter((t) => t.unit === 'НУЗАН');

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: '#f8fafc',
        padding: '24px',
      }}
    >
      <Header user={user} onLogout={handleLogout} />

<div
  style={{
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    marginTop: '16px',
  }}
>

  <UnitTabs
    activeUnit={activeUnit}
    setActiveUnit={setActiveUnit}
    isAdmin={false}
    onDownload={() => {}}
  />

  <div
    style={{
      display: 'flex',
      justifyContent: 'flex-end',
      gap: '12px',
    }}
  >
    <button
      style={{
        backgroundColor: '#107c41',
        color: 'white',
        border: 'none',
        padding: '10px 18px',
        borderRadius: '8px',
        fontWeight: 'bold',
        cursor: 'pointer',
      }}
    >
      📊 Excel Тайлан Татах
    </button>

    <button
      style={{
        backgroundColor: '#dc2626',
        color: 'white',
        border: 'none',
        padding: '10px 18px',
        borderRadius: '8px',
        fontWeight: 'bold',
        cursor: 'pointer',
      }}
    >
      📄 PDF Тайлан Татах
    </button>
  </div>

</div>


      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '220px 1fr',
          gap: '20px',
          marginTop: '24px',
        }}
      >
        <SideMenu
          activeCategory={activeCategory}
          setActiveCategory={setActiveCategory}
        />

        <div
          style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            padding: '20px',
            border: '1px solid #e2e8f0',
          }}
        >
          {activeCategory === 'Ирц' && (
            <AttendanceTable
              teachers={displayTeachers}
              activeUnit={activeUnit}
              selectedMonth={selectedMonth}
              setSelectedMonth={setSelectedMonth}
              onSelectTeacher={handleTeacherSelect}
              onAttendanceChange={handleAttendanceChange}
            />
          )}

          {activeCategory === 'Сургалт' && (
            <div>
              <h3>📚 Сургалтын модуль</h3>
              <p>Дараагийн алхамд холбоно.</p>
            </div>
          )}

          {activeCategory === 'Үнэлгээ' && (
            <div>
              <h3>⭐ Үнэлгээний модуль</h3>
              <p>Дараагийн алхамд холбоно.</p>
            </div>
          )}
        </div>
      </div>
      <div style={{ marginTop: '12px' }}>
  <SummaryCards
    totalTeachers={totalTeachers}
    bazan={{
      total: bazanTeachers.length,
      active: bazanTeachers.length,
    }}
    buzan={{
      total: buzanTeachers.length,
      active: buzanTeachers.length,
    }}
    nuzan={{
      total: nuzanTeachers.length,
      active: nuzanTeachers.length,
    }}
    updatedCount={teachers.length}
  />
</div>
    </div>
  );
}