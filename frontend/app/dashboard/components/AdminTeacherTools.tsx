'use client';

import { Teacher } from '../types';
import AdminTeacherAccountTools from './AdminTeacherAccountTools';
import AdminTeacherCreationTools from './AdminTeacherCreationTools';
import useAdminTeacherTools from './useAdminTeacherTools';

interface Props {
  teachers: Teacher[];
  onTeachersAdded: (teachers: Teacher[]) => void;
  onTeacherRemoved: (authId: string) => void;
}

export default function AdminTeacherTools({ teachers, onTeachersAdded, onTeacherRemoved }: Props) {
  const tools = useAdminTeacherTools(onTeachersAdded, onTeacherRemoved);
  return <section style={{ display: 'grid', gap: 8, marginTop: 16 }}>
    <AdminTeacherCreationTools
      busy={tools.busy}
      teacher={tools.teacher}
      setTeacher={tools.setTeacher}
      isManager={tools.isManager}
      setIsManager={tools.setIsManager}
      managedUsers={tools.managedUsers}
      selectedUserId={tools.selectedTeacherId}
      setSelectedUserId={tools.setSelectedTeacherId}
      targetPassword={tools.targetPassword}
      setTargetPassword={tools.setTargetPassword}
      onAddTeacher={tools.addTeacher}
      onResetPassword={tools.resetTeacherPassword}
      onDownloadTemplate={tools.downloadTemplate}
      onImport={tools.importTeachers}
    />
    <AdminTeacherAccountTools
      teachers={teachers}
      busy={tools.busy}
      selectedTeacherId={tools.selectedTeacherId}
      setSelectedTeacherId={tools.setSelectedTeacherId}
      confirmDelete={tools.confirmDelete}
      setConfirmDelete={tools.setConfirmDelete}
      onDelete={tools.deleteTeacher}
    />
    {tools.message && <pre role="status" style={{ maxHeight: 180, overflow: 'auto', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', fontSize: 11 }}>{tools.message}</pre>}
  </section>;
}
