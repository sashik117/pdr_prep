// @ts-nocheck
export function formatAdminDate(value, options = {}) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('uk-UA', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    ...options,
  });
}

export function resolveUserName(user) {
  if (!user) return 'Користувач';
  return user.full_name || [user.name, user.surname].filter(Boolean).join(' ') || user.username || user.email || 'Користувач';
}

export function clampNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export function percent(part, total) {
  const safeTotal = clampNumber(total);
  if (!safeTotal) return 0;
  return Math.round((clampNumber(part) / safeTotal) * 100);
}

export function buildRegistrationChart(users = []) {
  const buckets = new Map();
  users.forEach((user) => {
    const date = new Date(user.created_at);
    if (Number.isNaN(date.getTime())) return;
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const label = date.toLocaleDateString('uk-UA', { month: 'short' });
    const previous = buckets.get(key) || { month: label, users: 0, premium: 0 };
    buckets.set(key, {
      ...previous,
      users: previous.users + 1,
      premium: previous.premium + (user.is_premium ? 1 : 0),
    });
  });
  return Array.from(buckets.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .slice(-8)
    .map(([, value]) => value);
}

export function questionOptionsToText(options = []) {
  return (Array.isArray(options) ? options : []).join('\n');
}

export function questionImagesToText(images = []) {
  return (Array.isArray(images) ? images : []).join('\n');
}

export function textToLines(value) {
  return String(value || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}
