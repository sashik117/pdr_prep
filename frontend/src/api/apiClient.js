// @ts-nocheck
import { getGuestId } from '@/lib/accessLimits';

const DEFAULT_API_URL =
  import.meta.env.PROD && typeof window !== 'undefined'
    ? window.location.origin
    : 'http://127.0.0.1:8000';
const BASE_URL = (import.meta.env.VITE_API_URL || DEFAULT_API_URL).replace(/\/$/, '');

const TOKEN_KEY = 'pdr_token';
const USER_KEY = 'pdr_user';
const TOKEN_COOKIE = 'pdr_token';
const ADMIN_TOKEN_KEY = 'driveprep_admin_token';
const ADMIN_USER_KEY = 'driveprep_admin_user';
const ONE_DAY_SECONDS = 60 * 60 * 24;
const REMEMBER_ME_DAYS = 90;

function getCookie(name) {
  const escaped = String(name).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = document.cookie.match(new RegExp(`(?:^|; )${escaped}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function setCookie(name, value, maxAgeSeconds) {
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAgeSeconds}; SameSite=Lax${secure}`;
}

function clearCookie(name) {
  document.cookie = `${name}=; Path=/; Max-Age=0; SameSite=Lax`;
}

/**
 * @param {string | null | undefined} value
 * @returns {string | null}
 */
export function resolveApiUrl(value) {
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  if (!value.startsWith('/')) return `${BASE_URL}/${value}`;
  return `${BASE_URL}${value}`;
}

export function resolveWsUrl(path = '/ws') {
  const base = BASE_URL.replace(/^http/i, 'ws');
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

/**
 * @param {any} user
 */
function normalizeUser(user) {
  if (!user) return user;
  const avatarUrl = resolveApiUrl(user.avatar_url);
  const avatarVersion = Number(user.avatar_version || 0);
  return {
    ...user,
    avatar_url: avatarUrl
      ? (avatarVersion > 0 && !avatarUrl.includes('?v=') ? `${avatarUrl}${avatarUrl.includes('?') ? '&' : '?'}v=${avatarVersion}` : avatarUrl)
      : null,
  };
}

/**
 * @param {any[]} rows
 */
function normalizeUsers(rows = []) {
  return rows.map((row) => ({
    ...row,
    user: normalizeUser(row.user),
  }));
}

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY) || getCookie(TOKEN_COOKIE),
  hasPersistent: () => !!localStorage.getItem(TOKEN_KEY),
  hasSession: () => !!sessionStorage.getItem(TOKEN_KEY),
  /**
   * @param {string} token
   * @param {boolean} [rememberMe=true]
   */
  set: (token, rememberMe = true) => {
    const maxAge = (rememberMe ? REMEMBER_ME_DAYS : 1) * ONE_DAY_SECONDS;
    clearCookie(TOKEN_COOKIE);
    localStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(TOKEN_KEY);
    if (rememberMe) {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      sessionStorage.setItem(TOKEN_KEY, token);
    }
    setCookie(TOKEN_COOKIE, token, maxAge);
  },
  clear: () => {
    localStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    sessionStorage.removeItem(USER_KEY);
    clearCookie(TOKEN_COOKIE);
  },
};

export const userStore = {
  get: () => {
    try {
      const raw = localStorage.getItem(USER_KEY) || sessionStorage.getItem(USER_KEY);
      return raw ? normalizeUser(JSON.parse(raw)) : null;
    } catch {
      return null;
    }
  },
  hasPersistent: () => !!localStorage.getItem(USER_KEY),
  hasSession: () => !!sessionStorage.getItem(USER_KEY),
  /**
   * @param {import('@/types/app').UserProfile} user
   * @param {boolean} [rememberMe=true]
   */
  set: (user, rememberMe = true) => {
    const value = JSON.stringify(normalizeUser(user));
    localStorage.removeItem(USER_KEY);
    sessionStorage.removeItem(USER_KEY);
    if (rememberMe) {
      localStorage.setItem(USER_KEY, value);
    } else {
      sessionStorage.setItem(USER_KEY, value);
    }
  },
  clear: () => {
    localStorage.removeItem(USER_KEY);
    sessionStorage.removeItem(USER_KEY);
  },
};

export const adminTokenStore = {
  get: () => localStorage.getItem(ADMIN_TOKEN_KEY) || sessionStorage.getItem(ADMIN_TOKEN_KEY),
  hasPersistent: () => !!localStorage.getItem(ADMIN_TOKEN_KEY),
  set: (token, rememberMe = true) => {
    localStorage.removeItem(ADMIN_TOKEN_KEY);
    sessionStorage.removeItem(ADMIN_TOKEN_KEY);
    if (rememberMe) {
      localStorage.setItem(ADMIN_TOKEN_KEY, token);
    } else {
      sessionStorage.setItem(ADMIN_TOKEN_KEY, token);
    }
  },
  clear: () => {
    localStorage.removeItem(ADMIN_TOKEN_KEY);
    sessionStorage.removeItem(ADMIN_TOKEN_KEY);
    localStorage.removeItem(ADMIN_USER_KEY);
    sessionStorage.removeItem(ADMIN_USER_KEY);
  },
};

export const adminUserStore = {
  get: () => {
    try {
      const raw = localStorage.getItem(ADMIN_USER_KEY) || sessionStorage.getItem(ADMIN_USER_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },
  set: (admin, rememberMe = true) => {
    const value = JSON.stringify(admin);
    localStorage.removeItem(ADMIN_USER_KEY);
    sessionStorage.removeItem(ADMIN_USER_KEY);
    if (rememberMe) {
      localStorage.setItem(ADMIN_USER_KEY, value);
    } else {
      sessionStorage.setItem(ADMIN_USER_KEY, value);
    }
  },
  clear: () => {
    localStorage.removeItem(ADMIN_USER_KEY);
    sessionStorage.removeItem(ADMIN_USER_KEY);
  },
};

/**
 * @param {Record<string, string | number | boolean | null | undefined>} params
 */
function toQueryString(params = {}) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    search.append(key, String(value));
  });
  return search.toString();
}

/**
 * @param {string} path
 * @param {RequestInit} [options]
 */
async function request(path, options = {}) {
  const adminToken = path.startsWith('/admin') ? adminTokenStore.get() : null;
  const token = adminToken || tokenStore.get();
  const headers = new Headers(options.headers || {});
  if (!(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (!headers.has('Accept')) {
    headers.set('Accept', 'application/json');
  }
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  if (!headers.has('X-DrivePrep-Guest-Id')) {
    headers.set('X-DrivePrep-Guest-Id', getGuestId());
  }

  let response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      ...options,
      headers,
    });
  } catch (error) {
    throw new Error('Не вдалося підключитися до сервера DrivePrep. Перевірте підключення і спробуйте ще раз.');
  }

  if (response.status === 204) return null;
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const raw = data?.detail ?? data?.message ?? `HTTP ${response.status}`;
    const message = typeof raw === 'string' ? raw : JSON.stringify(raw);
    const error = new Error(message);
    // @ts-ignore
    error.status = response.status;
    throw error;
  }
  return data;
}

export const api = {
  register: (payload) =>
    request('/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  verifyEmail: (email, code) =>
    request('/auth/verify-email', {
      method: 'POST',
      body: JSON.stringify({ email, code }),
    }),

  login: (identifier, password, remember_me = true) =>
    request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ identifier, password, remember_me }),
    }),
  adminLogin: (username, password, remember_me = true) =>
    request('/admin/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password, remember_me }),
    }),
  adminMe: () => request('/admin/auth/me'),

  resendVerification: (email) =>
    request('/auth/resend-verification', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),

  forgotPassword: (email) =>
    request('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),

  resetPassword: (email, code, new_password) =>
    request('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ email, code, new_password }),
    }),

  me: async () => normalizeUser(await request('/auth/me')),

  updateProfile: async (data) => normalizeUser(await request('/users/me', {
    method: 'PATCH',
    body: JSON.stringify(data),
  })),

  uploadAvatar: async (file) => {
    const form = new FormData();
    form.append('file', file);
    const response = await request('/users/me/avatar', { method: 'POST', body: form });
    return normalizeUser(response?.user || response);
  },

  deleteAvatar: async () => {
    const response = await request('/users/me/avatar', { method: 'DELETE' });
    return normalizeUser(response?.user || response);
  },

  getUserProfile: async (id) => normalizeUser(await request(`/users/${id}/profile`)),
  getUserProfileByUsername: async (username) => normalizeUser(await request(`/users/by-username/${String(username).replace(/^@/, '')}/profile`)),

  getQuestions: (params = {}) => {
    const query = toQueryString(params);
    return request(`/questions${query ? `?${query}` : ''}`);
  },

  getRandomQuestions: (params = {}) => {
    const query = toQueryString(params);
    return request(`/questions/random${query ? `?${query}` : ''}`);
  },

  getMvsExamQuestions: (params = {}) => {
    const query = toQueryString(params);
    return request(`/questions/mvs-exam${query ? `?${query}` : ''}`);
  },

  getSections: (category) => {
    const query = toQueryString({ category });
    return request(`/sections${query ? `?${query}` : ''}`);
  },

  getHandbookTopics: () => request('/handbook/topics'),
  getHandbookEntries: (topic) => {
    const query = toQueryString({ topic });
    return request(`/handbook/entries${query ? `?${query}` : ''}`);
  },
  getHandbookEntry: (entryId) => request(`/handbook/entries/${entryId}`),
  searchHandbook: (q, topic) => {
    const query = toQueryString({ q, topic });
    return request(`/handbook/search${query ? `?${query}` : ''}`);
  },
  getTheoryCategories: () => request('/theory/categories'),
  getTheoryTopics: (category) => {
    const query = toQueryString({ category });
    return request(`/theory/topics${query ? `?${query}` : ''}`);
  },
  getTheorySections: (topic) => {
    const query = toQueryString({ topic });
    return request(`/theory/sections${query ? `?${query}` : ''}`);
  },
  getTheorySection: (sectionId) => request(`/theory/sections/${sectionId}`),
  getPromoStatus: () => request('/promo/status'),
  checkAccessLimit: (action) =>
    request('/access/limits/check', {
      method: 'POST',
      body: JSON.stringify({ action }),
    }),
  consumeAccessLimit: (action) =>
    request('/access/limits/consume', {
      method: 'POST',
      body: JSON.stringify({ action }),
    }),
  getPremiumFeatures: () => request('/premium/features'),
  getPremiumSettings: () => request('/premium/settings'),
  updatePromoConfig: (payload, adminKey) =>
    request('/admin/promo/config', {
      method: 'PATCH',
      headers: adminKey ? { 'x-admin-key': adminKey } : undefined,
      body: JSON.stringify(payload),
    }),
  startPromo: (payload = {}, adminKey) =>
    request('/admin/promo/start', {
      method: 'POST',
      headers: adminKey ? { 'x-admin-key': adminKey } : undefined,
      body: JSON.stringify(payload),
    }),
  stopPromo: (adminKey) =>
    request('/admin/promo/stop', {
      method: 'POST',
      headers: adminKey ? { 'x-admin-key': adminKey } : undefined,
    }),
  getTickets: (category) => {
    const query = toQueryString({ category });
    return request(`/tickets${query ? `?${query}` : ''}`);
  },
  getTicket: (ticketNumber, category) => {
    const query = toQueryString({ category });
    return request(`/tickets/${ticketNumber}${query ? `?${query}` : ''}`);
  },
  createPremiumCheckout: (plan_code, return_url) =>
    request('/payment/checkout', {
      method: 'POST',
      body: JSON.stringify({ plan_code, return_url }),
    }),
  getPaymentStatus: (orderId) => request(`/payment/status/${encodeURIComponent(orderId)}`),
  mockActivatePremium: (orderId) =>
    request(`/payment/mock/activate/${encodeURIComponent(orderId)}`, {
      method: 'POST',
    }),

  importQuestions: (payload) =>
    request('/questions/import', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  submitTestResult: (data) =>
    request('/progress/test-result', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  submitMarathonScore: (score) =>
    request('/progress/marathon-score', {
      method: 'POST',
      body: JSON.stringify({ score }),
    }),
  restoreStreak: () =>
    request('/progress/streak-restore', {
      method: 'POST',
    }),

  getStats: async () => {
    const data = await request('/progress/stats');
    return {
      ...data,
      user: normalizeUser(data?.user),
    };
  },
  getTestResults: () => request('/progress/results'),
  getAchievements: () => request('/achievements'),
  getLeaderboard: async () => (await request('/leaderboard')).map(normalizeUser),
  getNotificationSummary: () => request('/notifications/summary'),
  getSupportMessages: () => request('/support/messages'),
  sendSupportMessage: (content) =>
    request('/support/messages', {
      method: 'POST',
      body: JSON.stringify({ content }),
    }),
  sendSupportMessageAttachment: (content, file) => {
    const form = new FormData();
    form.append('content', content || '');
    form.append('file', file);
    return request('/support/messages/attachment', {
      method: 'POST',
      body: form,
    });
  },
  purchaseFrame: (frame_id) =>
    request('/frames/purchase', {
      method: 'POST',
      body: JSON.stringify({ frame_id }),
    }),
  getAdminSupportConversations: () => request('/admin/support/conversations'),
  getAdminSupportConversation: (userId) => request(`/admin/support/conversations/${userId}`),
  replyAdminSupport: (userId, content) =>
    request(`/admin/support/conversations/${userId}`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    }),
  getAdminUsers: () => request('/admin/users'),
  createAdminUser: (payload) =>
    request('/admin/users', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  getAdminPremiumSettings: () => request('/admin/premium/settings'),
  updateAdminPremiumSettings: (payload) =>
    request('/admin/premium/settings', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  getAdminPremiumFeatures: () => request('/admin/premium/features'),
  updateAdminPremiumFeatures: (features) =>
    request('/admin/premium/features', {
      method: 'PATCH',
      body: JSON.stringify({ features }),
    }),
  getAdminPremiumOrders: (limit = 60) => request(`/admin/premium/orders?limit=${encodeURIComponent(limit)}`),
  activateAdminPremiumOrder: (orderId) =>
    request(`/admin/premium/orders/${encodeURIComponent(orderId)}/activate`, {
      method: 'POST',
    }),
  getAdminUserAudit: (userId) => request(`/admin/users/${userId}/audit`),
  updateAdminUser: (userId, payload) =>
    request(`/admin/users/${userId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  deleteAdminUser: (userId) =>
    request(`/admin/users/${userId}`, {
      method: 'DELETE',
    }),
  resetAdminUserPassword: (userId) =>
    request(`/admin/users/${userId}/reset-password`, {
      method: 'POST',
    }),
  updateAdminUserAchievements: (userId, payload) =>
    request(`/admin/users/${userId}/achievements`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  getAdminQuestionSections: () => request('/admin/questions/sections'),
  searchAdminQuestions: (search = '') => {
    const query = toQueryString(typeof search === 'object' ? search : { search });
    return request(`/admin/questions${query ? `?${query}` : ''}`);
  },
  createAdminQuestion: (payload) =>
    request('/admin/questions', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateAdminQuestion: (questionId, payload) =>
    request(`/admin/questions/${questionId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  deleteAdminQuestion: (questionId) =>
    request(`/admin/questions/${questionId}`, {
      method: 'DELETE',
    }),
  uploadAdminMedia: (file, { scope = 'general', sectionId = null } = {}) => {
    const form = new FormData();
    form.append('file', file);
    form.append('scope', scope);
    if (sectionId) form.append('section_id', String(sectionId));
    return request('/admin/media/upload', {
      method: 'POST',
      body: form,
    });
  },
  getAdminTheorySummary: () => request('/admin/theory/summary'),
  startAdminTheoryParse: (payload = {}) =>
    request('/admin/theory/parse', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  getAdminTheoryParseStatus: () => request('/admin/theory/parse/status'),
  searchAdminTheorySections: (params = {}) => {
    const query = toQueryString(params);
    return request(`/admin/theory/sections${query ? `?${query}` : ''}`);
  },
  updateAdminTheorySection: (sectionId, payload) =>
    request(`/admin/theory/sections/${sectionId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  getFriends: async () => {
    const data = await request('/friends');
    return {
      friends: normalizeUsers(data?.friends || []),
      incoming: normalizeUsers(data?.incoming || []),
      outgoing: normalizeUsers(data?.outgoing || []),
    };
  },

  inviteFriend: (username) =>
    request('/friends/invite', {
      method: 'POST',
      body: JSON.stringify({ username }),
    }),

  acceptFriend: (friendshipId) =>
    request(`/friends/${friendshipId}/accept`, {
      method: 'POST',
    }),

  removeFriend: (friendshipId) =>
    request(`/friends/${friendshipId}`, {
      method: 'DELETE',
    }),

  getMessages: (partner) => {
    const query = toQueryString({ partner_email: partner });
    return request(`/messages${query ? `?${query}` : ''}`);
  },

  sendMessage: (payload) =>
    request('/messages', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getBattles: () => request('/battles'),

  createBattle: (payload) =>
    request('/battles', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  importBundledQuestions: () =>
    request('/questions/import-bundled', {
      method: 'POST',
    }),

  acceptBattle: (battleId) =>
    request(`/battles/${battleId}/accept`, {
      method: 'POST',
    }),

  declineBattle: (battleId) =>
    request(`/battles/${battleId}/decline`, {
      method: 'POST',
    }),

  cancelBattle: (battleId) =>
    request(`/battles/${battleId}/cancel`, {
      method: 'POST',
    }),

  getBattle: (battleId) => request(`/battles/${battleId}`),

  submitBattle: (battleId, payload) =>
    request(`/battles/${battleId}/submit`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
};

export default api;
