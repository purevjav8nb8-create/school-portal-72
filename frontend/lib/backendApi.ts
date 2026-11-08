export const backendBaseUrl =
  process.env.NEXT_PUBLIC_BACKEND_URL ??
  (process.env.NODE_ENV === 'production' ? '' : 'http://127.0.0.1:8000');
