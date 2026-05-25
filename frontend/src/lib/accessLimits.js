const DAY_KEY = new Date().toISOString().slice(0, 10);
const TEST_LIMIT_PREFIX = 'pdr_free_test_limits';
const BATTLE_LIMIT_PREFIX = 'pdr_free_battle_limits';

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
  if (!user) return 'guest';
  const identity = user?.id || user?.email || user?.username || 'guest';
  return String(identity).trim().toLowerCase();
}

function getScopedKey(prefix, user) {
  return `${prefix}:${DAY_KEY}:${getUserScope(user)}`;
}

export function getFreeTestUsage(user, mode) {
  const usage = readJson(getScopedKey(TEST_LIMIT_PREFIX, user));
  return Number(usage[mode] || 0);
}

export function canStartFreeTest(user, mode) {
  if (isPremiumUser(user)) return true;
  return getFreeTestUsage(user, mode) < 3;
}

export function registerFreeTestCompletion(user, mode) {
  const usage = readJson(getScopedKey(TEST_LIMIT_PREFIX, user));
  usage[mode] = Number(usage[mode] || 0) + 1;
  writeJson(getScopedKey(TEST_LIMIT_PREFIX, user), usage);
}

export function getRemainingFreeTests(user, mode) {
  return Math.max(0, 3 - getFreeTestUsage(user, mode));
}

export function getFreeBattleUsage(user) {
  const usage = readJson(getScopedKey(BATTLE_LIMIT_PREFIX, user));
  return Number(usage.count || 0);
}

export function canStartFreeBattle(user) {
  if (isPremiumUser(user)) return true;
  return getFreeBattleUsage(user) < 3;
}

export function registerFreeBattleStart(user) {
  const usage = readJson(getScopedKey(BATTLE_LIMIT_PREFIX, user));
  usage.count = Number(usage.count || 0) + 1;
  writeJson(getScopedKey(BATTLE_LIMIT_PREFIX, user), usage);
}

export function getRemainingFreeBattles(user) {
  return Math.max(0, 3 - getFreeBattleUsage(user));
}
