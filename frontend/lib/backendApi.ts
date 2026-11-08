export const backendBaseUrl =
  process.env.NEXT_PUBLIC_BACKEND_URL?.replace(/\/+$/, '') ??
  'http://127.0.0.1:8000';
