import { Link } from 'react-router-dom';
import { BookOpenText, Crown, Mail, MessageCircle, ShieldCheck, Trophy } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { hasPremiumAccess } from '@/lib/accessLimits';

const footerLinks = [
  {
    title: 'Навчання',
    icon: BookOpenText,
    links: [
      { to: '/study', label: 'Теорія' },
      { to: '/tests', label: 'Тести' },
      { to: '/tickets', label: 'Білети' },
      { to: '/section-tests', label: 'Практика' },
    ],
  },
  {
    title: 'Сервіс',
    icon: ShieldCheck,
    links: [
      { to: '/support', label: 'Підтримка', auth: true },
      { to: '/leaderboard', label: 'Рейтинг' },
      { to: '/privacy', label: 'Конфіденційність' },
      { to: '/terms', label: 'Угода підписника' },
    ],
  },
];

export default function SiteFooter() {
  const { isAuthenticated, user } = useAuth();
  const premiumAccess = hasPremiumAccess(user);

  const getLinkTarget = (link) => {
    if (link.auth && !isAuthenticated) {
      return `/auth?tab=login&redirect=${encodeURIComponent(link.to)}`;
    }
    return link.to;
  };

  const scrollTop = () => window.scrollTo({ top: 0, behavior: 'auto' });

  return (
    <footer className="mt-8 border-t border-slate-200 bg-white text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[1fr_auto] lg:px-8">
        <div className="space-y-4">
          <Link to="/" onClick={scrollTop} className="inline-flex items-center gap-3">
            <img src="/logo.png" alt="DrivePrep" className="h-10 w-10 rounded-xl object-contain shadow-sm" />
            <div>
              <p className="text-base font-semibold text-slate-950 dark:text-white">DrivePrep</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">Підготовка до теоретичного іспиту ПДР</p>
            </div>
          </Link>

          <div className="flex flex-wrap gap-2 text-sm">
            {!premiumAccess ? (
              <Link
                to="/pricing"
                onClick={scrollTop}
                className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-2 font-medium text-amber-700 ring-1 ring-amber-200 transition hover:bg-amber-100 dark:bg-amber-500/10 dark:text-amber-200 dark:ring-amber-500/20"
              >
                <Crown className="h-4 w-4" />
                Premium
              </Link>
            ) : null}
            <Link
              to={isAuthenticated ? '/support' : '/auth?tab=login&redirect=%2Fsupport'}
              onClick={scrollTop}
              className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-2 font-medium text-slate-700 transition hover:bg-slate-200 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <MessageCircle className="h-4 w-4" />
              Підтримка
            </Link>
            <Link
              to="/leaderboard"
              onClick={scrollTop}
              className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-2 font-medium text-slate-700 transition hover:bg-slate-200 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <Trophy className="h-4 w-4" />
              Рейтинг
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-5 sm:min-w-[360px]">
          {footerLinks.map((group) => {
            const Icon = group.icon;
            return (
              <div key={group.title}>
                <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-950 dark:text-white">
                  <Icon className="h-4 w-4 text-blue-500" />
                  {group.title}
                </p>
                <ul className="space-y-1.5">
                  {group.links.map((link) => (
                    <li key={`${group.title}-${link.to}`}>
                      <Link
                        to={getLinkTarget(link)}
                        onClick={scrollTop}
                        className="text-sm text-slate-500 transition hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-300"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </div>

      <div className="border-t border-slate-200 px-4 py-3 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-500">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <span>© 2026 DrivePrep. Навчайтесь у своєму темпі.</span>
          <a href="mailto:pdr.preparation@gmail.com" className="inline-flex items-center gap-2 transition hover:text-blue-600 dark:hover:text-blue-300">
            <Mail className="h-3.5 w-3.5" />
            pdr.preparation@gmail.com
          </a>
        </div>
      </div>
    </footer>
  );
}
