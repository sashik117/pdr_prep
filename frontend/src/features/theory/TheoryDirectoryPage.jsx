import { useMemo } from 'react';
import { useQueries, useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  BookOpen,
  CarFront,
  Crown,
  FileBadge2,
  PlayCircle,
  Stethoscope,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '@/api/apiClient';
import { Card, CardContent } from '@/components/ui/card';
import { normalizeTheoryCategory, normalizeTheoryTopic } from '@/features/theory/theory-model';

const categoryMeta = {
  rules: {
    icon: BookOpen,
    eyebrow: 'База ПДР',
    mobileHint: '35 розділів правил',
  },
  library: {
    icon: Stethoscope,
    eyebrow: 'Практичний довідник',
    mobileHint: 'Корисні матеріали',
  },
  'driving-license': {
    icon: CarFront,
    eyebrow: 'Сервісні центри',
    mobileHint: 'Іспити та документи',
  },
  'video-lectures': {
    icon: PlayCircle,
    eyebrow: 'Відеоформат',
    mobileHint: 'Відеолекції Premium',
  },
  'penalty-table': {
    icon: FileBadge2,
    eyebrow: 'Штрафи та санкції',
    mobileHint: 'Таблиця санкцій',
  },
};

const hiddenSlugs = new Set(['academy', 'difficult-questions']);
const premiumSlugs = new Set(['video-lectures']);

const reveal = {
  initial: { opacity: 0, y: 18 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.15 },
  transition: { duration: 0.35, ease: 'easeOut' },
};

export default function TheoryDirectoryPage() {
  const categoriesQuery = useQuery({
    queryKey: ['theory-categories'],
    queryFn: async () => (await api.getTheoryCategories()).map(normalizeTheoryCategory),
    staleTime: 5 * 60 * 1000,
  });

  const categories = (categoriesQuery.data || []).filter((category) => !hiddenSlugs.has(category.slug));

  const topicsQueries = useQueries({
    queries: categories.map((category) => ({
      queryKey: ['theory-topics', category.slug],
      queryFn: async () => (await api.getTheoryTopics(category.slug)).map(normalizeTheoryTopic),
      staleTime: 5 * 60 * 1000,
    })),
  });

  const categoriesWithStats = useMemo(
    () =>
      categories.map((category, index) => {
        const topics = /** @type {any[]} */ (topicsQueries[index]?.data || []);
        return {
          ...category,
          topicsCount: topics.length,
        };
      }),
    [categories, topicsQueries],
  );

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 pb-6 sm:space-y-8 sm:px-6">
      <Card className="border-slate-200 bg-transparent shadow-none dark:border-slate-800 dark:bg-slate-950">
        <CardContent className="space-y-3 p-5 sm:p-6 lg:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Теорія DrivePrep</p>
          <h1 className="text-2xl font-semibold tracking-[-0.03em] text-slate-950 dark:text-white sm:text-3xl">
            Уся теорія та корисні довідники в одному каталозі
          </h1>
          <p className="text-sm leading-6 text-slate-600 dark:text-slate-300 sm:max-w-3xl">
            На телефоні лишили тільки зрозумілу структуру: назва розділу, коротка підказка і перехід усередину.
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {categoriesWithStats.map((category, index) => {
          const meta = categoryMeta[category.slug] || categoryMeta.rules;
          const Icon = meta.icon;
          const isPremium = premiumSlugs.has(category.slug);
          const href = category.slug === 'video-lectures' ? '/lectures' : `/study/${category.slug}`;

          return (
            <motion.div key={category.slug} {...reveal} transition={{ ...reveal.transition, delay: index * 0.04 }}>
              <Link to={href} className="block h-full">
                <Card className="h-full border-slate-200 bg-transparent shadow-none transition-colors hover:border-primary/30 dark:border-slate-800 dark:bg-slate-950 dark:hover:border-sky-500/30">
                  <CardContent className="flex h-full flex-col gap-4 p-4 sm:p-5">
                    <div className="flex items-start justify-between gap-4">
                      <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white">
                        <Icon className="h-5 w-5" />
                      </span>
                      {isPremium ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-amber-700 dark:bg-amber-500/15 dark:text-amber-200">
                          <Crown className="h-3.5 w-3.5" />
                          Premium
                        </span>
                      ) : null}
                    </div>

                    <div className="space-y-2">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                        {meta.eyebrow}
                      </p>
                      <h2 className="text-xl font-semibold tracking-[-0.03em] text-slate-950 dark:text-white">{category.title}</h2>
                      <p className="text-sm leading-6 text-slate-600 dark:text-slate-300 sm:hidden">{meta.mobileHint}</p>
                      <p className="hidden text-sm leading-7 text-slate-600 dark:text-slate-300 sm:block">
                        {category.description || 'Структурований контент DrivePrep із локальними ілюстраціями та стабільною навігацією.'}
                      </p>
                    </div>

                    <div className="mt-auto flex items-center justify-between border-t border-slate-200 pt-4 dark:border-slate-800">
                      <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-200">
                        {category.topicsCount || 1} {category.topicsCount === 1 ? 'напрям' : 'напрями'}
                      </div>
                      <span className="text-sm font-semibold text-primary">Відкрити</span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
