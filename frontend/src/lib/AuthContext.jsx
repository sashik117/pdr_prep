import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import api, { tokenStore, userStore } from '@/api/apiClient';

const AuthContext = /** @type {import('react').Context<import('@/types/app').AuthContextValue | null>} */ (
  createContext(/** @type {import('@/types/app').AuthContextValue | null} */ (null))
);

const getCurrentLocation = () => `${window.location.pathname}${window.location.search}`;

/**
 * @param {'login' | 'register'} tab
 * @param {string=} redirectTo
 */
const navigateToAuth = (tab, redirectTo = getCurrentLocation()) => {
  const params = new URLSearchParams({ tab });
  if (redirectTo && !redirectTo.startsWith('/auth')) {
    params.set('redirect', redirectTo);
  }
  window.location.href = `/auth?${params.toString()}`;
};

/**
 * @param {{ children: import('react').ReactNode }} props
 */
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(/** @type {import('@/types/app').UserProfile | null} */ (userStore.get()));
  const [isAuthenticated, setIsAuthenticated] = useState(!!tokenStore.get() && !!userStore.get());
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);
  const [authError, setAuthError] = useState(/** @type {import('@/types/app').AuthError} */ (null));

  const checkUserAuth = useCallback(async () => {
    const token = tokenStore.get();
    if (!token) {
      setUser(null);
      setIsAuthenticated(false);
      setAuthChecked(true);
      setIsLoadingAuth(false);
      setAuthError(null);
      return null;
    }

    setIsLoadingAuth(true);
    try {
      const me = await api.me();
      userStore.set(me, !!localStorage.getItem('pdr_user'));
      setUser(me);
      setIsAuthenticated(true);
      setAuthError(null);
      return me;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Потрібна авторизація';
      const status = typeof error === 'object' && error ? /** @type {{ status?: number }} */ (error).status : undefined;
      const blocked = status === 403 && String(message).toLowerCase().includes('заблок');
      if (status === 401 || blocked) {
        tokenStore.clear();
        userStore.clear();
        setUser(null);
        setIsAuthenticated(false);
      } else {
        const cachedUser = userStore.get();
        setUser(cachedUser);
        setIsAuthenticated(!!tokenStore.get() && !!cachedUser);
      }
      setAuthError({
        type: status === 401 || blocked ? 'auth_required' : 'auth_temporary_unavailable',
        message,
      });
      return null;
    } finally {
      setAuthChecked(true);
      setIsLoadingAuth(false);
    }
  }, []);

  useEffect(() => {
    void checkUserAuth();
  }, [checkUserAuth]);

  const login = useCallback(
    /**
     * @param {string} token
     * @param {import('@/types/app').UserProfile} currentUser
     * @param {boolean} [rememberMe=true]
     */
    (token, currentUser, rememberMe = true) => {
      tokenStore.set(token, rememberMe);
      userStore.set(currentUser, rememberMe);
      setUser(currentUser);
      setIsAuthenticated(true);
      setAuthError(null);
      setAuthChecked(true);
    },
    [],
  );

  const logout = useCallback(() => {
    tokenStore.clear();
    userStore.clear();
    setUser(null);
    setIsAuthenticated(false);
    setAuthError(null);
    setAuthChecked(true);
    window.location.href = '/';
  }, []);

  const navigateToLogin = useCallback(
    /** @param {string} [redirectTo] */
    (redirectTo) => {
      navigateToAuth('login', redirectTo);
    },
    [],
  );

  const navigateToRegister = useCallback(
    /** @param {string} [redirectTo] */
    (redirectTo) => {
      navigateToAuth('register', redirectTo);
    },
    [],
  );

  const value = useMemo(() => ({
    user,
    isAuthenticated,
    isLoadingAuth,
    authChecked,
    authError,
    login,
    logout,
    navigateToLogin,
    navigateToRegister,
    checkUserAuth,
  }), [user, isAuthenticated, isLoadingAuth, authChecked, authError, login, logout, navigateToLogin, navigateToRegister, checkUserAuth]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
