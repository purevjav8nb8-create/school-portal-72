'use client';

import AttendanceTable from './AttendanceTable';
import Header from './Header';
import QuickActions from './QuickActions';
import SideMenu from './SideMenu';
import TrainingForm from './training/TrainingForm';
import ActivityPanel, { TeacherActivity } from './records/ActivityPanel';
import { ActivityInput } from './records/ActivityForm';
import AnnouncementBoard from './records/AnnouncementBoard';
import ProgramPlanPanel, { ProgramPlan } from './records/ProgramPlanPanel';
import EvaluationPanel, { EvaluationRecord } from './records/EvaluationPanel';
import FileAttachmentActions from './records/FileAttachmentActions';
import TeachingClassesPanel from './TeachingClassesPanel';
import { DashboardCategory, Teacher, UserProfile } from '../types';

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
}

export default function TeacherDashboardView({
  user, teacher, trainings, evaluations, programPlan, activities,
  activeCategory, selectedMonth, setSelectedMonth, busy, errorMessage,
  successMessage, onCategoryChange, onLogout, onTraining, onProgramPlan, onActivity, onEvaluation, onDeleteEvaluation,
}: Props) {
  const categories: DashboardCategory[] = ['Ирц', 'Сургалт', 'Үнэлгээ', 'Хөтөлбөр', 'Оролцоо', 'Зар'];

  return (
    <main style={{ height: '100vh', overflow: 'hidden', backgroundColor: '#f8fafc', padding: 8 }}>
      <Header user={user} onLogout={onLogout} />
      <div style={{ display: 'grid', gridTemplateColumns: '150px minmax(0, 1fr) 180px', gap: 12, marginTop: 10, height: 'calc(100vh - 108px)', alignItems: 'start' }}>
        <aside style={{ overflow: 'hidden' }}>
          <SideMenu activeCategory={activeCategory} setActiveCategory={onCategoryChange} categories={categories} />
          <TeachingClassesPanel unit={teacher.unit} initialClasses={teacher.teaching_classes ?? []} />
        </aside>
        <section style={{ minWidth: 0, height: '100%', overflowY: 'auto', overflowX: 'hidden', paddingRight: 4 }}>
          <div style={{ minHeight: 220, padding: 10, background: '#fff', borderRadius: 14, boxShadow: '0 2px 10px rgba(0,0,0,0.06)' }}>
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>{item.name} · {item.startDate} – {item.endDate} · <FileAttachmentActions attachment={{ name: 'Сертификат', url: item.certificateUrl, file_type: item.certificateUrl.toLowerCase().includes('.pdf') ? 'document' : 'image' }} /></div>
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
            {activeCategory === 'Зар' && <AnnouncementBoard />}
            {busy && <p role="status">Хадгалж байна...</p>}
          </div>
        </section>
        <QuickActions unit={teacher.unit} category={activeCategory} month={selectedMonth} showReports={false} />
      </div>
    </main>
  );
}
