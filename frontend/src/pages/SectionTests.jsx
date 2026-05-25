// @ts-nocheck
import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, ChevronDown, ListChecks } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import api from '@/api/apiClient';
import { useAuth } from '@/lib/AuthContext';
import { canStartFreeTest, getRemainingFreeTests } from '@/lib/accessLimits';
import { buildSections, categoryGroups } from '@/lib/testCatalog';
import { cn } from '@/lib/utils';

export default function SectionTests() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const initialCategory = searchParams.get('category') || 'B';
  const [selectedCategory, setSelectedCategory] = useState(
    categoryGroups.some((item) => item.id === initialCategory) ? initialCategory : 'B',
  );
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [limitOpen, setLimitOpen] = useState(false);

  const selectedCategoryMeta = categoryGroups.find((item) => item.id === selectedCategory) || categoryGroups[1];
  const SelectedCategoryIcon = selectedCategoryMeta.icon;

  const { data: rawSections = [], isLoading, error } = useQuery({
    queryKey: ['test-sections', selectedCategory],
    queryFn: () => api.getSections(selectedCategory),
  });

  const sections = useMemo(() => buildSections(rawSections), [rawSections]);

  const selectCategory = (categoryId) => {
    setSelectedCategory(categoryId);
    setCategoryOpen(false);
    setSearchParams({ category: categoryId });
  };

  const startSection = (sectionId) => {
    if (!canStartFreeTest(user, 'section')) {
      setLimitOpen(true);
      return;
    }
    const query = new URLSearchParams({ mode: 'section', category: selectedCategory, section: sectionId });
    navigate(`/test?${query.toString()}`);
  };

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5 pb-6">
      <section className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">Окреме тренування</p>
            <h1 className="mt-1 text-2xl font-semibold text-slate-950 dark:text-white">Оберіть тему для повторення</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300">
              Оберіть тему, яку хочете повторити. Ми підготуємо питання саме з цього розділу.
            </p>
          </div>
          {!user?.is_premium ? (
            <Badge variant="outline" className="w-fit rounded-lg border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-950/30 dark:text-amber-200">
              Free: ще {getRemainingFreeTests(user, 'section')} із 3 спроб сьогодні
            </Badge>
          ) : null}
        </div>
      </section>

      <section className="space-y-4 rounded-xl border border-slate-200 bg-card p-4 dark:border-slate-800 sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">Категорія посвідчення</p>
            <h2 className="mt-1 text-xl font-medium text-slate-950 dark:text-white">Оберіть категорію</h2>
          </div>
          <Badge variant="outline" className="hidden rounded-lg border-slate-200 bg-transparent text-slate-600 dark:border-slate-700 dark:text-slate-300 sm:inline-flex">
            {selectedCategory}
          </Badge>
        </div>

        <div className="md:hidden">
          <button
            type="button"
            className="flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-background px-4 py-3 text-left dark:border-slate-700"
            onClick={() => setCategoryOpen((value) => !value)}
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <SelectedCategoryIcon className="h-5 w-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium text-slate-950 dark:text-white">{selectedCategoryMeta.label}</span>
              <span className="block truncate text-xs text-slate-500 dark:text-slate-300">{selectedCategoryMeta.hint}</span>
            </span>
            <ChevronDown className={cn('h-5 w-5 text-slate-400 transition-transform', categoryOpen && 'rotate-180')} />
          </button>

          {categoryOpen ? (
            <div className="mt-2 grid gap-2">
              {categoryGroups.map((category) => (
                <button
                  key={category.id}
                  type="button"
                  className={cn(
                    'flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors',
                    selectedCategory === category.id
                      ? 'border-primary bg-primary/5'
                      : 'border-slate-200 bg-transparent dark:border-slate-700',
                  )}
                  onClick={() => selectCategory(category.id)}
                >
                  <category.icon className="h-5 w-5 shrink-0 text-primary" />
                  <span>
                    <span className="block text-sm font-medium text-slate-950 dark:text-white">{category.label}</span>
                    <span className="block text-xs text-slate-500 dark:text-slate-300">{category.hint}</span>
                  </span>
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div className="hidden gap-3 md:grid md:grid-cols-2 xl:grid-cols-3">
          {categoryGroups.map((category) => (
            <button
              key={category.id}
              type="button"
              className={cn(
                'rounded-xl border px-4 py-4 text-left transition-colors',
                selectedCategory === category.id
                  ? 'border-primary bg-primary/5 dark:border-sky-500/40 dark:bg-sky-500/10'
                  : 'border-slate-200 bg-transparent hover:border-primary/30 dark:border-slate-700 dark:hover:border-sky-500/30',
              )}
              onClick={() => selectCategory(category.id)}
            >
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                <category.icon className="h-5 w-5" />
              </div>
              <p className="text-base font-medium text-slate-950 dark:text-white">{category.label}</p>
              <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">{category.hint}</p>
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">Розділи</p>
            <h2 className="mt-1 text-xl font-semibold text-slate-950 dark:text-white">Доступні теми</h2>
          </div>
          <Badge variant="outline" className="rounded-lg border-slate-200 bg-card text-slate-600 dark:border-slate-700 dark:text-slate-300">
            <ListChecks className="mr-2 h-3.5 w-3.5" />
            {selectedCategory}
          </Badge>
        </div>

        {error ? (
          <div className="rounded-lg border border-red-200 bg-red-50/70 px-4 py-3 text-sm text-red-600 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200">
            Не вдалося завантажити розділи. Перевірте, будь ласка, підключення до backend.
          </div>
        ) : null}

        {isLoading ? (
          <div className="rounded-xl border border-slate-200 bg-card p-5 text-sm text-slate-500 dark:border-slate-800 dark:text-slate-300">
            Завантажуємо розділи...
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {sections.map((section) => (
              <button
                key={section.id}
                type="button"
                className="rounded-xl border border-slate-200 bg-card p-4 text-left transition-colors hover:border-primary/30 dark:border-slate-800 dark:hover:border-sky-500/30"
                onClick={() => startSection(section.id)}
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="rounded-lg bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">Розділ {section.id}</span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">{section.count} питань</span>
                </div>
                <h3 className="mt-3 text-base font-medium leading-6 text-slate-950 dark:text-white">{section.title}</h3>
                <p className="mt-2 flex items-center gap-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                  Почати тест
                  <ArrowRight className="h-4 w-4" />
                </p>
              </button>
            ))}
          </div>
        )}
      </section>

      <Dialog open={limitOpen} onOpenChange={setLimitOpen}>
        <DialogContent className="rounded-xl border-slate-200 bg-card text-slate-950 dark:border-slate-800 dark:text-white">
          <DialogTitle>Денний ліміт використано</DialogTitle>
          <DialogDescription>
            Безкоштовно доступно 3 тести по розділах на день. Premium відкриває тренування без обмежень.
          </DialogDescription>
          <div className="flex flex-col gap-3 pt-2 sm:flex-row">
            <Button className="rounded-lg px-6" onClick={() => navigate('/pricing')}>Перейти до Premium</Button>
            <Button variant="outline" className="rounded-lg px-6" onClick={() => setLimitOpen(false)}>Повернутися</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
