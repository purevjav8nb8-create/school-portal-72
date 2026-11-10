'use client';

import AttendanceTable from './AttendanceTable';
import AdminTeacherTools from './AdminTeacherTools';
import Header from './Header';
import QuickActions from './QuickActions';
import SideMenu from './SideMenu';
import UnitTabs from './UnitTabs';
import AdminReviewPanel from './records/AdminReviewPanel';
import AnnouncementBoard from './records/AnnouncementBoard';
import ChatBoard from './records/ChatBoard';
import SurveyBoard from './records/SurveyBoard';
import TeacherDetailModal from './TeacherDetailModal';
import AdminTrainingPanel from './AdminTrainingPanel';
import { DashboardCategory, Teacher, UserProfile } from '../types';
import { NotificationCounts } from '../hooks/useNotifications';

interface Props {
  user: UserProfile;
  activeCategory: DashboardCategory;
  setActiveCategory: (category: DashboardCategory) => void;
  activeUnit: 'НИЙТ' | 'БАЗАН' | 'БУЗАН' | 'НУЗАН';
  setActiveUnit: (unit: 'НИЙТ' | 'БАЗАН' | 'БУЗАН' | 'НУЗАН') => void;
  selectedMonth: string;
  setSelectedMonth: (month: string) => void;
  teachers: Teacher[];
  displayTeachers: Teacher[];
  onLogout: () => void;
  onTeacherSelect: (teacher: Teacher) => void;
  onAttendanceChange: (id: number, status: Teacher['attendance']) => void;
  onTeachersAdded: (teachers: Teacher[]) => void;
  onTeacherRemoved: (authId: string) => void;
  selectedTeacher: Teacher | null;
  onCloseTeacher: () => void;
  onTeacherUpdated: (teacher: Teacher) => void;
  notificationCounts?: NotificationCounts;
  notificationError?: string;
  teacherLoadError?: string;
  onCategoryChange?: (category: DashboardCategory) => void;
}

export default function AdminDashboardView({
  user,
  activeCategory,
  setActiveCategory,
  activeUnit,
  setActiveUnit,
  selectedMonth,
  setSelectedMonth,
  teachers,
  displayTeachers,
  onLogout,
  onTeacherSelect,
  onAttendanceChange,
  onTeachersAdded,
  onTeacherRemoved,
  selectedTeacher,
  onCloseTeacher,
  onTeacherUpdated,
  notificationCounts = {},
  notificationError = '',
  teacherLoadError = '',
  onCategoryChange,
}: Props) {
  const activeTeachers = teachers.filter((teacher) => teacher.attendance !== 'Тасалсан').length;
  const unitStats = {
    bazanTotal: teachers.filter((teacher) => teacher.unit === 'БАЗАН').length,
    bazanActive: teachers.filter((teacher) => teacher.unit === 'БАЗАН' && teacher.attendance !== 'Тасалсан').length,
    buzanTotal: teachers.filter((teacher) => teacher.unit === 'БУЗАН').length,
    buzanActive: teachers.filter((teacher) => teacher.unit === 'БУЗАН' && teacher.attendance !== 'Тасалсан').length,
    nuzanTotal: teachers.filter((teacher) => teacher.unit === 'НУЗАН').length,
    nuzanActive: teachers.filter((teacher) => teacher.unit === 'НУЗАН' && teacher.attendance !== 'Тасалсан').length,
  };

  return (
    <main className="dashboard-compact" style={{ height: '100vh', overflow: 'hidden', backgroundColor: '#f8fafc', padding: 6 }}>
      <Header user={user} onLogout={onLogout} />
      <div className="dashboard-grid" style={{ display: 'grid', gridTemplateColumns: '150px minmax(0, 1fr) 180px', gap: 8, marginTop: 7, height: 'calc(100vh - 100px)', alignItems: 'start' }}>
        <aside style={{ overflow: 'hidden' }}>
          <SideMenu
            activeCategory={activeCategory}
            setActiveCategory={onCategoryChange ?? setActiveCategory}
            notificationCounts={notificationCounts}
            notificationError={notificationError}
            categories={['Ирц', 'Хянах', 'Үнэлгээ', 'Мэдээлэл', 'Сургалт', 'Судалгаа', 'Зар', 'Чат']}
          />
          <AdminTeacherTools teachers={teachers} onTeachersAdded={onTeachersAdded} onTeacherRemoved={onTeacherRemoved} />
        </aside>
        <section style={{ minWidth: 0, height: '100%', overflowY: 'auto', overflowX: 'hidden', paddingRight: 4 }}>
          {teacherLoadError && <p role="alert" style={{ margin: '0 0 6px', color: '#b91c1c' }}>{teacherLoadError}</p>}
          {activeCategory === 'Ирц' && <UnitTabs
              activeUnit={activeUnit}
              setActiveUnit={setActiveUnit}
              totalTeachers={teachers.length}
              activeTeachers={activeTeachers}
              {...unitStats}
            />}
          <div className="dashboard-content" style={{ padding: 8, background: '#fff', borderRadius: 10, boxShadow: '0 2px 10px rgba(0,0,0,0.06)' }}>
            {activeCategory === 'Ирц' && (
              <AttendanceTable
                teachers={displayTeachers}
                activeUnit={activeUnit}
                selectedMonth={selectedMonth}
                setSelectedMonth={setSelectedMonth}
                onSelectTeacher={onTeacherSelect}
                onAttendanceChange={onAttendanceChange}
              />
            )}
            {activeCategory === 'Сургалт' && <AdminTrainingPanel teachers={teachers} />}
            {activeCategory === 'Үнэлгээ' && <AdminReviewPanel summaryOnly />}
            {activeCategory === 'Хянах' && <AdminReviewPanel />}
            {activeCategory === 'Судалгаа' && <SurveyBoard isAdmin />}
            {activeCategory === 'Чат' && <ChatBoard isAdmin />}
            {activeCategory === 'Мэдээлэл' && <AnnouncementBoard boardType="Мэдээлэл" />}
            {activeCategory === 'Зар' && <AnnouncementBoard boardType="Зар" />}
          </div>
        </section>
        <QuickActions unit={activeUnit} category={activeCategory} month={selectedMonth} />
      </div>
      <TeacherDetailModal teacher={selectedTeacher} selectedMonth={selectedMonth} onClose={onCloseTeacher} onTeacherUpdated={onTeacherUpdated} />
    </main>
  );
}
