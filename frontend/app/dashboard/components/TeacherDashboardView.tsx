'use client';

import AttendanceTable from './AttendanceTable';
import Header from './Header';
import QuickActions from './QuickActions';
import SideMenu from './SideMenu';
import TrainingForm from './training/TrainingForm';
import ActivityPanel, { TeacherActivity } from './records/ActivityPanel';
import { ActivityInput } from './records/ActivityForm';
import AnnouncementBoard from './records/AnnouncementBoard';
import ChatBoard from './records/ChatBoard';
import SurveyBoard from './records/SurveyBoard';
import ProfessionalProfilePanel from './records/ProfessionalProfilePanel';
import FloatingComposer from './records/FloatingComposer';
import ProgramPlanPanel, { ProgramPlan } from './records/ProgramPlanPanel';
import EvaluationPanel, { EvaluationRecord } from './records/EvaluationPanel';
import FileAttachmentActions from './records/FileAttachmentActions';
import TeachingClassesPanel from './TeachingClassesPanel';
import { DashboardCategory, Teacher, UserProfile } from '../types';
import { NotificationCounts } from '../hooks/useNotifications';

export type TeacherTraining = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  trainingType: 'Үндсэн' | 'Төрөлжсөн' | 'Сонголтот' | 'Ажлын байран дээрх сургалт' | 'Бусад';
  certificateUrl: string;
  imageUrl?: string;
  createdAt: string;
};

interface Props {
  user: UserProfile;
  teacher: Teacher;
  trainings: TeacherTraining[];
  evaluations: EvaluationRecord[];
  programPlan?: ProgramPlan;
  activities: TeacherActivity[];
  awards: { id: string; name: string; certificate_number: string; certificate_url: string; organization: string; awarded_date?: string; note: string }[];
  degrees: { id: string; name: string; certificate_number: string; certificate_url: string; status: string; issued_date?: string; note: string }[];
  activeCategory: DashboardCategory;
  selectedMonth: string;
  setSelectedMonth: (month: string) => void;
  busy: boolean;
  errorMessage: string;
  successMessage: string;
  onCategoryChange: (category: DashboardCategory) => void;
  onLogout: () => void;
  onTraining: (training: Omit<TeacherTraining, 'id' | 'createdAt'>) => Promise<void>;
  onProgramPlan: (documentUrl: string, note: string, grade: number, section: string, subject: string) => Promise<void>;
  onActivity: (activity: ActivityInput) => Promise<void>;
  onEvaluation: (evaluation: Omit<EvaluationRecord, 'id' | 'createdAt'>) => Promise<void>;
  onDeleteEvaluation: (evaluationId: string) => Promise<void>;
  onProfessionalSave: (path: string, payload: object) => Promise<void>;
  notificationCounts?: NotificationCounts;
  notificationError?: string;
  onNotificationCategoryChange?: (category: DashboardCategory) => void;
}

export default function TeacherDashboardView({
  user, teacher, trainings, evaluations, programPlan, activities, awards, degrees,
  activeCategory, selectedMonth, setSelectedMonth, busy, errorMessage,
  successMessage, onCategoryChange,   onLogout, onTraining, onProgramPlan, onActivity, onEvaluation, onDeleteEvaluation, onProfessionalSave,
  notificationCounts = {}, notificationError = '', onNotificationCategoryChange,
}: Props) {
  const categories: DashboardCategory[] = ['Ирц', 'Хөтөлбөр', 'Мэдээлэл', 'Оролцоо', 'Сургалт', 'Судалгаа', 'Үнэлгээ', 'Зар', 'Чат', 'Зэрэг', 'Шагнал'];

  return (
    <main className="dashboard-compact" style={{ height: '100vh', overflow: 'hidden', backgroundColor: '#f8fafc', padding: 6 }}>
      <Header user={user} onLogout={onLogout} />
      <div className="dashboard-grid" style={{ display: 'grid', gridTemplateColumns: '150px minmax(0, 1fr) 180px', gap: 8, marginTop: 7, height: 'calc(100vh - 100px)', alignItems: 'start' }}>
        <aside style={{ overflow: 'hidden' }}>
          <SideMenu activeCategory={activeCategory} setActiveCategory={onNotificationCategoryChange ?? onCategoryChange} categories={categories} notificationCounts={notificationCounts} notificationError={notificationError} />
          <TeachingClassesPanel unit={teacher.unit} initialClasses={teacher.teaching_classes ?? []} />
        </aside>
        <section style={{ minWidth: 0, height: '100%', overflowY: 'auto', overflowX: 'hidden', paddingRight: 4 }}>
          <div className="dashboard-content" style={{ minHeight: 220, padding: 8, background: '#fff', borderRadius: 10, boxShadow: '0 2px 10px rgba(0,0,0,0.06)' }}>
            {errorMessage && <p role="alert" style={{ color: '#b91c1c' }}>{errorMessage}</p>}
            {successMessage && <p role="status" style={{ color: '#047857' }}>{successMessage}</p>}
            {activeCategory === 'Ирц' && (
              <>
                <AttendanceTable
                  teachers={[teacher]}
                  activeUnit={teacher.unit}
                  selectedMonth={selectedMonth}
                  setSelectedMonth={setSelectedMonth}
                  onSelectTeacher={() => undefined}
                  onAttendanceChange={() => undefined}
                  readOnly
                />
              </>
            )}
            {activeCategory === 'Сургалт' && (
              <section>
                <h2 style={{ marginTop: 0 }}>Миний сургалт</h2>
                <TrainingForm onAddTraining={async (training) => { await onTraining(training); }} />
                {trainings.length === 0 ? <p>Сургалт бүртгэгдээгүй байна.</p> : [...trainings].sort((left, right) => right.endDate.localeCompare(left.endDate) || right.startDate.localeCompare(left.startDate) || right.createdAt.localeCompare(left.createdAt)).map((item) => (
                  <div key={item.id} style={{ display: 'grid', gap: 3, padding: '4px 0', borderBottom: '1px solid #e2e8f0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>{item.name} · {item.trainingType} · {item.startDate} – {item.endDate} · <FileAttachmentActions attachment={{ name: 'Сертификат', url: item.certificateUrl, file_type: item.certificateUrl.toLowerCase().includes('.pdf') ? 'document' : 'image' }} /></div>
                    {item.imageUrl && <div style={{ marginTop: 1 }}><FileAttachmentActions attachment={{ name: 'Сургалтын зураг', url: item.imageUrl, file_type: 'image' }} /></div>}
                  </div>
                ))}
              </section>
            )}
            {activeCategory === 'Үнэлгээ' && (
              <EvaluationPanel unit={user.unit} subjects={user.subjects ?? (user.subject ? [user.subject] : [])} evaluations={evaluations} onSubmit={onEvaluation} onDelete={onDeleteEvaluation} />
            )}
            {activeCategory === 'Хөтөлбөр' && <ProgramPlanPanel programPlan={programPlan} unit={user.unit} subjects={user.subjects ?? (user.subject ? [user.subject] : [])} onSubmit={onProgramPlan} />}
            {activeCategory === 'Оролцоо' && <ActivityPanel unit={user.unit} subjects={user.subjects ?? (user.subject ? [user.subject] : [])} activities={activities} onSubmit={onActivity} />}
            {activeCategory === 'Судалгаа' && <SurveyBoard />}
            {activeCategory === 'Чат' && <ChatBoard />}
            {activeCategory === 'Мэдээлэл' && <AnnouncementBoard boardType="Мэдээлэл" />}
            {activeCategory === 'Зар' && <AnnouncementBoard boardType="Зар" />}
            {activeCategory === 'Шагнал' && <FloatingComposer title="Шагнал бүртгэх" label="Шагнал бүртгэх">{() => <ProfessionalProfilePanel mode="award" awards={awards} degrees={degrees} onSave={onProfessionalSave} />}</FloatingComposer>}
            {activeCategory === 'Зэрэг' && <FloatingComposer title="Мэргэжлийн зэрэг" label="Мэргэжлийн зэрэг">{() => <ProfessionalProfilePanel mode="degree" awards={awards} degrees={degrees} onSave={onProfessionalSave} />}</FloatingComposer>}
            {busy && <p role="status">Хадгалж байна...</p>}
          </div>
        </section>
        <QuickActions unit={teacher.unit} category={activeCategory} month={selectedMonth} showReports={false} />
      </div>
    </main>
  );
}
