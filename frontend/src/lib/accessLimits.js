const DAY_KEY = new Date().toISOString().slice(0, 10);
const TEST_LIMIT_PREFIX = 'pdr_free_test_limits:v2';
const BATTLE_LIMIT_PREFIX = 'pdr_free_battle_limits:v2';
const TICKET_PREVIEW_PREFIX = 'pdr_free_ticket_preview_limits:v2';
const GUEST_ID_KEY = 'driveprep_guest_id:v1';
const GUEST_ID_COOKIE = 'driveprep_guest_id';
const FREE_DAILY_TEST_LIMIT = 1;
const FREE_DAILY_BATTLE_LIMIT = 1;
const FREE_DAILY_TICKET_PREVIEW_LIMIT = 1;

function getCookie(name) {
  if (typeof document === 'undefined') return '';
  const escaped = String(name).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = document.cookie.match(new RegExp(`(?:^|; )${escaped}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : '';
}

function setCookie(name, value) {
  if (typeof document === 'undefined') return;
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=31536000; SameSite=Lax${secure}`;
}

function createGuestId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  const random = Math.random().toString(16).slice(2);
  return `${Date.now()}-${random}`;
}

export function getGuestId() {
  if (typeof window === 'undefined') return 'server-guest';
  const existing = localStorage.getItem(GUEST_ID_KEY) || getCookie(GUEST_ID_COOKIE);
  if (existing) {
    localStorage.setItem(GUEST_ID_KEY, existing);
    setCookie(GUEST_ID_COOKIE, existing);
    return existing;
  }
  const next = createGuestId();
  localStorage.setItem(GUEST_ID_KEY, next);
  setCookie(GUEST_ID_COOKIE, next);
  return next;
}

function readJson(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || '{}');
  } catch {
    return {};
  }
}

function writeJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

export function isPremiumUser(user) {
  return Boolean(user?.is_premium);
}

function getUserScope(user) {
  if (!user) return `guest:${getGuestId()}`;
  const identity = user?.id || user?.email || user?.username || 'guest';
  return String(identity).trim().toLowerCase();
}

function getScopedKey(prefix, user) {
  return `${prefix}:${DAY_KEY}:${getUserScope(user)}`;
}

export function getFreeTestUsage(user, mode) {
  const usage = readJson(getScopedKey(TEST_LIMIT_PREFIX, user));
  if (!user) return Number(usage.__all || usage[mode] || 0);
  return Number(usage.__all || usage[mode] || 0);
}

export function canStartFreeTest(user, mode) {
  if (isPremiumUser(user)) return true;
  return getFreeTestUsage(user, mode) < FREE_DAILY_TEST_LIMIT;
}

export function registerFreeTestCompletion(user, mode) {
  const usage = readJson(getScopedKey(TEST_LIMIT_PREFIX, user));
  usage[mode] = Number(usage[mode] || 0) + 1;
  usage.__all = Number(usage.__all || 0) + 1;
  writeJson(getScopedKey(TEST_LIMIT_PREFIX, user), usage);
}

export function getRemainingFreeTests(user, mode) {
  return Math.max(0, FREE_DAILY_TEST_LIMIT - getFreeTestUsage(user, mode));
}

export function getFreeBattleUsage(user) {
  const usage = readJson(getScopedKey(BATTLE_LIMIT_PREFIX, user));
  return Number(usage.count || 0);
}

export function canStartFreeBattle(user) {
  if (isPremiumUser(user)) return true;
  return getFreeBattleUsage(user) < FREE_DAILY_BATTLE_LIMIT;
}

export function registerFreeBattleStart(user) {
  const usage = readJson(getScopedKey(BATTLE_LIMIT_PREFIX, user));
  usage.count = Number(usage.count || 0) + 1;
  writeJson(getScopedKey(BATTLE_LIMIT_PREFIX, user), usage);
}

export function getRemainingFreeBattles(user) {
  return Math.max(0, FREE_DAILY_BATTLE_LIMIT - getFreeBattleUsage(user));
}

export function getFreeTicketPreviewUsage(user) {
  const usage = readJson(getScopedKey(TICKET_PREVIEW_PREFIX, user));
  return Number(usage.count || 0);
}

export function canPreviewFreeTicket(user, ticketNumber = null) {
  if (isPremiumUser(user)) return true;
  const usage = readJson(getScopedKey(TICKET_PREVIEW_PREFIX, user));
  if (ticketNumber && String(usage.ticketNumber || '') === String(ticketNumber)) return true;
  return Number(usage.count || 0) < FREE_DAILY_TICKET_PREVIEW_LIMIT;
}

export function registerFreeTicketPreview(user, ticketNumber) {
  if (isPremiumUser(user)) return;
  const usage = readJson(getScopedKey(TICKET_PREVIEW_PREFIX, user));
  if (ticketNumber && String(usage.ticketNumber || '') === String(ticketNumber)) return;
  usage.count = Number(usage.count || 0) + 1;
  usage.ticketNumber = ticketNumber ? String(ticketNumber) : '';
  writeJson(getScopedKey(TICKET_PREVIEW_PREFIX, user), usage);
}

export function getRemainingFreeTicketPreviews(user) {
  return Math.max(0, FREE_DAILY_TICKET_PREVIEW_LIMIT - getFreeTicketPreviewUsage(user));
}
