import { Link } from 'react-router-dom';
import { Mail, MessageCircle } from 'lucide-react';

const footerGroups = [
  {
    title: 'Навчання',
    links: [
      { to: '/study', label: 'Теорія ПДР' },
      { to: '/signs', label: 'Дорожні знаки' },
      { to: '/tests', label: 'Тести' },
      { to: '/tickets', label: 'Білети' },
    ],
  },
  {
    title: 'Практика',
    links: [
      { to: '/saved-questions', label: 'Збережені питання' },
      { to: '/analytics', label: 'Аналітика' },
      { to: '/achievements', label: 'Досягнення' },
      { to: '/pricing', label: 'Premium' },
    ],
  },
  {
    title: 'Сервіс',
    links: [
      { to: '/support', label: 'Підтримка' },
      { to: '/settings', label: 'Налаштування' },
      { to: '/privacy', label: 'Конфіденційність' },
      { to: '/terms', label: 'Угода підписника' },
    ],
  },
];

export default function SiteFooter() {
  const handleFooterLinkClick = () => {
    window.scrollTo({ top: 0, behavior: 'auto' });
  };

  return (
    <footer className="bg-slate-950 pt-14 pb-7 text-white">
      <div className="w-full px-4 sm:px-6 xl:pl-24">
        <div className="grid gap-10 lg:grid-cols-[1.35fr_repeat(3,1fr)]">
          <div className="max-w-md">
            <Link to="/" onClick={handleFooterLinkClick} className="flex items-center gap-3">
              <img src="/logo.png" alt="DrivePrep" className="h-11 w-11 rounded-2xl bg-white object-cover shadow-lg" />
              <span className="text-xl font-semibold tracking-tight">DrivePrep</span>
            </Link>
            <p className="mt-5 text-sm leading-7 text-slate-400">
              Спокійна підготовка до теоретичного іспиту: актуальні питання, структурована теорія, білети, прогрес і повторення важливого матеріалу.
            </p>
            <div className="mt-6 grid gap-3 text-sm text-slate-400">
              <a href="mailto:pdr.preparation@gmail.com" className="flex items-center gap-3 transition-colors hover:text-white">
                <Mail className="h-5 w-5" />
                pdr.preparation@gmail.com
              </a>
              <Link to="/support" onClick={handleFooterLinkClick} className="flex items-center gap-3 transition-colors hover:text-white">
                <MessageCircle className="h-5 w-5" />
                Написати в підтримку
              </Link>
            </div>
          </div>

          {footerGroups.map((group) => (
            <div key={group.title}>
              <h2 className="text-base font-semibold text-slate-100">{group.title}</h2>
              <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 sm:block sm:space-y-3">
                {group.links.map((link) => (
                  <Link
                    key={link.to}
                    to={link.to}
                    onClick={handleFooterLinkClick}
                    className="block text-sm text-slate-400 transition-colors hover:text-white"
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-10 border-t border-slate-800 pt-6 text-center text-xs text-slate-500 sm:text-sm">
          © 2026 DrivePrep. Матеріали створені для зручної самопідготовки до іспиту ПДР.
        </div>
      </div>
    </footer>
  );
}
