import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Endpoints where a 401 means "these credentials/this code was wrong" —
// a completely normal, expected response the calling page's own try/catch
// already handles by showing a toast. These are explicitly excluded from
// the global redirect below.
const AUTH_ENDPOINTS = [
  '/auth/login', '/auth/verify-otp', '/auth/register',
  '/auth/forgot-password', '/auth/verify-reset-otp', '/auth/reset-password',
];

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const url: string = error.config?.url || '';
    const isAuthEndpoint = AUTH_ENDPOINTS.some(p => url.includes(p));
    if (error.response?.status === 401 && !isAuthEndpoint) {
      // This is the "your session token is missing/invalid/expired on an
      // otherwise-authenticated request" case — that one genuinely does
      // mean bounce back to login. A wrong password on /auth/login itself
      // is a completely different situation and must never hit this path:
      // window.location.href below is a full browser navigation, which
      // tears down the whole React app (and whatever toast the page was
      // about to show) before it can ever render. That's the exact bug
      // this exclusion list fixes — a wrong password looked like the page
      // "just refreshed" with no error, because that's literally what was
      // happening.
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;