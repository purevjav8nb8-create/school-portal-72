import { DailyAttendance } from '../types';

export type AttendanceRecord = {
  date: string;
  status: DailyAttendance['status'];
};

export function groupAttendance(records: AttendanceRecord[]): Record<string, DailyAttendance[]> {
  return records.reduce<Record<string, DailyAttendance[]>>((months, record) => {
    const [year, month, day] = record.date.split('-');
    const key = `${year}-${month}`;
    months[key] ??= [];
    months[key].push({ day: Number(day), status: record.status as DailyAttendance['status'] });
    return months;
  }, {});
}
