export type Activity = {
  id: string;
  category: string;
  title: string;
  date: string;
  note: string;
  grade?: number;
  section?: string;
  subject?: string;
  images?: string[];
  attachments?: { name: string; url: string; file_type: 'image' | 'document' }[];
  review_status: 'pending' | 'approved' | 'rejected';
  admin_note: string;
};

export type GradeBand = 'all' | 'primary' | 'middle' | 'high';
export type ApprovalAssets = { signature_url: string; stamp_url: string };

export type TeacherRecords = {
  user_id: string;
  teacher: { name: string; email: string; unit: string; subject: string };
  program_plan?: {
    documentUrl: string;
    note: string;
    grade?: number;
    section?: string;
    subject?: string;
    approved: boolean;
    returned?: boolean;
    review_status?: 'pending' | 'returned' | 'approved';
    submittedAt: string;
  };
  activities: Activity[];
  awards: {
    id: string;
    name: string;
    certificate_number: string;
    certificate_url: string;
    organization?: string;
    status?: string;
    application_url?: string;
    meeting_minutes_url?: string;
    reference_url?: string;
    justification?: string;
    awarded_date?: string;
  }[];
  professional_degrees: {
    id: string;
    name: string;
    certificate_number: string;
    certificate_url: string;
    status: string;
    issued_date?: string;
  }[];
  evaluations: {
    id: string;
    grade: number;
    section: string;
    subject: string;
    level: string;
    students_count: number;
    average_score: number;
    evaluation_date: string;
  }[];
};

export type SubmittedPlanRecord = TeacherRecords & {
  program_plan: NonNullable<TeacherRecords['program_plan']>;
};
