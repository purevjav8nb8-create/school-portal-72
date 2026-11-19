import type { PublicHolidayInput } from './publicHolidaysApi';

const DEFAULT_HOLIDAY_NAME = 'Бүх нийтийн амралт';

export function parsePublicHolidayText(year: number, text: string): PublicHolidayInput[] {
  const parsed = new Map<string, PublicHolidayInput>();
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);

  if (lines.length === 0) {
    throw new Error('Амралтын өдрүүдийн жагсаалтаа оруулна уу.');
  }

  for (const [index, rawLine] of lines.entries()) {
    const line = rawLine.replace(/^[-*•]\s*/, '');
    const monthMatch = line.match(/^(\d{1,2})\s*-\s*р\s*сарын(?=\s|$)/i);
    if (!monthMatch) {
      throw new Error(`${index + 1}-р мөрийн сар танигдсангүй.`);
    }

    const month = Number(monthMatch[1]);
    const afterMonth = line.slice(monthMatch[0].length).trim();
    const dayMatch = afterMonth.match(/^(\d{1,2}(?:\s*,\s*\d{1,2})*(?:\s*-\s*\d{1,2})?)/);
    if (month < 1 || month > 12 || !dayMatch) {
      throw new Error(`${index + 1}-р мөрийн сар эсвэл өдөр буруу байна.`);
    }

    const dayExpression = dayMatch[1].replace(/\s/g, '');
    const range = dayExpression.match(/^(\d{1,2})-(\d{1,2})$/);
    const days = range
      ? Array.from({ length: Number(range[2]) - Number(range[1]) + 1 }, (_, offset) => Number(range[1]) + offset)
      : dayExpression.split(',').map(Number);
    if (!days.length || days.some((day) => !Number.isInteger(day) || day < 1 || day > 31)) {
      throw new Error(`${index + 1}-р мөрийн өдөр буруу байна.`);
    }

    const holidayName = line.match(/\/([^/]+)\//)?.[1]?.replace(/\*/g, '').trim() || DEFAULT_HOLIDAY_NAME;
    for (const day of days) {
      const date = new Date(Date.UTC(year, month - 1, day));
      if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
        throw new Error(`${index + 1}-р мөрөнд ${month}-р сарын ${day}-ны огноо буруу байна.`);
      }
      const holidayDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      parsed.set(holidayDate, { holiday_date: holidayDate, name: holidayName });
    }
  }

  return [...parsed.values()].sort((first, second) => first.holiday_date.localeCompare(second.holiday_date));
}
