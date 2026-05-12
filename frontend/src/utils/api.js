const BASE = '/api';

export async function api(endpoint) {
  const res = await fetch(`${BASE}${endpoint}`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export async function postApi(endpoint) {
  const res = await fetch(`${BASE}${endpoint}`, { method: 'POST' });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export async function adminGet(endpoint, adminKey) {
  const res = await fetch(`${BASE}${endpoint}`, {
    headers: { 'X-Admin-Key': adminKey },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `API error: ${res.status}`);
  }
  return res.json();
}

export async function adminPost(endpoint, adminKey) {
  const res = await fetch(`${BASE}${endpoint}`, {
    method: 'POST',
    headers: { 'X-Admin-Key': adminKey },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `API error: ${res.status}`);
  }
  return res.json();
}

export function formatDate(dateStr) {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

export const COLORS = [
  '#10b981', '#F42A41', '#3b82f6', '#f97316', '#00a878',
  '#a855f7', '#eab308', '#ec4899', '#006A4E', '#8b5cf6',
  '#f43f5e', '#84cc16', '#6366f1', '#14b8a6', '#0ea5e9',
];
