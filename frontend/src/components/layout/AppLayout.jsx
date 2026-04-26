import { Link, Outlet, useLocation } from 'react-router-dom';
import { Menu, X, ClipboardCheck, UserCircle2, BookMarked, Trophy, Flame, Swords, BarChart3, Settings, MessageCircleMore, Wifi, WifiOff } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/lib/AuthContext';
import InternalBackButton from '@/components/layout/InternalBackButton';
import api, { resolveApiUrl, resolveWsUrl, tokenStore } from '@/api/apiClient';
import { getPendingTestResults, removePendingTestResult } from '@/lib/offlineProgress';

const primaryNavItems = [
  { path: '/tests', label: 'Тести', icon: ClipboardCheck },
  { path: '/signs', label: 'Знаки', icon: BookMarked },
  { path: '/marathon', label: 'Марафон', icon: Flame },
  { path: '/leaderboard', label: 'Рейтинг', icon: Trophy },
  { path: '/battle', label: 'Батли', icon: Swords, badgeKey: 'battles' },
  { path: '/analytics', label: 'Аналітика', icon: BarChart3 },
];

/** @type {Record<string, string>} */
const pageTitles = {
  '/tests': 'Тести',
  '/test': 'Проходження тесту',
  '/daily': 'Виклик дня',
  '/signs': 'Дорожні знаки',
  '/study': 'Бібліотека',
  '/mistakes': 'Помилки',
  '/marathon': 'Марафон',
  '/analytics': 'Аналітика',
  '/leaderboard': 'Рейтинг',
  '/friends': 'Друзі',
  '/battle': 'Батли',
  '/cabinet': 'Профіль',
  '/u/': 'Профіль користувача',
  '/privacy': 'Конфіденційність',
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
  const directMatch = Object.entries(pageTitles).find(([path]) => pathname.startsWith(path));
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
    <span className="absolute -right-1 -top-1 inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[11px] font-black text-white">
      {Math.min(value, 9)}
    </span>
  );
}

export default function AppLayout() {
  const location = useLocation();
  const queryClient = useQueryClient();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isOnline, setIsOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);
  const networkBootRef = useRef(true);
  const previousOnlineRef = useRef(/** @type {boolean | null} */ (null));
  const { isAuthenticated, navigateToLogin, user } = useAuth();
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

  const pageTitle = useMemo(() => {
    if (location.pathname === '/cabinet' && isAdminUser) {
      return 'Панель керування';
    }
    return resolveTitle(location.pathname);
  }, [isAdminUser, location.pathname]);

  const showBackButton = useMemo(() => shouldShowBackButton(location.pathname), [location.pathname]);
  const showPageHeader = location.pathname !== '/' && !!pageTitle;

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') || 'system';
    const savedFontSize = parseInt(localStorage.getItem('fontSize') || '16', 10);
    const isDark = savedTheme === 'dark' || (savedTheme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.classList.toggle('dark', isDark);
    document.documentElement.style.fontSize = `${savedFontSize}px`;
  }, []);

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
      try {
        const response = await fetch(resolveApiUrl('/health'), {
          method: 'GET',
          cache: 'no-store',
        });
        const nextOnline = response.ok;
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
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(96,165,250,0.18),_transparent_38%),linear-gradient(180deg,#f8fbff_0%,#eef5ff_52%,#f8fbff_100%)] text-foreground dark:bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.2),_transparent_38%),linear-gradient(180deg,#071120_0%,#0b1730_52%,#071120_100%)]">
      <header className="sticky top-0 z-50 border-b border-sky-100/90 bg-white/92 shadow-[0_16px_45px_rgba(15,23,42,0.08)] backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/88">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-5 sm:px-6 lg:gap-6 lg:py-6">
          <Link to="/" className="shrink-0 transition-transform duration-200 hover:scale-[1.01]">
            <img
              src="/logo-wordmark.png"
              alt="PDRPrep"
              className="h-12 w-auto object-contain sm:h-14 lg:h-16"
              style={{ imageRendering: 'auto' }}
            />
          </Link>

          <nav className="hidden min-w-0 flex-1 items-center justify-center gap-2 lg:flex">
            {primaryNavItems.map((item) => {
              const active = location.pathname.startsWith(item.path);
              const badgeCount = item.badgeKey ? notificationSummary[item.badgeKey] : 0;
              return (
                <motion.div key={item.path} whileHover={{ y: -2 }} whileTap={{ scale: 0.99 }}>
                  <Link
                    to={item.path}
                    className={cn(
                      'relative inline-flex items-center rounded-2xl px-5 py-3 text-sm font-bold transition-all duration-200',
                      active
                        ? 'bg-primary text-primary-foreground shadow-[0_18px_34px_rgba(20,107,255,0.25)]'
                        : 'text-slate-600 hover:bg-sky-50 hover:text-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:text-white',
                    )}
                  >
                    {item.label}
                    <Badge value={badgeCount} />
                  </Link>
                </motion.div>
              );
            })}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <div className={cn(
              'inline-flex h-12 min-w-12 items-center justify-center rounded-2xl border px-3',
              isOnline
                ? 'border-emerald-200 bg-emerald-50 text-emerald-600 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300'
                : 'border-rose-200 bg-rose-50 text-rose-600 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300',
            )} title={isOnline ? 'Онлайн: прогрес синхронізується' : 'Офлайн: прогрес збережеться локально'}>
              {isOnline ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
            </div>

            {isAuthenticated ? (
              <Button
                asChild
                type="button"
                variant="outline"
                size="icon"
                className="relative hidden h-12 w-12 rounded-2xl border-slate-200 bg-white text-slate-700 shadow-none sm:inline-flex dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              >
                <Link to="/friends" aria-label="Повідомлення">
                  <MessageCircleMore className="h-4 w-4" />
                  <Badge value={notificationSummary.friends} />
                </Link>
              </Button>
            ) : null}

            {isAuthenticated ? (
              <Button
                asChild
                type="button"
                variant="outline"
                size="icon"
                className="hidden h-12 w-12 rounded-2xl border-slate-200 bg-white text-slate-700 shadow-none sm:inline-flex dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              >
                <Link to="/settings" aria-label="Налаштування">
                  <Settings className="h-4 w-4" />
                </Link>
              </Button>
            ) : null}

            <Button
              type="button"
              variant={isAuthenticated ? 'default' : 'outline'}
              className="hidden rounded-2xl px-5 py-3 text-sm font-bold shadow-none sm:inline-flex"
              onClick={() => {
                if (isAuthenticated) {
                  window.location.href = '/cabinet';
                } else {
                  navigateToLogin('/cabinet');
                }
              }}
            >
              <UserCircle2 className="mr-2 h-4 w-4" />
              {isAuthenticated ? 'Профіль' : 'Увійти'}
            </Button>

            <button
              type="button"
              className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 transition-colors hover:bg-slate-50 lg:hidden dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
              onClick={() => setMobileOpen((value) => !value)}
              aria-label="Відкрити меню"
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {mobileOpen ? (
          <div className="border-t border-slate-200 bg-white px-4 py-4 lg:hidden dark:border-slate-800 dark:bg-slate-950">
            <div className="grid gap-2">
              {primaryNavItems.map((item) => {
                const active = location.pathname.startsWith(item.path);
                const badgeCount = item.badgeKey ? notificationSummary[item.badgeKey] : 0;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      'relative flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold transition-colors',
                      active ? 'bg-primary text-primary-foreground' : 'bg-slate-50 text-slate-700 hover:bg-slate-100 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800',
                    )}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.label}
                    {badgeCount ? (
                      <span className="ml-auto inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[11px] font-black text-white">
                        {Math.min(badgeCount, 9)}
                      </span>
                    ) : null}
                  </Link>
                );
              })}

              {isAuthenticated ? (
                <Link
                  to="/friends"
                  onClick={() => setMobileOpen(false)}
                  className="relative flex items-center justify-center gap-3 rounded-2xl bg-slate-50 px-4 py-3 text-center text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
                >
                  <MessageCircleMore className="h-4 w-4" />
                  Повідомлення
                  {notificationSummary.friends ? (
                    <span className="ml-auto inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[11px] font-black text-white">
                      {Math.min(notificationSummary.friends, 9)}
                    </span>
                  ) : null}
                </Link>
              ) : null}

              {isAuthenticated ? (
                <Button asChild type="button" variant="outline" className="rounded-2xl">
                  <Link to="/settings" onClick={() => setMobileOpen(false)}>
                    <Settings className="mr-2 h-4 w-4" />
                    Налаштування
                  </Link>
                </Button>
              ) : null}

              <Button
                type="button"
                className="rounded-2xl"
                onClick={() => {
                  setMobileOpen(false);
                  if (isAuthenticated) {
                    window.location.href = '/cabinet';
                  } else {
                    navigateToLogin('/cabinet');
                  }
                }}
              >
                <UserCircle2 className="mr-2 h-4 w-4" />
                {isAuthenticated ? 'Профіль' : 'Увійти'}
              </Button>
            </div>
          </div>
        ) : null}
      </header>

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
        {showPageHeader ? (
          <div className="mb-6 rounded-[28px] border border-white/85 bg-white/92 px-6 py-5 shadow-[0_18px_45px_rgba(15,23,42,0.05)] dark:border-slate-800 dark:bg-slate-950/80">
            {showBackButton ? <InternalBackButton className="mb-4" /> : null}
            <h1 className="text-3xl font-black tracking-[-0.04em] text-slate-950 dark:text-white sm:text-4xl">
              {pageTitle}
            </h1>
          </div>
        ) : null}

        <main>
          <Outlet />
        </main>
      </div>
    </div>
  );
}

