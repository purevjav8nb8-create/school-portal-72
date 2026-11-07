'use client';

import ActivityForm, { ActivityInput } from './ActivityForm';
import FloatingComposer from './FloatingComposer';
import FileAttachmentActions from './FileAttachmentActions';

export type TeacherActivity = ActivityInput & {
  id: string;
  review_status: 'pending' | 'approved' | 'rejected';
  admin_note: string;
  submittedAt: string;
};

interface Props {
  unit: string;
  subjects: string[];
  activities: TeacherActivity[];
  onSubmit: (activity: ActivityInput) => Promise<void>;
}

export default function ActivityPanel({ unit, subjects, activities, onSubmit }: Props) {
  return (
    <section style={{ display: 'grid', gap: 18 }}>
      <h2 style={{ margin: 0 }}>Амжилт, хичээл ба оролцоо</h2>
      <FloatingComposer title="Амжилт, оролцоо нэмэх" label="Амжилт, оролцоо нэмэх">
        {(close) => <ActivityForm unit={unit} subjects={subjects} onSubmit={async (activity) => { await onSubmit(activity); close(); }} />}
      </FloatingComposer>
      <div style={{ display: 'grid', gap: 10 }}>
        {activities.length === 0 && <p>Одоогоор тэмдэглэл оруулаагүй байна.</p>}
        {[...activities].reverse().map((activity) => (
          <article key={activity.id} style={{ padding: 14, border: '1px solid #e2e8f0', borderRadius: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
              <strong>{activity.category}: {activity.title}</strong>
            </div>
            <p style={{ margin: '8px 0' }}>{activity.date} · {activity.note}</p>
            {activity.grade && <p style={{ margin: '0 0 8px', color: '#475569' }}>{activity.grade}-р анги {activity.section} бүлэг · {activity.subject}</p>}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {(activity.attachments ?? []).map((attachment) => attachment.file_type === 'image' ? (
                <FileAttachmentActions key={attachment.url} attachment={attachment} />
              ) : <FileAttachmentActions key={attachment.url} attachment={attachment} />)}
              {(activity.images ?? []).map((image) => <FileAttachmentActions key={image} attachment={{ name: 'Зураг', url: image, file_type: 'image' }} />)}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
