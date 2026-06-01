import { Link, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  BookOpen,
  ClipboardList,
  CreditCard,
  LayoutDashboard,
  Layers,
  LineChart,
  LogOut,
  Menu,
  MessageCircleMore,
  MessageSquareText,
  Settings,
  User,
  X,
} from 'lucide-react';
import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { resolveApiUrl } from '@/api/apiClient';

const navItems = [
  { path: '/cabinet', label: 'Кабінет', icon: LayoutDashboard, auth: true },
  { path: '/study', label: 'Теорія', icon: BookOpen },
  { path: '/section-tests', label: 'Практика', icon: Layers },
  { path: '/tickets', label: 'Білети', icon: ClipboardList },
  { path: '/tests', label: 'Тести', icon: MessageSquareText },
  { path: '/analytics', label: 'Аналітика', icon: LineChart, auth: true },
  { path: '/pricing', label: 'Тарифи', icon: CreditCard },
];

function Badge({ value }) {
  if (!value) return null;
  return (
    <span className="absolute -right-1 -top-1 inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[11px] font-semibold text-white">
      {Math.min(value, 9)}
    </span>
  );
}

export default function Header({ isOpen, setIsOpen, isAuthenticated, user, notificationSummary, onLogout }) {
  const location = useLocation();

  const visibleNavItems = useMemo(
    () =>
      navItems.filter((item) => {
        if (item.path === '/pricing' && isAuthenticated && user?.is_premium) return false;
        if (item.auth && !isAuthenticated) return false;
        return true;
      }),
    [isAuthenticated, user?.is_premium],
  );

  const isItemActive = (path) => {
    if (path === '/cabinet') return location.pathname === '/cabinet' || location.pathname === '/progress';
    if (path === '/tests') return location.pathname === '/tests' || location.pathname === '/test';
    return location.pathname.startsWith(path);
  };

  return (
    <nav className="sticky top-0 z-40 border-b border-gray-100 bg-white/90 shadow-sm backdrop-blur-md dark:border-slate-800 dark:bg-slate-950/90">
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <div className="flex min-w-0 items-center gap-2 lg:hidden">
            <Link
              to={isAuthenticated ? '/profile' : '/auth?tab=login'}
              className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white text-slate-600 shadow-sm ring-1 ring-slate-200 transition hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-200 dark:ring-slate-800"
              aria-label="Профіль"
            >
              {isAuthenticated && user?.avatar_url ? (
                <img src={resolveApiUrl(user.avatar_url) || user.avatar_url} alt="Профіль" width={96} height={96} decoding="async" className="h-full w-full object-cover [backface-visibility:hidden]" />
              ) : (
                <User className="h-6 w-6" />
              )}
            </Link>
            <Link to="/" className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl">
              <img src="/logo.png" alt="DrivePrep" width={128} height={128} decoding="async" className="h-[46px] w-[46px] object-contain [backface-visibility:hidden]" />
            </Link>
          </div>

          <Link to="/" className="group hidden shrink-0 items-center lg:flex">
            <img src="/logo-wordmark.png" alt="DrivePrep" className="h-12 w-auto object-contain" />
          </Link>

          <div className="hidden items-center gap-0.5 lg:flex">
            {visibleNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = isItemActive(item.path);
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={cn(
                    'relative flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200',
                    isActive
                      ? 'bg-primary-50 text-primary-700 dark:bg-primary-500/10 dark:text-primary-200'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-slate-300 dark:hover:bg-slate-900 dark:hover:text-white',
                  )}
                >
                  <Icon className={cn('h-4 w-4', isActive ? 'text-primary-600 dark:text-primary-300' : 'text-gray-400')} />
                  {item.label}
                  {isActive ? (
                    <motion.div
                      layoutId="nav-indicator"
                      className="absolute -bottom-[13px] left-2 right-2 h-0.5 rounded-full bg-primary-600"
                      transition={{ type: 'spring', bounce: 0.2, duration: 0.4 }}
                    />
                  ) : null}
                </Link>
              );
            })}
          </div>

          <div className="hidden shrink-0 items-center gap-4 lg:flex">
            {isAuthenticated ? (
              <div className="flex items-center gap-3">
                <Link
                  to="/friends"
                  className="relative flex h-10 w-10 items-center justify-center rounded-full bg-gray-50 text-gray-500 transition-colors hover:bg-primary-50 hover:text-primary-600 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-primary-500/10 dark:hover:text-primary-200"
                  aria-label="Повідомлення"
                >
                  <MessageCircleMore className="h-5 w-5" />
                  <Badge value={notificationSummary.friends} />
                </Link>
                <Link
                  to="/settings"
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-50 text-gray-500 transition-colors hover:bg-primary-50 hover:text-primary-600 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-primary-500/10 dark:hover:text-primary-200"
                  aria-label="Налаштування"
                >
                  <Settings className="h-5 w-5" />
                </Link>
                <Link
                  to="/profile"
                  className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-gray-50 text-gray-500 transition-colors hover:bg-primary-50 hover:text-primary-600 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-primary-500/10 dark:hover:text-primary-200"
                  aria-label="Профіль"
                >
                  {user?.avatar_url ? (
                    <img src={resolveApiUrl(user.avatar_url) || user.avatar_url} alt="Профіль" width={96} height={96} decoding="async" className="h-full w-full object-cover [backface-visibility:hidden]" />
                  ) : (
                    <User className="h-5 w-5 text-gray-500" />
                  )}
                </Link>
                <Button variant="ghost" size="sm" onClick={onLogout} className="text-gray-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30 dark:hover:text-red-300">
                  <LogOut className="mr-1.5 h-4 w-4" />
                  Вийти
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <Link to="/auth?tab=login">
                  <Button variant="ghost" size="sm" className="font-semibold text-gray-700 hover:bg-primary-50 hover:text-primary-600 dark:text-slate-200 dark:hover:bg-primary-500/10">
                    Вхід
                  </Button>
                </Link>
                <Link to="/auth?tab=register">
                  <Button size="sm" className="shadow-lg shadow-primary-500/20 transition-shadow hover:shadow-primary-500/30">
                    Реєстрація
                  </Button>
                </Link>
              </div>
            )}
          </div>

          <div className="flex items-center gap-1.5 lg:hidden">
            <Link
              to="/settings"
              className="flex h-10 w-10 items-center justify-center rounded-full text-slate-600 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-900"
              aria-label="Налаштування"
            >
              <Settings className="h-5 w-5" />
            </Link>
            <button
              type="button"
              className="flex h-10 w-10 items-center justify-center rounded-full text-slate-600 transition hover:bg-slate-100 active:bg-slate-200 dark:text-slate-200 dark:hover:bg-slate-900"
              onClick={() => setIsOpen((value) => !value)}
              aria-label={isOpen ? 'Закрити меню' : 'Відкрити меню'}
            >
              {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {isOpen ? (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden border-t border-gray-100 bg-white dark:border-slate-800 dark:bg-slate-950 lg:hidden"
          >
            <div className="space-y-1 px-4 py-4">
              {visibleNavItems.map((item) => {
                const Icon = item.icon;
                const isActive = isItemActive(item.path);
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setIsOpen(false)}
                    className={cn(
                      'flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-primary-50 text-primary-700 dark:bg-primary-500/10 dark:text-primary-200'
                        : 'text-gray-600 hover:bg-gray-50 dark:text-slate-300 dark:hover:bg-slate-900',
                    )}
                  >
                    <Icon className={cn('h-5 w-5', isActive ? 'text-primary-600 dark:text-primary-300' : 'text-gray-400')} />
                    {item.label}
                  </Link>
                );
              })}

              <div className="mt-2 border-t border-gray-100 pt-4 dark:border-slate-800">
                {isAuthenticated ? (
                  <div className="space-y-3">
                    <Link
                      to="/friends"
                      onClick={() => setIsOpen(false)}
                      className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 dark:text-slate-300 dark:hover:bg-slate-900"
                    >
                      <MessageCircleMore className="h-5 w-5 text-gray-400" />
                      Друзі
                    </Link>
                    <Link
                      to="/settings"
                      onClick={() => setIsOpen(false)}
                      className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 dark:text-slate-300 dark:hover:bg-slate-900"
                    >
                      <Settings className="h-5 w-5 text-gray-400" />
                      Налаштування
                    </Link>
                    <Link
                      to="/profile"
                      onClick={() => setIsOpen(false)}
                      className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 dark:text-slate-300 dark:hover:bg-slate-900"
                    >
                      <span className="inline-flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-gray-50 text-gray-500 dark:bg-slate-900 dark:text-slate-200">
                        {user?.avatar_url ? (
                          <img src={resolveApiUrl(user.avatar_url) || user.avatar_url} alt="Профіль" width={96} height={96} decoding="async" className="h-full w-full object-cover [backface-visibility:hidden]" />
                        ) : (
                          <User className="h-5 w-5 text-gray-500" />
                        )}
                      </span>
                      Профіль
                    </Link>
                    <button
                      type="button"
                      onClick={onLogout}
                      className="flex w-full items-center gap-3 rounded-xl px-6 py-3 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-950/30"
                    >
                      <LogOut className="h-5 w-5" />
                      Вийти
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3 px-2">
                    <Link to="/auth?tab=login" onClick={() => setIsOpen(false)} className="block w-full">
                      <Button variant="outline" className="w-full justify-center">Вхід</Button>
                    </Link>
                    <Link to="/auth?tab=register" onClick={() => setIsOpen(false)} className="block w-full">
                      <Button className="w-full justify-center shadow-lg shadow-primary-500/20">Реєстрація</Button>
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </nav>
  );
}
