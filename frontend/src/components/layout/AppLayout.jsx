import { Link, Outlet, useLocation } from 'react-router-dom';
import { Crown, LifeBuoy, LogOut, Menu, MessageCircleMore, Settings, UserCircle2, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/lib/AuthContext';
import InternalBackButton from '@/components/layout/InternalBackButton';
import { desktopSidebarGroups } from '@/components/layout/navigation-config';
import SiteFooter from '@/components/layout/SiteFooter';
import api, { resolveApiUrl, resolveWsUrl, tokenStore } from '@/api/apiClient';
import { getPendingTestResults, removePendingTestResult } from '@/lib/offlineProgress';
import { applyTheme, getStoredTheme } from '@/lib/theme';

const CONNECTIVITY_CHECK_URL = 'https://www.gstatic.com/generate_204';

/** @type {Record<string, string>} */
const pageTitles = {
  '/tests': 'Тести',
  '/section-tests': 'Тести по розділах',
  '/test': 'Проходження тесту',
  '/daily': 'Виклик дня',
  '/signs': 'Дорожні знаки',
  '/study': 'Теорія',
  '/lectures': 'Відеолекції',
  '/tickets': 'Білети',
  '/saved-questions': 'Збережені запитання',
  '/pricing': 'Premium',
  '/mistakes': 'Помилки',
  '/marathon': 'Марафон',
  '/analytics': 'Аналітика',
  '/leaderboard': 'Рейтинг',
  '/friends': 'Друзі',
  '/battle': 'Батли',
  '/cabinet': 'Профіль',
  '/u/': 'Профіль користувача',
  '/privacy': 'Конфіденційність',
  '/terms': 'Угода підписника',
  '/settings': 'Налаштування',
  '/support': 'Підтримка',
  '/achievements': 'Досягнення',
  '/import': 'Імпорт питань',
};

/**
 * @param {string} pathname
 * @returns {string}
 */
function resolveTitle(pathname) {
  const directMatch = Object.entries(pageTitles)
    .sort((a, b) => b[0].length - a[0].length)
    .find(([path]) => pathname.startsWith(path));
  return directMatch?.[1] || '';
}

/**
 * @param {string} pathname
 * @returns {boolean}
 */
function shouldShowBackButton(pathname) {
  return pathname !== '/';
}

/**
 * @param {{ value: number }} props
 */
function Badge({ value }) {
  if (!value) return null;
  return (
    <span className="absolute -right-1 -top-1 inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[11px] font-semibold text-white">
      {Math.min(value, 9)}
    </span>
  );
}

export default function AppLayout() {
  const location = useLocation();
  const queryClient = useQueryClient();
  const [mobileSection, setMobileSection] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isOnline, setIsOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);
  const networkBootRef = useRef(true);
  const previousOnlineRef = useRef(/** @type {boolean | null} */ (null));
  const { isAuthenticated, user, logout } = useAuth();
  const { toast } = useToast();

  const notificationsQuery = useQuery({
    queryKey: ['notification-summary'],
    queryFn: () => api.getNotificationSummary(),
    enabled: isAuthenticated,
    staleTime: 20_000,
    refetchInterval: 20_000,
  });

  const notificationSummary = notificationsQuery.data || { friends: 0, battles: 0, support: 0 };
  const isAdminUser = /** @type {any} */ (user)?.is_admin;
  const profileAvatar = user?.avatar_url || null;
  const desktopMenuGroups = useMemo(
    () =>
      desktopSidebarGroups
        .map((group) => ({
          ...group,
          items: group.items.filter((item) => {
            if (item.path === '/pricing' && (!isAuthenticated || user?.is_premium)) return false;
            if (!isAuthenticated && item.premium) return false;
            return item.path !== '/cabinet' && item.path !== '/support';
          }),
        }))
        .filter((group) => group.items.length > 0),
    [isAuthenticated, user?.is_premium],
  );
  const mobileMenuGroups = useMemo(
    () =>
      desktopSidebarGroups
        .map((group) => ({
          ...group,
          items: group.items.filter((item) => {
            if (item.path === '/pricing' && (!isAuthenticated || user?.is_premium)) return false;
            if (!isAuthenticated && item.premium) return false;
            return item.path !== '/cabinet';
          }),
        }))
        .filter((group) => group.items.length > 0),
    [isAuthenticated, user?.is_premium],
  );

  const pageTitle = useMemo(() => {
    if (location.pathname === '/cabinet' && isAdminUser) {
      return 'Панель керування';
    }
    return resolveTitle(location.pathname);
  }, [isAdminUser, location.pathname]);

  const showBackButton = useMemo(() => shouldShowBackButton(location.pathname), [location.pathname]);
  const showPageHeader = location.pathname !== '/' && !!pageTitle;

  useEffect(() => {
    const savedFontSize = parseInt(localStorage.getItem('fontSize') || '16', 10);
    applyTheme(getStoredTheme());
    document.documentElement.style.fontSize = `${savedFontSize}px`;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const handleTheme = () => applyTheme(getStoredTheme());
    const handleStorage = (event) => {
      if (!event.key || event.key === 'theme') {
        handleTheme();
      }
      if (!event.key || event.key === 'fontSize') {
        document.documentElement.style.fontSize = `${parseInt(localStorage.getItem('fontSize') || '16', 10)}px`;
      }
    };

    window.addEventListener('driveprep:theme-change', handleTheme);
    window.addEventListener('storage', handleStorage);
    media.addEventListener('change', handleTheme);

    return () => {
      window.removeEventListener('driveprep:theme-change', handleTheme);
      window.removeEventListener('storage', handleStorage);
      media.removeEventListener('change', handleTheme);
    };
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
    setMobileSection('');
    setMobileMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const syncPendingResults = async () => {
      if (!tokenStore.get()) return;
      const pending = await getPendingTestResults().catch(() => []);
      for (const item of pending) {
        try {
          await api.submitTestResult(item.payload);
          await removePendingTestResult(item.id);
        } catch {
          break;
        }
      }
      queryClient.invalidateQueries({ queryKey: ['cabinet-stats'] });
      queryClient.invalidateQueries({ queryKey: ['test-results'] });
    };

    const checkServerConnection = async () => {
      const healthUrl = resolveApiUrl('/health');
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        setIsOnline(false);
        if (!networkBootRef.current && previousOnlineRef.current !== false) {
          toast({
            title: 'З’єднання втрачено',
            description: 'Працюємо офлайн!',
            variant: 'destructive',
          });
        }
        previousOnlineRef.current = false;
        return;
      }

      try {
        if (!healthUrl) {
          setIsOnline(false);
          previousOnlineRef.current = false;
          return;
        }
        const [healthResponse] = await Promise.all([
          fetch(healthUrl, {
            method: 'GET',
            cache: 'no-store',
          }),
          fetch(CONNECTIVITY_CHECK_URL, {
            method: 'GET',
            mode: 'no-cors',
            cache: 'no-store',
          }),
        ]);
        const nextOnline = healthResponse.ok;
        setIsOnline(nextOnline);

        if (!networkBootRef.current && previousOnlineRef.current !== null && previousOnlineRef.current !== nextOnline) {
          if (nextOnline) {
            toast({
              title: 'З’єднання відновлено',
              description: 'Дані синхронізуються.',
            });
            void syncPendingResults();
          } else {
            toast({
              title: 'З’єднання втрачено',
              description: 'Працюємо офлайн!',
              variant: 'destructive',
            });
          }
        }
        previousOnlineRef.current = nextOnline;
      } catch {
        setIsOnline(false);
        if (!networkBootRef.current && previousOnlineRef.current !== false) {
          toast({
            title: 'З’єднання втрачено',
            description: 'Працюємо офлайн!',
            variant: 'destructive',
          });
        }
        previousOnlineRef.current = false;
      }
    };

    const handleOnline = () => {
      void checkServerConnection();
    };
    const handleOffline = () => {
      setIsOnline(false);
      if (!networkBootRef.current && previousOnlineRef.current !== false) {
        toast({
          title: 'З’єднання втрачено',
          description: 'Працюємо офлайн!',
          variant: 'destructive',
        });
      }
      previousOnlineRef.current = false;
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    void checkServerConnection();
    const interval = window.setInterval(() => {
      void checkServerConnection();
    }, 15000);
    networkBootRef.current = false;

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.clearInterval(interval);
    };
  }, [queryClient, toast]);

  useEffect(() => {
    if (!isAuthenticated) return undefined;
    const token = tokenStore.get();
    if (!token) return undefined;

    const socket = new WebSocket(resolveWsUrl(`/ws?token=${encodeURIComponent(token)}`));
    socket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        const eventType = String(message?.event || '');
        if (eventType.includes('support')) {
          queryClient.invalidateQueries({ queryKey: ['support-messages'] });
          queryClient.invalidateQueries({ queryKey: ['admin-support-conversations'] });
          queryClient.invalidateQueries({ queryKey: ['admin-support-thread'] });
        }
        if (eventType.includes('friend')) {
          queryClient.invalidateQueries({ queryKey: ['friends'] });
          queryClient.invalidateQueries({ queryKey: ['messages'] });
        }
        if (eventType.includes('battle')) {
          queryClient.invalidateQueries({ queryKey: ['battles'] });
          queryClient.invalidateQueries({ queryKey: ['battle-details'] });
        }
        queryClient.invalidateQueries({ queryKey: ['notification-summary'] });
      } catch {
        queryClient.invalidateQueries({ queryKey: ['notification-summary'] });
      }
    };

    return () => {
      socket.close();
    };
  }, [isAuthenticated, queryClient]);

  return (
    <div className="min-h-screen bg-page-gradient pt-16 text-foreground">
      <header className="fixed inset-x-0 top-0 z-50 h-16 border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
        <div className="flex h-full w-full items-center gap-3 px-3 sm:px-4">
          <Link
            to={isAuthenticated ? '/cabinet' : '/auth'}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-transparent text-slate-700 transition-colors hover:bg-slate-100 sm:hidden dark:text-slate-100 dark:hover:bg-slate-900"
            aria-label={isAuthenticated ? 'Профіль' : 'Увійти'}
          >
            {profileAvatar ? (
              <img src={profileAvatar} alt="Профіль" className="h-11 w-11 rounded-full object-cover" />
            ) : (
              <UserCircle2 className="!h-8 !w-8" />
            )}
          </Link>

          <Link to="/" className="flex h-11 shrink-0 items-center rounded-xl transition-transform duration-200 hover:scale-[1.01]" aria-label="DrivePrep">
            <img src="/logo.png" alt="DrivePrep" className="h-11 w-11 rounded-xl object-contain sm:hidden" style={{ imageRendering: 'auto' }} />
            <img src="/logo-wordmark.png" alt="DrivePrep" className="hidden h-11 w-auto max-w-[190px] object-contain sm:block" style={{ imageRendering: 'auto' }} />
          </Link>

          <div className="ml-auto flex items-center gap-0.5 sm:gap-2">
            {isAuthenticated ? (
              <Button
                asChild
                type="button"
                variant="outline"
                size="icon"
                className="h-10 w-10 rounded-full border-transparent bg-transparent text-amber-600 shadow-none hover:bg-amber-50 dark:text-amber-200 dark:hover:bg-amber-950/30 sm:rounded-lg sm:border-amber-200 sm:bg-amber-50 sm:shadow-sm dark:sm:border-amber-500/30 dark:sm:bg-amber-950/25"
              >
                <Link to="/pricing" aria-label="Premium">
                  <Crown className="h-5 w-5" />
                </Link>
              </Button>
            ) : null}

            {isAuthenticated ? (
              <Button
                asChild
                type="button"
                variant="outline"
                size="icon"
                className="relative h-10 w-10 rounded-full border-transparent bg-transparent text-slate-700 shadow-none hover:bg-slate-100 dark:text-slate-100 dark:hover:bg-slate-900 sm:rounded-lg sm:border-slate-200 sm:bg-background sm:shadow-sm dark:sm:border-slate-700"
              >
                <Link to="/friends" aria-label="Повідомлення">
                  <MessageCircleMore className="h-5 w-5" />
                  <Badge value={notificationSummary.friends} />
                </Link>
              </Button>
            ) : null}

            <Button
              asChild
              type="button"
              variant="outline"
              size="icon"
              className="h-10 w-10 rounded-full border-transparent bg-transparent text-slate-700 shadow-none hover:bg-slate-100 dark:text-slate-100 dark:hover:bg-slate-900 sm:rounded-lg sm:border-slate-200 sm:bg-background sm:shadow-sm dark:sm:border-slate-700"
            >
              <Link to="/settings" aria-label="Налаштування">
                <Settings className="h-5 w-5" />
              </Link>
            </Button>

            <Button
              asChild
              type="button"
              variant={isAuthenticated ? 'default' : 'outline'}
              size="icon"
              className="hidden h-10 w-10 rounded-lg sm:inline-flex sm:w-auto sm:px-4 sm:py-2.5"
            >
              <Link to={isAuthenticated ? '/cabinet' : '/auth'}>
                <UserCircle2 className="!h-7 !w-7 sm:mr-2" />
                <span className="hidden sm:inline">{isAuthenticated ? 'Профіль' : 'Увійти'}</span>
              </Link>
            </Button>

            <button
              type="button"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-transparent bg-transparent text-slate-700 transition-colors hover:bg-slate-100 sm:hidden dark:text-slate-100 dark:hover:bg-slate-900"
              onClick={() => setMobileMenuOpen((value) => !value)}
              aria-label={mobileMenuOpen ? 'Закрити меню' : 'Відкрити меню'}
            >
              {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>

        {mobileMenuOpen ? (
          <div className="max-h-[calc(100dvh-64px)] overflow-y-auto border-t border-slate-200/70 bg-white px-3 py-3 shadow-[0_18px_45px_rgba(15,23,42,0.12)] sm:hidden dark:border-slate-800 dark:bg-slate-950">
            <div className="space-y-3">
              {mobileMenuGroups.map((group) => (
                <div key={group.title} className="rounded-xl border border-slate-200 bg-slate-50/80 p-2 dark:border-slate-800 dark:bg-slate-900/70">
                  <div className="flex items-center gap-2 px-2 py-1.5 text-sm font-semibold text-slate-900 dark:text-white">
                    <group.icon className="h-5 w-5 text-primary" />
                    {group.title}
                  </div>
                  <div className="mt-1 grid gap-1">
                    {group.items.map((item) => {
                      const active = location.pathname.startsWith(item.path);
                      const badgeCount = item.badgeKey ? notificationSummary[item.badgeKey] : 0;
                      return (
                        <Link
                          key={item.path}
                          to={item.path}
                          onClick={() => setMobileMenuOpen(false)}
                          className={cn(
                            'relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                            active
                              ? 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-200'
                              : 'text-slate-600 hover:bg-white hover:text-slate-950 dark:text-slate-200 dark:hover:bg-slate-950 dark:hover:text-white',
                          )}
                        >
                          <item.icon className="h-5 w-5 shrink-0" />
                          <span>{item.label}</span>
                          {item.premium && !user?.is_premium ? (
                            <span className="ml-auto rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-700 dark:bg-amber-500/15 dark:text-amber-200">
                              Pro
                            </span>
                          ) : badgeCount ? (
                            <span className="ml-auto inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[11px] font-semibold text-white">
                              {Math.min(badgeCount, 9)}
                            </span>
                          ) : null}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}

              <div className="grid gap-2">
                {isAuthenticated ? (
                  <button
                    type="button"
                    className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-left text-sm font-semibold text-red-600 dark:border-red-500/20 dark:bg-red-950/25 dark:text-red-300"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      logout();
                    }}
                  >
                    <LogOut className="h-5 w-5" />
                    Вийти
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}
      </header>

      <aside className="group/sidebar fixed bottom-0 left-0 top-16 z-40 hidden w-16 overflow-visible border-r border-slate-200 bg-white transition-[width] duration-200 hover:w-36 dark:border-slate-800 dark:bg-slate-950 xl:block">
        <div className="flex h-full flex-col justify-between px-2 py-3">
          <div className="flex w-full flex-col gap-2">
            {desktopMenuGroups.map((group, groupIndex) => {
              const GroupIcon = group.icon;
              const activeGroup = group.items.some((item) => location.pathname.startsWith(item.path));
              const openSection = mobileSection === group.title;
              return (
                <motion.div
                  key={group.title}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: groupIndex * 0.04 }}
                  className="group relative before:absolute before:left-full before:top-0 before:hidden before:h-full before:w-4 before:content-[''] group-hover/sidebar:before:block"
                  onMouseEnter={() => setMobileSection(group.title)}
                  onMouseLeave={() => setMobileSection('')}
                >
                  <button
                    type="button"
                    className={cn(
                      'flex h-11 w-full items-center gap-3 overflow-hidden rounded-lg px-3 text-sm font-medium text-slate-600 transition-colors hover:bg-sky-50 hover:text-slate-950 dark:text-slate-200 dark:hover:bg-slate-900 dark:hover:text-white',
                      activeGroup && 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-200',
                    )}
                    onClick={() => setMobileSection((value) => (value === group.title ? '' : group.title))}
                    aria-label={group.title}
                  >
                    <GroupIcon className="h-6 w-6 shrink-0" />
                    <span className="whitespace-nowrap opacity-0 transition-opacity duration-150 group-hover/sidebar:opacity-100">{group.title}</span>
                  </button>

                  <div
                    className={cn(
                      'absolute left-[132px] top-0 hidden w-[248px] rounded-xl border border-slate-200 bg-white p-2 shadow-[0_18px_45px_rgba(15,23,42,0.14)] dark:border-slate-800 dark:bg-slate-950',
                      'group-hover:block group-focus-within:block',
                      openSection && 'block',
                    )}
                  >
                    <p className="px-3 pb-2 pt-1 text-xs font-medium uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">{group.title}</p>
                    <div className="space-y-1">
                      {group.items.map((item) => {
                        const active = location.pathname.startsWith(item.path);
                        const badgeCount = item.badgeKey ? notificationSummary[item.badgeKey] : 0;
                        return (
                          <Link
                            key={item.path}
                            to={item.path}
                            onClick={() => setMobileSection('')}
                            className={cn(
                              'relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                              active
                                ? 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-200'
                                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-950 dark:text-slate-200 dark:hover:bg-slate-900 dark:hover:text-white',
                            )}
                          >
                            <item.icon className="h-5 w-5 shrink-0" />
                            <span>{item.label}</span>
                            {item.premium && !user?.is_premium ? (
                              <span className="ml-auto rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-700 dark:bg-amber-500/15 dark:text-amber-200">
                                Pro
                              </span>
                            ) : badgeCount ? (
                              <span className="ml-auto inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[11px] font-semibold text-white">
                                {Math.min(badgeCount, 9)}
                              </span>
                            ) : null}
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>

          <div className="flex w-full flex-col gap-2">
            <Link
              to="/support"
              className="relative flex h-11 w-full items-center gap-3 overflow-hidden rounded-lg px-3 text-sm font-medium text-slate-500 transition-colors hover:bg-sky-50 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-900 dark:hover:text-white"
              aria-label="Підтримка"
            >
              <LifeBuoy className="h-6 w-6 shrink-0" />
              <span className="whitespace-nowrap opacity-0 transition-opacity duration-150 group-hover/sidebar:opacity-100">Підтримка</span>
              {notificationSummary.support ? (
                <span className="absolute right-2 top-2 inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[11px] font-semibold text-white">
                  {Math.min(notificationSummary.support, 9)}
                </span>
              ) : null}
            </Link>

            {isAuthenticated ? (
              <button
                type="button"
                className="flex h-11 w-full items-center gap-3 overflow-hidden rounded-lg px-3 text-sm font-medium text-slate-500 transition-colors hover:bg-red-50 hover:text-red-600 dark:text-slate-300 dark:hover:bg-red-950/30 dark:hover:text-red-300"
                onClick={logout}
                aria-label="Вийти"
              >
                <LogOut className="h-6 w-6 shrink-0" />
                <span className="whitespace-nowrap opacity-0 transition-opacity duration-150 group-hover/sidebar:opacity-100">Вийти</span>
              </button>
            ) : null}
          </div>
        </div>
      </aside>

      <div className="w-full px-3 py-5 sm:px-5 sm:py-7 xl:pl-24">
        {showPageHeader ? (
          <div className="mb-5 px-1 py-2 sm:px-2">
            {showBackButton ? <InternalBackButton className="mb-4" /> : null}
            <h1 className="text-2xl font-semibold text-slate-950 dark:text-white sm:text-3xl">
              {pageTitle}
            </h1>
          </div>
        ) : null}

        <main className="app-content">
          <Outlet />
        </main>
      </div>

      <SiteFooter />
    </div>
  );
}

