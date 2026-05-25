import { Link } from 'react-router-dom';
import { footerGroups } from '@/components/layout/navigation-config';

export default function SiteFooter() {
  const handleFooterLinkClick = () => {
    window.scrollTo({ top: 0, behavior: 'auto' });
  };

  return (
    <footer className="border-t border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
      <div className="w-full px-3 py-5 sm:px-5 sm:py-8 xl:pl-24">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-[1.2fr_repeat(3,1fr)]">
          <div className="max-w-md sm:col-span-2 lg:col-span-1">
            <div className="flex items-center gap-3">
              <img
                src="/logo.png"
                alt="DrivePrep"
                className="h-9 w-9 rounded-full border border-slate-200 bg-white object-cover shadow-sm dark:border-slate-700 dark:bg-slate-900"
              />
              <p className="text-sm font-medium uppercase tracking-[0.16em] text-slate-900 dark:text-white">DrivePrep</p>
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
              Спокійна підготовка до теоретичного іспиту: актуальні білети, теорія та тренування у зручному темпі.
            </p>
          </div>

          {footerGroups.map((group) => (
            <div key={group.title}>
              <p className="text-sm font-medium text-slate-900 dark:text-white">{group.title}</p>
              <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 sm:block sm:space-y-1">
                {group.links.map((link) => (
                  <Link
                    key={link.to}
                    to={link.to}
                    onClick={handleFooterLinkClick}
                    className="block rounded-md py-1 text-sm text-slate-600 transition-colors hover:text-blue-600 dark:text-slate-300 dark:hover:text-blue-300"
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-5 border-t border-slate-200/70 pt-4 text-center text-xs text-slate-500 dark:border-slate-800/80 dark:text-slate-400 sm:text-sm">
          © 2026 DrivePrep
        </div>
      </div>
    </footer>
  );
}
