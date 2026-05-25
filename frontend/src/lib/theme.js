const THEMES = new Set(['light', 'dark']);
export function getStoredTheme() {
  const stored = localStorage.getItem('theme');
  if (THEMES.has(stored)) return stored;
  return 'light';
}

export function getEffectiveDark(theme = getStoredTheme()) {
  return theme === 'dark';
}

export function applyTheme(theme = getStoredTheme()) {
  const nextTheme = THEMES.has(theme) ? theme : getStoredTheme();
  document.documentElement.classList.toggle('dark', getEffectiveDark(nextTheme));
  document.documentElement.setAttribute('data-theme', nextTheme);
}

export function notifyThemeChange(theme = getStoredTheme()) {
  window.dispatchEvent(new CustomEvent('driveprep:theme-change', { detail: { theme } }));
}
