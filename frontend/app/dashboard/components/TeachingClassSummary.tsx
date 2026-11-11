import { Teacher } from '../types';

type TeachingClass = NonNullable<Teacher['teaching_classes']>[number];

export default function TeachingClassSummary({ classes }: { classes: TeachingClass[] }) {
  const totalHours = classes.reduce((sum, item) => sum + item.weekly_hours, 0);
  return <div style={{ display: 'grid', gap: 2, marginTop: 6, fontSize: 12, lineHeight: 1.2 }}>
    <b>Нийт: {totalHours} цаг</b>
    <b>Илүү цаг: {Math.max(0, totalHours - 19)} цаг</b>
  </div>;
}
