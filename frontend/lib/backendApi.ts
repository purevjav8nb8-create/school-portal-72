import { supabase } from './supabaseClient';

const configuredBackendUrl = process.env.NEXT_PUBLIC_BACKEND_URL?.trim().replace(/\/+$/, '');
const isLoopbackBackend = /^https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?$/i.test(configuredBackendUrl ?? '');
const defaultBackendUrl = process.env.NODE_ENV === 'development'
  ? 'http://127.0.0.1:8000'
  : 'https://porta72.onrender.com';

export const backendBaseUrl = configuredBackendUrl && !(process.env.NODE_ENV === 'production' && isLoopbackBackend)
  ? configuredBackendUrl
  : defaultBackendUrl;

let refreshInProgress: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  if (!refreshInProgress) {
    refreshInProgress = supabase.auth.refreshSession()
      .then(({ data, error }) => {
        if (error) throw error;
        return data.session?.access_token ?? null;
      })
      .finally(() => {
        refreshInProgress = null;
      });
  }
  return refreshInProgress;
}

export async function fetchWithAuth(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) throw new Error('Нэвтрэх эрхийг шалгаж чадсангүй. Дахин нэвтэрнэ үү.');
  const mockToken = typeof window === 'undefined' ? null : window.localStorage.getItem('school-portal-mock-token');
  const accessToken = session?.access_token ?? mockToken;
  if (!accessToken) throw new Error('Нэвтрэх эрх дууссан байна. Дахин нэвтэрнэ үү.');

  const send = (token: string) => {
    const headers = new Headers(init.headers);
    headers.set('Authorization', `Bearer ${token}`);
    return fetch(input, { ...init, headers });
  };
  const response = await send(accessToken);
  if (response.status !== 401 || !session) return response;

  const refreshedToken = await refreshAccessToken();
  return refreshedToken ? send(refreshedToken) : response;
}