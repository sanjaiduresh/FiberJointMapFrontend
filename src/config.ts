// In development, Vite proxy handles /api -> backend, so base is empty.
// In production (built & deployed), use the full backend URL from env (stripped of trailing slashes).
const isProd = import.meta.env.PROD;
const rawUrl = (import.meta.env.VITE_API_URL || '').trim().replace(/\/+$/, '');
export const API_BASE = isProd ? rawUrl : '';

