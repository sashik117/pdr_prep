// @ts-nocheck
import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Check, ChevronDown, Flame, ListChecks, Star, Target } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import PremiumLimitDialog from '@/components/premium/PremiumLimitDialog';
import api from '@/api/apiClient';
import { useAuth } from '@/lib/AuthContext';
import { getFreeDailyTestLimit, getRemainingFreeTests } from '@/lib/accessLimits';
import { buildSections, categoryGroups } from '@/lib/testCatalog';
import { cn } from '@/lib/utils';

const priorityWords = [
  'знаки',
  'розміт',
  'регул',
  'перехрест',
  'швидк',
  'обгін',
  'пішохід',
  'зупинка',
  'стоянка',
];

function difficultyFor(section) {
  const text = `${section.title || ''} ${section.id || ''}`.toLowerCase();
  if (['знаки', 'розміт', 'перехрест', 'обгін', 'регул'].some((word) => text.includes(word))) return 4;
  if (['швидк', 'пішохід', 'зупинка', 'стоянка'].some((word) => text.includes(word))) return 3;
  return 2;
}

function starsFor(level) {
  return Array.from({ length: 5 }, (_, index) => index < level);
}

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

  const statsQuery = useQuery({
    queryKey: ['section-tests-stats'],
    queryFn: () => api.getStats(),
    enabled: !!user,
    staleTime: 120000,
  });

  const progressBySection = useMemo(() => {
    const map = new Map();
    (statsQuery.data?.by_section || []).forEach((row) => {
      map.set(String(row.section), row);
      if (row.section_name) map.set(String(row.section_name).toLowerCase(), row);
    });
    return map;
  }, [statsQuery.data]);

  const sections = useMemo(() => {
    const prepared = buildSections(rawSections).map((section) => {
      const row = progressBySection.get(String(section.id)) || progressBySection.get(String(section.title || '').toLowerCase());
      const answered = Number(row?.total || 0);
      const progress = section.count ? Math.min(100, Math.round((answered / section.count) * 100)) : 0;
      const difficulty = difficultyFor(section);
      const priorityIndex = priorityWords.findIndex((word) => String(section.title || '').toLowerCase().includes(word));
      return {
        ...section,
        answered,
        progress,
        difficulty,
        priorityScore: priorityIndex >= 0 ? 100 - priorityIndex * 4 : difficulty * 8,
      };
    });
    return prepared.sort((left, right) => right.priorityScore - left.priorityScore || Number(left.id) - Number(right.id));
  }, [rawSections, progressBySection]);

  const popularSections = sections.slice(0, 6);

  const selectCategory = (categoryId) => {
    setSelectedCategory(categoryId);
    setCategoryOpen(false);
    setSearchParams({ category: categoryId });
  };

  const startSection = async (sectionId) => {
    if (!user?.is_premium) {
      try {
        const access = await api.checkAccessLimit('section_test_v2');
        if (!access?.allowed) {
          setLimitOpen(true);
          return;
        }
      } catch {
        // Let the test page perform the final server-side consume check.
      }
    }
    const query = new URLSearchParams({ mode: 'section', category: selectedCategory, section: sectionId });
    navigate(`/test?${query.toString()}`);
  };

  return (
    <motion.div className="mx-auto w-full max-w-[100vw] space-y-8 overflow-x-hidden px-5 pb-8 sm:max-w-7xl sm:px-6 lg:px-8" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: 'easeOut' }}>
      <Button type="button" variant="ghost" className="-ml-2 rounded-full px-3" onClick={() => navigate('/tests')}>
        <ArrowLeft className="mr-2 h-4 w-4" />
        Назад
      </Button>

      <section className="space-y-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0 max-w-4xl flex-1 space-y-2">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-100 text-blue-600 dark:bg-blue-500/10 dark:text-blue-200">
              <ListChecks className="h-7 w-7" />
            </div>
            <Badge variant="secondary" className="rounded-lg px-3 py-1.5 text-xs font-medium">
              Практика по темах
            </Badge>
            <h1 className="max-w-full break-words text-2xl font-semibold tracking-[-0.04em] text-slate-950 dark:text-white sm:text-4xl">
              Оберіть тему для повторення
            </h1>
            <p className="w-[calc(100vw-2.5rem)] max-w-3xl break-words text-base leading-7 text-slate-600 dark:text-slate-300 sm:w-auto">
              Спочатку показуємо популярні та складні теми, а нижче залишаємо повний список розділів для спокійного тренування.
            </p>
            {!user?.is_premium ? (
              <Badge variant="outline" className="mt-3 rounded-xl border-amber-200 bg-amber-50 px-3 py-1.5 text-amber-700 dark:border-amber-500/30 dark:bg-amber-950/30 dark:text-amber-200">
                Free: ще {getRemainingFreeTests(user, 'section')} із {getFreeDailyTestLimit(user)} спроб сьогодні
              </Badge>
            ) : null}
          </div>

        <div className="relative w-full sm:w-[320px]">
          <button
            type="button"
            className="flex min-h-12 w-full items-center gap-3 rounded-xl border border-slate-200 bg-card px-4 py-3 text-left shadow-sm transition-colors hover:border-primary/35 dark:border-slate-800 dark:hover:border-sky-500/35"
            onClick={() => setCategoryOpen((value) => !value)}
            aria-expanded={categoryOpen}
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary dark:bg-sky-400/10 dark:text-sky-200">
              <SelectedCategoryIcon className="h-5 w-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-xs font-medium uppercase tracking-[0.16em] text-slate-400">Категорія</span>
              <span className="block truncate text-sm font-medium text-slate-950 dark:text-white">{selectedCategoryMeta.label}</span>
            </span>
            <ChevronDown className={cn('h-5 w-5 text-slate-400 transition-transform', categoryOpen && 'rotate-180')} />
          </button>

          {categoryOpen ? (
            <div className="absolute right-0 z-30 mt-2 w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-950">
              {categoryGroups.map((category) => {
                const active = category.id === selectedCategory;
                const Icon = category.icon;
                return (
                  <button
                    key={category.id}
                    type="button"
                    className={cn(
                      'flex w-full items-center gap-3 px-4 py-3 text-left transition-colors',
                      active ? 'bg-primary/10 text-primary dark:bg-sky-400/10 dark:text-sky-200' : 'hover:bg-slate-50 dark:hover:bg-slate-900',
                    )}
                    onClick={() => selectCategory(category.id)}
                  >
                    <Icon className="h-5 w-5 shrink-0" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-slate-950 dark:text-white">{category.label}</span>
                      <span className="block truncate text-xs text-slate-500 dark:text-slate-400">{category.hint}</span>
                    </span>
                    {active ? <Check className="h-4 w-4 shrink-0" /> : null}
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>
        </div>
      </section>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50/70 px-4 py-3 text-sm text-red-600 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200">
          Не вдалося завантажити розділи. Перевірте, будь ласка, підключення до backend.
        </div>
      ) : null}

      <SectionGroup
        title="Популярні та складні теми"
        icon={Flame}
        sections={popularSections}
        isLoading={isLoading}
        onStart={startSection}
        highlight
      />

      <SectionGroup
        title="Усі теми"
        icon={Target}
        sections={sections}
        isLoading={isLoading}
        onStart={startSection}
      />

      <PremiumLimitDialog
        open={limitOpen}
        onOpenChange={setLimitOpen}
        title="Ви вичерпали ліміт практики"
        description={user
          ? 'Ви використали 3 безкоштовні спроби на сьогодні. Premium відкриває тренування по темах без денних обмежень.'
          : 'Гостьова спроба на сьогодні вже використана. Зареєструйтесь, щоб отримати більше спроб і зберігати прогрес.'}
        primaryLabel={user ? 'Отримати Premium' : 'Зареєструватися'}
        primaryTo={user ? '/pricing' : '/auth?tab=register'}
        intent={user ? 'premium' : 'register'}
      />
      <Dialog open={false && limitOpen} onOpenChange={setLimitOpen}>
        <DialogContent className="rounded-xl border-slate-200 bg-card text-slate-950 dark:border-slate-800 dark:text-white">
          <DialogTitle>Денний ліміт використано</DialogTitle>
          <DialogDescription>
            Безкоштовно доступна лише одна спроба на день. Premium відкриває тренування без денних обмежень.
          </DialogDescription>
          <div className="flex flex-col gap-3 pt-2 sm:flex-row">
            <Button className="rounded-lg px-6" onClick={() => navigate('/pricing')}>Перейти до Premium</Button>
            <Button variant="outline" className="rounded-lg px-6" onClick={() => setLimitOpen(false)}>Повернутися</Button>
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}

function SectionGroup({ title, icon: Icon, sections, isLoading, onStart, highlight = false }) {
  return (
    <section className="space-y-4">
      <div className="flex items-center gap-3">
        <Icon className={cn('h-6 w-6', highlight ? 'text-red-500' : 'text-primary')} />
        <h2 className="text-2xl font-semibold tracking-[-0.04em] text-slate-950 dark:text-white">{title}</h2>
      </div>

      {isLoading ? (
        <div className="mx-auto grid w-full max-w-[calc(100vw-2.5rem)] gap-5 sm:max-w-none md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: highlight ? 6 : 9 }).map((_, index) => (
            <div key={index} className="h-52 animate-pulse rounded-2xl border border-slate-200 bg-slate-100/70 dark:border-slate-800 dark:bg-slate-900/70" />
          ))}
        </div>
      ) : (
        <div className="mx-auto grid w-full max-w-[calc(100vw-2.5rem)] gap-5 sm:max-w-none md:grid-cols-2 xl:grid-cols-3">
          {sections.map((section) => (
            <button
              key={section.id}
              type="button"
              className="group flex min-h-[214px] w-full min-w-0 flex-col rounded-2xl border border-slate-200 bg-card p-5 text-left shadow-md transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-xl dark:border-slate-800 dark:hover:border-sky-500/40"
              onClick={() => onStart(section.id)}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-lg font-semibold leading-6 text-slate-950 transition-colors group-hover:text-primary dark:text-white">{section.title}</h3>
                  <div className="mt-2 flex items-center gap-1">
                    {starsFor(section.difficulty).map((filled, index) => (
                      <Star key={index} className={cn('h-4 w-4', filled ? 'fill-amber-400 text-amber-400' : 'text-slate-300 dark:text-slate-700')} />
                    ))}
                    <span className="ml-2 text-xs font-medium text-amber-600 dark:text-amber-300">
                      {section.difficulty >= 4 ? 'Складно' : section.difficulty === 3 ? 'Середньо' : 'База'}
                    </span>
                  </div>
                </div>
                <span className="rounded-xl bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-600 dark:bg-blue-500/10 dark:text-blue-200">
                  {section.progress}%
                </span>
              </div>

              <p className="mt-4 text-sm leading-6 text-slate-600 dark:text-slate-300">
                {section.count} питань · {section.answered} вже переглянуто
              </p>

              <div className="mt-auto pt-5">
                <div className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                  <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${Math.max(4, section.progress)}%` }} />
                </div>
                <div className="mt-3 flex items-center justify-between text-sm">
                  <span className="text-slate-500 dark:text-slate-400">{section.answered} з {section.count} вивчено</span>
                  <ArrowRight className="h-4 w-4 text-slate-400 transition-transform group-hover:translate-x-1 group-hover:text-primary" />
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
