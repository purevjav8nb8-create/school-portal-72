import { backendBaseUrl, fetchWithAuth } from '../../../lib/backendApi';

export type PublicHoliday = { date: string; name: string };
export type PublicHolidayInput = { holiday_date: string; name: string };

async function request<T>(path: string, method = 'GET', body?: object): Promise<T> {
  const response = await fetchWithAuth(`${backendBaseUrl}${path}`, {
    method,
    ...(body ? {
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    } : {}),
  });
  let result: { detail?: string } | T;
  try {
    result = await response.json() as { detail?: string } | T;
  } catch {
    throw new Error(`Серверийн хариу буруу байна (${response.status}).`);
  }
  if (!response.ok) {
    throw new Error((result as { detail?: string }).detail ?? 'Бүх нийтийн амралтын өдрийн хүсэлт амжилтгүй боллоо.');
  }
  return result as T;
}

export function listPublicHolidays(year: number) {
  return request<PublicHoliday[]>(`/api/teachers/public-holidays/${year}`);
}

export function savePublicHoliday(year: number, holiday: PublicHolidayInput) {
  return request<PublicHoliday>(`/api/teachers/public-holidays/${year}`, 'POST', holiday);
}

export function savePublicHolidays(year: number, holidays: PublicHolidayInput[]) {
  return request<PublicHoliday[]>(`/api/teachers/public-holidays/${year}/bulk`, 'POST', holidays);
}

export function removePublicHoliday(year: number, holidayDate: string) {
  return request<{ deleted: boolean }>(`/api/teachers/public-holidays/${year}/${holidayDate}`, 'DELETE');
}
