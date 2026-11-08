export const backendBaseUrl =
  process.env.NEXT_PUBLIC_BACKEND_URL?.replace(/\/+$/, "") ||
  (process.env.NODE_ENV === "development"
    ? "http://127.0.0.1:8000"
    : "https://porta72.onrender.com");