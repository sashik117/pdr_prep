export function computeStreak(dates) {
  if (!dates?.length) return 0;

  const unique = [...new Set(dates)].sort().reverse();
  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

  if (unique[0] !== today && unique[0] !== yesterday) return 0;

  let streak = 1;
  for (let i = 1; i < unique.length; i += 1) {
    const current = new Date(unique[i - 1]);
    const previous = new Date(unique[i]);
    const diff = (current - previous) / 86400000;
    if (Math.round(diff) === 1) streak += 1;
    else break;
  }

  return streak;
}

export function streakFlames(days) {
  if (days >= 90) return '🔥🔥🔥🔥';
  if (days >= 28) return '🔥🔥🔥';
  if (days >= 7) return '🔥🔥';
  if (days >= 1) return '🔥';
  return '';
}
