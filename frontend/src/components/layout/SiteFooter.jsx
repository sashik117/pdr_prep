import { Link } from 'react-router-dom';
import { BarChart3, BookOpenText, Crown, Mail, MessageCircle, ShieldCheck, Sparkles, Trophy } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { hasPremiumAccess, shouldShowPremiumOffers } from '@/lib/accessLimits';

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
    title: 'Кабінет',
    icon: BarChart3,
    links: [
      { to: '/cabinet', label: 'Кабінет', auth: true },
      { to: '/analytics', label: 'Аналітика', auth: true },
      { to: '/saved-questions', label: 'Збережені', auth: true },
      { to: '/achievements', label: 'Досягнення', auth: true },
    ],
  },
  {
    title: 'Спільнота',
    icon: Trophy,
    links: [
      { to: '/friends', label: 'Друзі', auth: true },
      { to: '/battle', label: 'Батли', auth: true },
      { to: '/leaderboard', label: 'Рейтинг' },
      { to: '/support', label: 'Підтримка', auth: true },
    ],
  },
  {
    title: 'Правила',
    icon: ShieldCheck,
    links: [
      { to: '/privacy', label: 'Конфіденційність' },
      { to: '/terms', label: 'Угода підписника' },
    ],
  },
];

export default function SiteFooter() {
  const { isAuthenticated, user } = useAuth();
  const premiumAccess = hasPremiumAccess(user);
  const showPremiumOffers = shouldShowPremiumOffers(user);

  const getLinkTarget = (link) => {
    if (link.auth && !isAuthenticated) {
      return `/auth?tab=login&redirect=${encodeURIComponent(link.to)}`;
    }
    return link.to;
  };

  const scrollTop = () => window.scrollTo({ top: 0, behavior: 'auto' });

  return (
    <footer className="mt-10 overflow-hidden bg-gradient-to-br from-blue-700 via-indigo-700 to-slate-950 text-white">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[1.05fr_1.7fr] lg:px-8">
        <div className="space-y-5">
          <Link to="/" onClick={scrollTop} className="inline-flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/12 ring-1 ring-white/20">
              <img src="/logo.png" alt="DrivePrep" className="h-9 w-9 object-contain" />
            </span>
            <div>
              <p className="text-lg font-semibold">DrivePrep</p>
              <p className="text-sm text-blue-100">Спокійна підготовка до теоретичного іспиту ПДР.</p>
            </div>
          </Link>

          <div className="flex flex-wrap gap-2 text-sm">
            {showPremiumOffers ? (
            <Link
              to="/pricing"
              onClick={scrollTop}
              className="inline-flex items-center gap-2 rounded-full bg-amber-400 px-3 py-2 font-semibold text-slate-950 transition hover:bg-amber-300"
            >
              <Crown className="h-4 w-4" />
              {premiumAccess ? 'Premium активний' : 'Premium'}
            </Link>
            ) : null}
            <Link
              to={isAuthenticated ? '/support' : '/auth?tab=login&redirect=%2Fsupport'}
              onClick={scrollTop}
              className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-2 font-medium text-white ring-1 ring-white/15 transition hover:bg-white/15"
            >
              <MessageCircle className="h-4 w-4" />
              Підтримка
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-5 sm:grid-cols-4">
          {footerLinks.map((group) => {
            const Icon = group.icon;
            return (
              <div key={group.title}>
                <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-white">
                  <Icon className="h-4 w-4 text-blue-200" />
                  {group.title}
                </p>
                <ul className="space-y-1.5">
                  {group.links.map((link) => (
                    <li key={`${group.title}-${link.to}`}>
                      <Link
                        to={getLinkTarget(link)}
                        onClick={scrollTop}
                        className="text-sm text-blue-100/85 transition hover:text-white"
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

      <div className="border-t border-white/10 px-4 py-3 text-xs text-blue-100/80">
        <div className="mx-auto flex max-w-7xl flex-col items-center gap-2 text-center sm:flex-row sm:items-center sm:justify-between sm:text-left">
          <span className="inline-flex items-center justify-center gap-2">
            <Sparkles className="h-3.5 w-3.5" />
            © 2026 DrivePrep. Вчіться у своєму темпі.
          </span>
          <a href="mailto:pdr.preparation@gmail.com" className="inline-flex items-center justify-center gap-2 transition hover:text-white">
            <Mail className="h-3.5 w-3.5" />
            pdr.preparation@gmail.com
          </a>
        </div>
      </div>
    </footer>
  );
}
