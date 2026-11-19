const SCHOOL_TIME_ZONE = 'Asia/Ulaanbaatar';

function schoolDateParts(date: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: SCHOOL_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  return Object.fromEntries(parts.map(({ type, value }) => [type, value]));
}

export function schoolToday(): string {
  const parts = schoolDateParts(new Date());
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function schoolMonth(): string {
  const parts = schoolDateParts(new Date());
  return `${parts.year}-${parts.month}`;
}
