'use client';

import ActivityForm, { ActivityInput } from './ActivityForm';
import FloatingComposer from './FloatingComposer';
import ActivityFeed from './ActivityFeed';

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
  author: string;
  onSubmit: (activity: ActivityInput) => Promise<void>;
}

export default function ActivityPanel({ unit, subjects, activities, author, onSubmit }: Props) {
  return (
    <section style={{ display: 'grid', gap: 18 }}>
      <h2 style={{ margin: 0 }}>Оролцоо</h2>
      <FloatingComposer title="Оролцоо нэмэх" label="Оролцоо нэмэх">
        {(close) => <ActivityForm unit={unit} subjects={subjects} onSubmit={async (activity) => { await onSubmit(activity); close(); }} />}
      </FloatingComposer>
      {activities.length === 0
        ? <p>Одоогоор тэмдэглэл оруулаагүй байна.</p>
        : <ActivityFeed activities={[...activities].reverse().map((activity) => ({ ...activity, author }))} />}
    </section>
  );
}
