import { Outlet, useLocation } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/lib/AuthContext';
import Header from '@/components/layout/Header';
import SiteFooter from '@/components/layout/SiteFooter';
import api, { resolveApiUrl, resolveWsUrl, tokenStore } from '@/api/apiClient';
import { getPendingTestResults, removePendingTestResult } from '@/lib/offlineProgress';
import { applyTheme, getStoredTheme } from '@/lib/theme';


export default function AppLayout() {
  const location = useLocation();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [isOnline, setIsOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);
  const networkBootRef = useRef(true);
  const previousOnlineRef = useRef(/** @type {boolean | null} */ (null));
  const { isAuthenticated, user, logout, checkUserAuth, applyRealtimeUser } = useAuth();
  const { toast } = useToast();

  const notificationsQuery = useQuery({
    queryKey: ['notification-summary'],
    queryFn: () => api.getNotificationSummary(),
    enabled: isAuthenticated,
    staleTime: 20_000,
    refetchInterval: 20_000,
  });

  const notificationSummary = notificationsQuery.data || { friends: 0, battles: 0, support: 0 };

  const handleLogout = () => {
    setIsOpen(false);
    logout();
  };

  useEffect(() => {
    const savedFontSize = parseInt(localStorage.getItem('fontSize') || '16', 10);
    applyTheme(getStoredTheme());
    document.documentElement.style.fontSize = `${savedFontSize}px`;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const handleTheme = () => applyTheme(getStoredTheme());
    const handleStorage = (event) => {
      if (!event.key || event.key === 'theme') handleTheme();
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
    setIsOpen(false);
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
      await Promise.allSettled([
        queryClient.invalidateQueries({ queryKey: ['cabinet-stats'] }),
        queryClient.invalidateQueries({ queryKey: ['cabinet-results'] }),
        queryClient.invalidateQueries({ queryKey: ['analytics-stats'] }),
        queryClient.invalidateQueries({ queryKey: ['analytics-results'] }),
        queryClient.invalidateQueries({ queryKey: ['section-tests-stats'] }),
        queryClient.invalidateQueries({ queryKey: ['section-tests-results'] }),
        queryClient.invalidateQueries({ queryKey: ['marathon-stats'] }),
        queryClient.invalidateQueries({ queryKey: ['mistakes-stats'] }),
        queryClient.invalidateQueries({ queryKey: ['achievements'] }),
      ]);
    };

    const checkServerConnection = async () => {
      const healthUrl = resolveApiUrl('/api/health');
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        setIsOnline(false);
        if (!networkBootRef.current && previousOnlineRef.current !== false) {
          toast({
            title: 'З’єднання втрачено',
            description: 'Ви можете продовжити, а ми синхронізуємо прогрес після відновлення.',
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
        const healthResponse = await fetch(healthUrl, { method: 'GET', cache: 'no-store' });
        const nextOnline = healthResponse.ok;
        setIsOnline(nextOnline);
        if (nextOnline && isAuthenticated) {
          void checkUserAuth();
        }

        if (!networkBootRef.current && previousOnlineRef.current !== null && previousOnlineRef.current !== nextOnline) {
          if (nextOnline) {
            toast({ title: 'З’єднання відновлено', description: 'Дані синхронізуються.' });
            void syncPendingResults();
          } else {
            toast({
              title: 'З’єднання втрачено',
              description: 'Ви можете продовжити, а ми синхронізуємо прогрес після відновлення.',
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
            description: 'Ви можете продовжити, а ми синхронізуємо прогрес після відновлення.',
            variant: 'destructive',
          });
        }
        previousOnlineRef.current = false;
      }
    };

    const handleOnline = () => void checkServerConnection();
    const handleOffline = () => {
      setIsOnline(false);
      if (!networkBootRef.current && previousOnlineRef.current !== false) {
        toast({
          title: 'З’єднання втрачено',
          description: 'Ви можете продовжити, а ми синхронізуємо прогрес після відновлення.',
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
    if (isAuthenticated) {
      void syncPendingResults();
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.clearInterval(interval);
    };
  }, [checkUserAuth, isAuthenticated, queryClient, toast]);

  useEffect(() => {
    if (!isAuthenticated) return undefined;
    const token = tokenStore.get();
    if (!token) return undefined;

    const socket = new WebSocket(resolveWsUrl(`/ws?token=${encodeURIComponent(token)}`));
    socket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        const eventType = String(message?.event || '');
        if (eventType === 'user_updated') {
          if (message?.user) {
            applyRealtimeUser(message.user);
          }
          void checkUserAuth();
          queryClient.invalidateQueries();
          return;
        }
        if (eventType === 'premium_settings_updated') {
          void checkUserAuth();
          queryClient.invalidateQueries();
          return;
        }
        if (eventType === 'account_deleted') {
          logout();
          return;
        }
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

    return () => socket.close();
  }, [applyRealtimeUser, checkUserAuth, isAuthenticated, logout, queryClient]);

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 dark:bg-slate-950 dark:text-slate-50">
      <Header
        isOpen={isOpen}
        setIsOpen={setIsOpen}
        isAuthenticated={isAuthenticated}
        user={user}
        notificationSummary={notificationSummary}
        onLogout={handleLogout}
      />
      {!isOnline ? (
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-sm font-medium text-amber-700 dark:border-amber-500/20 dark:bg-amber-950/30 dark:text-amber-200">
          З’єднання нестабільне. Ви можете продовжувати, а ми синхронізуємо дані після відновлення.
        </div>
      ) : null}

      <main className="app-content min-h-[calc(100vh-4rem)] flex-1 overflow-x-hidden bg-gray-50 dark:bg-slate-950">
        <Outlet />
      </main>

      <SiteFooter />
    </div>
  );
}
