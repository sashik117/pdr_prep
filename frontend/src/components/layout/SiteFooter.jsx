import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BookOpenText,
  ClipboardList,
  Crown,
  Mail,
  MessageCircle,
  ShieldCheck,
  Trophy,
  UserRound,
  UsersRound,
} from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';

const footerGroups = [
  {
    title: 'Навчання',
    icon: BookOpenText,
    links: [
      { to: '/study', label: 'Бібліотека теорії' },
      { to: '/study/rules', label: 'Правила дорожнього руху' },
      { to: '/signs', label: 'Дорожні знаки' },
      { to: '/study/road-markings', label: 'Дорожня розмітка' },
      { to: '/study/video-lectures', label: 'Відеолекції' },
    ],
  },
  {
    title: 'Практика',
    icon: ClipboardList,
    links: [
      { to: '/tests', label: 'Офіційні тести' },
      { to: '/section-tests', label: 'Тести по розділах' },
      { to: '/tickets', label: 'Офіційні білети' },
      { to: '/mistakes', label: 'Топ помилок багатьох', auth: true },
      { to: '/saved-questions', label: 'Збережені питання', auth: true },
    ],
  },
  {
    title: 'Кабінет',
    icon: UserRound,
    links: [
      { to: '/cabinet', label: 'Кабінет', auth: true },
      { to: '/profile', label: 'Профіль', auth: true },
      { to: '/analytics', label: 'Аналітика', auth: true },
      { to: '/achievements', label: 'Досягнення', auth: true },
      { to: '/settings', label: 'Налаштування' },
    ],
  },
  {
    title: 'Спільнота',
    icon: UsersRound,
    links: [
      { to: '/friends', label: 'Друзі', auth: true },
      { to: '/battle', label: 'Батли', auth: true },
      { to: '/marathon', label: 'Марафон', auth: true },
      { to: '/leaderboard', label: 'Рейтинг' },
      { to: '/support', label: 'Підтримка', auth: true },
    ],
  },
  {
    title: 'Сервіс',
    icon: ShieldCheck,
    links: [
      { to: '/pricing', label: 'Premium' },
      { to: '/privacy', label: 'Конфіденційність' },
      { to: '/terms', label: 'Угода підписника' },
      { to: '/auth?tab=login', label: 'Вхід' },
      { to: '/auth?tab=register', label: 'Реєстрація' },
    ],
  },
];

const quickStats = [
  { value: '1 000+', label: 'учнів готуються разом' },
  { value: '35', label: 'розділів теорії' },
  { value: '2 190', label: 'питань у базі' },
];

export default function SiteFooter() {
  const { isAuthenticated } = useAuth();

  const handleFooterLinkClick = () => {
    window.scrollTo({ top: 0, behavior: 'auto' });
  };

  const getLinkTarget = (link) => {
    if (link.auth && !isAuthenticated) {
      return `/auth?tab=login&redirect=${encodeURIComponent(link.to)}`;
    }

    return link.to;
  };

  return (
    <footer className="mt-14 bg-slate-950 text-white">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid gap-5 rounded-[28px] border border-white/10 bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 p-5 shadow-2xl shadow-blue-950/25 sm:p-7 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/14 px-3 py-1 text-xs font-semibold text-blue-50">
              <Crown className="h-4 w-4" />
              DrivePrep Premium
            </div>
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Підготовка має бути спокійною і зрозумілою.</h2>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-blue-50/90 sm:text-base">
              Вчіть теорію, проходьте офіційні тести, повертайтеся до помилок і бачте свій прогрес без зайвого шуму.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row lg:flex-col xl:flex-row">
            <Link
              to="/tests"
              onClick={handleFooterLinkClick}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-blue-700 shadow-lg shadow-blue-950/20 transition hover:-translate-y-0.5 hover:bg-blue-50"
            >
              Почати тест
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to="/study"
              onClick={handleFooterLinkClick}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/30 px-5 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-white/12"
            >
              Відкрити теорію
            </Link>
          </div>
        </div>

        <div className="grid gap-9 py-10 lg:grid-cols-[1.05fr_2fr]">
          <div>
            <Link to="/" onClick={handleFooterLinkClick} className="inline-flex items-center gap-3">
              <img src="/logo.png" alt="DrivePrep" className="h-12 w-12 rounded-2xl bg-white object-cover shadow-lg" />
              <div>
                <span className="block text-xl font-semibold tracking-tight text-white">DrivePrep</span>
                <span className="text-sm text-slate-400">Тести ПДР без хаосу</span>
              </div>
            </Link>

            <p className="mt-5 max-w-md text-sm leading-7 text-slate-400">
              Актуальна база питань, структурована теорія, білети за логікою іспиту МВС, збережені питання,
              аналітика та підтримка для майбутнього водія.
            </p>

            <div className="mt-6 grid grid-cols-3 gap-2">
              {quickStats.map((stat) => (
                <div key={stat.label} className="rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-3">
                  <p className="text-lg font-semibold text-white">{stat.value}</p>
                  <p className="mt-1 text-xs leading-4 text-slate-400">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 xl:grid-cols-5">
            {footerGroups.map((group) => {
              const Icon = group.icon;

              return (
                <div key={group.title}>
                  <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-100">
                    <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/[0.06] text-blue-200">
                      <Icon className="h-4 w-4" />
                    </span>
                    {group.title}
                  </div>
                  <ul className="space-y-3">
                    {group.links.map((link) => (
                      <li key={`${group.title}-${link.to}-${link.label}`}>
                        <Link
                          to={getLinkTarget(link)}
                          onClick={handleFooterLinkClick}
                          className="text-sm leading-5 text-slate-400 transition-colors hover:text-white"
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

        <div className="grid gap-5 border-t border-white/10 pt-7 text-sm text-slate-400 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <p className="text-slate-300">© 2026 DrivePrep. Матеріали створені для самопідготовки до теоретичного іспиту ПДР.</p>
            <p className="mt-2 text-xs leading-5 text-slate-500">
              Сервіс допомагає тренуватися, повторювати складні теми й рухатися до іспиту у власному темпі.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <a href="mailto:pdr.preparation@gmail.com" className="inline-flex items-center gap-2 transition-colors hover:text-white">
              <Mail className="h-4 w-4" />
              pdr.preparation@gmail.com
            </a>
            <Link
              to={isAuthenticated ? '/support' : '/auth?tab=login&redirect=%2Fsupport'}
              onClick={handleFooterLinkClick}
              className="inline-flex items-center gap-2 transition-colors hover:text-white"
            >
              <MessageCircle className="h-4 w-4" />
              Написати в підтримку
            </Link>
            <Link to="/leaderboard" onClick={handleFooterLinkClick} className="inline-flex items-center gap-2 transition-colors hover:text-white">
              <Trophy className="h-4 w-4" />
              Рейтинг учнів
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
