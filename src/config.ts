// In development, Vite proxy handles /api -> backend, so base is empty.
// In production (built & deployed), use the full backend URL from env.
const isProd = import.meta.env.PROD;
export const API_BASE = isProd ? (import.meta.env.VITE_API_URL || '') : '';
