import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));

export const formatCurrency = (amount: number): string =>
  `KES ${amount.toLocaleString('en-KE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

export const formatDate = (date: string | Date): string =>
  new Date(date).toLocaleDateString('en-KE', { day: '2-digit', month: 'short', year: 'numeric' });

export const formatTime = (date: string | Date): string =>
  new Date(date).toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit', hour12: true });

export const formatDateTime = (date: string | Date): string =>
  `${formatDate(date)} ${formatTime(date)}`;

// "Today" (or any date) in the BROWSER'S OWN local calendar, as a
// "YYYY-MM-DD" string — the format every date-only API param and
// <input type="date"> in this app expects.
//
// `new Date().toISOString().split('T')[0]` looks equivalent but isn't: it
// gives the UTC date, which is already tomorrow (or still yesterday)
// relative to local time whenever the browser is near its own midnight —
// e.g. 11:45pm in Nairobi (UTC+3) is only 8:45pm UTC, so toISOString()
// still reports "today" as the previous UTC day. Every place in this app
// that used toISOString().split('T')[0] to mean "today" had this bug; this
// helper is the fix, built from local getters instead of UTC ones.
export const toLocalDateString = (d: Date = new Date()): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export const getInitials = (name: string): string =>
  name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();

// Offline-safe placeholder for menu items with no photo. Returns an inline SVG
// data URI (no network request), so it works with zero connectivity and never
// shows a broken-image icon. Renders the item's initial in brand amber on the
// surface colour — a clean, on-brand stand-in until a real photo is uploaded.
// Replaces the old external services (source.unsplash.com / placehold.co) that
// were deprecated and made every card hit the network.
export const menuImagePlaceholder = (name?: string): string => {
  const letter = ((name || '').trim()[0] || '?').toUpperCase();
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="240" viewBox="0 0 400 240">` +
    `<rect width="400" height="240" fill="#1E1E1E"/>` +
    `<text x="200" y="120" font-family="system-ui,-apple-system,Segoe UI,Roboto,sans-serif" ` +
    `font-size="96" font-weight="700" fill="#F5A300" text-anchor="middle" dominant-baseline="central">${letter}</text>` +
    `</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
};

// Resolve a stored image_url for display. Uploaded images are stored as
// same-origin-looking paths like "/uploads/menu/xyz.jpg" — accurate when
// frontend and backend share a domain, but on Railway they're two separate
// services on two separate domains, so a bare "/uploads/..." path would
// try to load from the frontend's own domain instead of the backend that
// actually serves it. VITE_API_URL (already used for API calls — see
// lib/api.ts) doubles as the source for the backend's origin here, minus
// its /api suffix. Absolute URLs (http/https/data) pass through untouched;
// empty/missing values yield the branded placeholder.
const BACKEND_ORIGIN = (import.meta.env.VITE_API_URL || '').replace(/\/api\/?$/, '');

export const resolveMenuImage = (imageUrl?: string, name?: string): string => {
  if (!imageUrl) return menuImagePlaceholder(name);
  if (/^(https?:|data:)/.test(imageUrl)) return imageUrl;
  return BACKEND_ORIGIN ? `${BACKEND_ORIGIN}${imageUrl}` : imageUrl;
};

export const getStatusColor = (status: string): string => {
  const map: Record<string, string> = {
    active: 'success', completed: 'success', received: 'success', approved: 'success', available: 'success', in_stock: 'success',
    new: 'info', pending: 'warning', preparing: 'warning', partially_received: 'warning', on_leave: 'warning', reserved: 'warning', low_stock: 'warning', awaiting_payment: 'warning',
    cancelled: 'error', failed: 'error', out_of_stock: 'error', inactive: 'error', declined: 'error', expired: 'error', archived: 'muted',
    ready: 'purple', gold: 'warning', silver: 'muted', bronze: 'muted', refunded: 'purple',
    occupied: 'error', cleaning: 'purple',
  };
  return map[status?.toLowerCase()] || 'muted';
};

export const truncate = (str: string, len: number) =>
  str.length > len ? str.slice(0, len) + '...' : str;

export const debounce = <T extends (...args: unknown[]) => void>(fn: T, delay: number) => {
  let timer: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), delay); };
};