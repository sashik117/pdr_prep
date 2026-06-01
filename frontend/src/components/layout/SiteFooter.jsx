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
    <footer className="bg-gray-900 pt-16 pb-8 text-white">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-12 grid grid-cols-1 gap-12 md:grid-cols-4">
          <div className="col-span-1 md:col-span-1">
            <Link to="/" onClick={handleFooterLinkClick} className="flex items-center gap-3">
              <img src="/logo.png" alt="DrivePrep" className="h-10 w-10 rounded-xl bg-white object-cover shadow-lg" />
              <span className="text-xl font-bold text-white">DrivePrep</span>
            </Link>
            <p className="mt-6 max-w-sm text-sm leading-7 text-gray-400">
              Спокійна підготовка до теоретичного іспиту: актуальні питання, структурована теорія, білети, прогрес і повторення важливого матеріалу.
            </p>
          </div>

          {footerGroups.map((group) => (
            <div key={group.title}>
              <h2 className="mb-6 text-lg font-bold text-gray-200">{group.title}</h2>
              <ul className="space-y-4">
                {group.links.map((link) => (
                  <li key={link.to}>
                    <Link
                      to={link.to}
                      onClick={handleFooterLinkClick}
                      className="text-gray-400 transition-colors hover:text-white"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="grid gap-4 border-t border-gray-800 pt-8 text-sm text-gray-500 md:grid-cols-[1fr_auto] md:items-center">
          <p>© 2026 DrivePrep. Матеріали створені для зручної самопідготовки до іспиту ПДР.</p>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <a href="mailto:pdr.preparation@gmail.com" className="flex items-center gap-2 transition-colors hover:text-white">
              <Mail className="h-4 w-4" />
              pdr.preparation@gmail.com
            </a>
            <Link to="/support" onClick={handleFooterLinkClick} className="flex items-center gap-2 transition-colors hover:text-white">
              <MessageCircle className="h-4 w-4" />
              Підтримка
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
