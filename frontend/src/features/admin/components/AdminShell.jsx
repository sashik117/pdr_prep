// @ts-nocheck
import { NavLink, Link } from 'react-router-dom';
import {
  BarChart3,
  BookOpenText,
  Crown,
  FileQuestion,
  Home,
  LogOut,
  MessageCircleMore,
  Shield,
  Users,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

const navigation = [
  { to: '/admin', label: 'Огляд', icon: BarChart3, end: true },
  { to: '/admin/users', label: 'Користувачі', icon: Users },
  { to: '/admin/theory', label: 'Теорія ПДР', icon: BookOpenText },
  { to: '/admin/questions', label: 'Питання', icon: FileQuestion },
  { to: '/admin/premium', label: 'Premium', icon: Crown },
  { to: '/admin/support', label: 'Підтримка', icon: MessageCircleMore },
];

export default function AdminShell({ children, admin, onLogout }) {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-950 dark:bg-slate-950 dark:text-white">
      <div className="fixed inset-x-0 top-0 z-40 border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
        <div className="flex h-16 items-center gap-3 px-4 lg:px-6">
          <Link to="/admin" className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm">
              <Shield className="h-5 w-5" />
            </span>
            <span className="hidden sm:block">
              <span className="block text-sm font-semibold leading-tight">DrivePrep Admin</span>
              <span className="block text-xs text-slate-500 dark:text-slate-400">Керування сайтом</span>
            </span>
          </Link>

          <div className="ml-auto flex items-center gap-2">
            <Button asChild variant="ghost" size="sm" className="hidden rounded-lg text-slate-600 hover:text-slate-950 dark:text-slate-300 dark:hover:text-white sm:inline-flex">
              <Link to="/">
                <Home className="mr-2 h-4 w-4" />
                На сайт
              </Link>
            </Button>
            <div className="hidden min-w-0 text-right md:block">
              <p className="truncate text-sm font-medium">{admin?.full_name || admin?.username || 'Адміністратор'}</p>
              <p className="truncate text-xs text-slate-500 dark:text-slate-400">@{admin?.username || 'admin'}</p>
            </div>
            <Button variant="outline" size="sm" className="rounded-lg dark:border-slate-700" onClick={onLogout}>
              <LogOut className="mr-2 h-4 w-4" />
              Вийти
            </Button>
          </div>
        </div>
      </div>

      <aside className="fixed bottom-0 left-0 top-16 z-30 hidden w-64 border-r border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950 lg:block">
        <nav className="space-y-1">
          {navigation.map((item) => (
            <AdminNavLink key={item.to} item={item} />
          ))}
        </nav>

        <div className="absolute bottom-4 left-4 right-4 rounded-xl border border-blue-100 bg-blue-50 p-4 dark:border-blue-500/20 dark:bg-blue-950/20">
          <p className="text-sm font-semibold text-slate-950 dark:text-white">Захищена зона</p>
          <p className="mt-1 text-xs leading-5 text-slate-600 dark:text-slate-300">
            Тут змінюємо лише службові дані продукту: користувачів, контент, Premium та підтримку.
          </p>
        </div>
      </aside>

      <div className="fixed inset-x-0 top-16 z-30 border-b border-slate-200 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-950 lg:hidden">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {navigation.map((item) => (
            <AdminNavLink key={item.to} item={item} compact />
          ))}
        </div>
      </div>

      <main className="px-4 pb-8 pt-32 sm:px-5 lg:pl-[17.5rem] lg:pr-6 lg:pt-24">
        {children}
      </main>
    </div>
  );
}

function AdminNavLink({ item, compact = false }) {
  const Icon = item.icon;
  return (
    <NavLink
      to={item.to}
      end={item.end}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-3 rounded-lg text-sm font-medium transition-colors',
          compact ? 'h-10 shrink-0 px-3' : 'h-11 px-3',
          isActive
            ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/20'
            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-900 dark:hover:text-white',
        )
      }
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="whitespace-nowrap">{item.label}</span>
    </NavLink>
  );
}
