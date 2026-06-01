import { useMemo } from 'react';
import { useQueries, useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CarFront,
  Crown,
  FileBadge2,
  Lightbulb,
  Map,
  PlayCircle,
  Stethoscope,
  Triangle,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import api from '@/api/apiClient';
import { Card, CardContent } from '@/components/ui/card';
import { normalizeTheoryCategory, normalizeTheoryTopic } from '@/features/theory/theory-model';

const categoryMeta = {
  rules: {
    icon: BookOpen,
    color: 'bg-blue-600',
    eyebrow: 'Правила дорожнього руху',
    description: 'Усі імпортовані розділи ПДР з текстом, ілюстраціями та відео там, де вони є в базі.',
  },
  'road-signs': {
    icon: Triangle,
    color: 'bg-amber-500',
    eyebrow: 'Офіційні знаки',
    description: 'Попереджувальні, пріоритету, заборонні, наказові, сервісні знаки та таблички з локальними зображеннями.',
  },
  'road-markings': {
    icon: Map,
    color: 'bg-cyan-500',
    eyebrow: 'Розмітка',
    description: 'Горизонтальна та вертикальна дорожня розмітка з поясненнями до кожного позначення.',
  },
  library: {
    icon: Stethoscope,
    color: 'bg-emerald-500',
    eyebrow: 'Корисний довідник',
    description: 'Матеріали для повторення без зайвого перевантаження: коротко, структуровано й читабельно.',
  },
  'driving-license': {
    icon: CarFront,
    color: 'bg-sky-500',
    eyebrow: 'Сервісні центри',
    description: 'Підказки про посвідчення, категорії, документи та підготовку до реальної процедури.',
  },
  'video-lectures': {
    icon: PlayCircle,
    color: 'bg-rose-500',
    eyebrow: 'Відеолекції',
    description: 'Відеоматеріали відкриваються всередині теорії, щоб не губити навчальний контекст.',
  },
  'penalty-table': {
    icon: FileBadge2,
    color: 'bg-red-500',
    eyebrow: 'Штрафи та санкції',
    description: 'Окремий розділ для швидкого перегляду відповідальності за порушення правил.',
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

function topicLabel(count) {
  if (count === 1) return 'напрям';
  if (count >= 2 && count <= 4) return 'напрями';
  return 'напрямів';
}

function sectionHasVideo(section) {
  const html = `${section?.content_html || section?.contentHtml || section?.comment_html || section?.commentHtml || ''}`;
  return Boolean(
    section?.embed_url ||
    section?.embedUrl ||
    section?.video_url ||
    section?.videoUrl ||
    /(?:youtube\.com|youtu\.be|<iframe)/i.test(html),
  );
}

export default function TheoryDirectoryPage() {
  const navigate = useNavigate();
  const categoriesQuery = useQuery({
    queryKey: ['theory-categories'],
    queryFn: async () => (await api.getTheoryCategories()).map(normalizeTheoryCategory),
    staleTime: 5 * 60 * 1000,
  });

  const visibleCategories = useMemo(() => {
    const seen = new Set();
    return (categoriesQuery.data || []).filter((category) => {
      if (hiddenSlugs.has(category.slug)) return false;
      const titleKey = String(category.title || '').trim().toLowerCase();
      const slugKey = String(category.slug || '').trim().toLowerCase();
      const key = titleKey.includes('розміт') || slugKey.includes('marking')
        ? 'road-markings'
        : titleKey.includes('штраф') || slugKey.includes('penalty')
          ? 'penalty-table'
          : titleKey || slugKey;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [categoriesQuery.data]);
  const videoCategory = visibleCategories.find((category) => category.slug === 'video-lectures') || null;
  const categories = visibleCategories.filter((category) => category.slug !== 'video-lectures');

  const topicsQueries = useQueries({
    queries: categories.map((category) => ({
      queryKey: ['theory-topics', category.slug],
      queryFn: async () => (await api.getTheoryTopics(category.slug)).map(normalizeTheoryTopic),
      staleTime: 5 * 60 * 1000,
    })),
  });

  const videoTopicsQuery = useQuery({
    queryKey: ['theory-topics', 'video-lectures'],
    queryFn: async () => (await api.getTheoryTopics('video-lectures')).map(normalizeTheoryTopic),
    enabled: Boolean(videoCategory),
    staleTime: 5 * 60 * 1000,
  });

  const videoTopics = videoTopicsQuery.data || [];
  const videoSectionsQueries = useQueries({
    queries: videoTopics.map((topic) => ({
      queryKey: ['theory-sections', topic.slug],
      queryFn: async () => await api.getTheorySections(topic.slug),
      enabled: Boolean(topic.slug),
      staleTime: 5 * 60 * 1000,
    })),
  });
  const videoSections = videoSectionsQueries.flatMap((query) => (Array.isArray(query.data) ? query.data : []));
  const realVideoSections = videoSections.filter(sectionHasVideo);
  const videoLessonsCount = realVideoSections.length || videoSections.length;
  const videoTopicCount = videoSections.length || videoTopics.length;
  const videoCountsLoading = videoTopicsQuery.isLoading || videoSectionsQueries.some((query) => query.isLoading);

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
    <div className="mx-auto w-full max-w-[100vw] space-y-8 overflow-x-hidden px-4 pb-8 sm:max-w-7xl sm:px-6 lg:px-8">
      <ButtonLikeBack onClick={() => navigate(-1)} />

      <motion.section {...reveal} className="text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-100 text-blue-600 dark:bg-blue-500/10 dark:text-blue-200">
          <BookOpen className="h-8 w-8" />
        </div>
        <h1 className="mx-auto max-w-[22rem] break-words text-2xl font-semibold tracking-[-0.04em] text-slate-950 dark:text-white sm:max-w-2xl sm:text-4xl">
          Теорія ПДР і самопідготовка
        </h1>
        <p className="mx-auto mt-4 w-[calc(100vw-3rem)] max-w-[21rem] break-words text-base leading-7 text-slate-600 dark:text-slate-300 sm:w-auto sm:max-w-2xl">
          Тут зібрано матеріали DrivePrep для спокійного навчання: правила, довідники, відео й корисні підказки без зайвого візуального шуму.
        </p>
      </motion.section>

      {categoriesQuery.isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary/20 border-t-primary" />
        </div>
      ) : categoriesWithStats.length > 0 ? (
        <div className="mx-auto grid w-full max-w-[calc(100vw-2rem)] min-w-0 gap-5 sm:max-w-none md:grid-cols-2 xl:grid-cols-3">
          {categoriesWithStats.map((category, index) => {
            const meta = categoryMeta[category.slug] || categoryMeta.rules;
            const Icon = meta.icon;
            const isPremium = premiumSlugs.has(category.slug);
            const href = category.slug === 'video-lectures' ? '/lectures' : `/study/${category.slug}`;

            return (
              <motion.div key={category.slug} {...reveal} className="min-w-0" transition={{ ...reveal.transition, delay: index * 0.05 }}>
                <Link to={href} className="group block h-full min-w-0">
                  <Card className="h-full min-w-0 overflow-hidden border-2 border-transparent bg-card shadow-md transition-all hover:border-primary/30 hover:shadow-xl dark:border-slate-800 dark:hover:border-sky-500/40">
                    <CardContent className="flex h-full min-w-0 flex-col gap-5 p-5">
                      <div className="flex items-start justify-between gap-4">
                        <span className={`mt-1 flex h-12 w-12 items-center justify-center rounded-xl text-white shadow-sm ${meta.color}`}>
                          <Icon className="h-6 w-6" />
                        </span>
                        {isPremium ? (
                          <span className="inline-flex items-center gap-1 rounded-lg bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700 dark:bg-amber-500/15 dark:text-amber-200">
                            <Crown className="h-3.5 w-3.5" />
                            Premium
                          </span>
                        ) : null}
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">{meta.eyebrow}</p>
                        <h2 className="mt-2 text-xl font-semibold tracking-[-0.03em] text-slate-950 transition-colors group-hover:text-primary dark:text-white">
                          {category.title}
                        </h2>
                        <p className="mt-3 text-sm leading-7 text-slate-600 dark:text-slate-300">
                          {category.description || meta.description}
                        </p>
                      </div>

                      <div className="flex min-w-0 items-center justify-between gap-3 border-t border-slate-200 pt-4 dark:border-slate-800">
                        <span className="min-w-0 truncate text-sm text-slate-500 dark:text-slate-400">
                          {category.topicsCount || 1} {topicLabel(category.topicsCount || 1)}
                        </span>
                        <span className="inline-flex shrink-0 items-center gap-2 text-sm font-semibold text-primary">
                          Відкрити
                          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              </motion.div>
            );
          })}
        </div>
      ) : (
        <Card className="border-dashed border-slate-300 bg-card shadow-none dark:border-slate-800">
          <CardContent className="p-6 text-center text-sm text-slate-500 dark:text-slate-300">
            Теорія ще завантажується або backend тимчасово недоступний.
          </CardContent>
        </Card>
      )}

      {videoCategory ? (
        <VideoLessonsBanner
          lessonsCount={videoCountsLoading ? '...' : videoLessonsCount}
          topicsCount={videoCountsLoading ? '...' : videoTopicCount}
        />
      ) : null}

      <StudyTips />
    </div>
  );
}

function VideoLessonsBanner({ lessonsCount, topicsCount }) {
  return (
    <motion.section {...reveal}>
      <div className="overflow-hidden rounded-[28px] bg-[linear-gradient(135deg,#2563eb_0%,#4f46e5_100%)] p-5 text-white shadow-[0_24px_60px_rgba(37,99,235,0.22)] sm:p-8">
        <div className="grid gap-6 lg:grid-cols-[1fr_0.42fr] lg:items-center">
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/14">
                <PlayCircle className="h-6 w-6" />
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/14 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-white/90">
                <Crown className="h-3.5 w-3.5 text-amber-200" />
                Premium
              </span>
            </div>

            <div>
              <h2 className="text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">Відеоуроки з ПДР</h2>
              <p className="mt-3 max-w-3xl text-base leading-7 text-white/86">
                Переглядайте відеолекції для кращого розуміння правил дорожнього руху. Кожен урок пояснює тему спокійно, з прикладами й без зайвого перевантаження.
              </p>
            </div>

            <Link
              to="/lectures"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-blue-700 shadow-[0_16px_34px_rgba(15,23,42,0.18)] transition hover:bg-blue-50"
            >
              <PlayCircle className="h-5 w-5" />
              Дивитись відео
            </Link>
          </div>

          <div className="rounded-[24px] bg-white/20 p-5 backdrop-blur">
            <div className="grid grid-cols-2 gap-4 divide-x divide-white/20">
              <div className="pr-4">
                <p className="text-4xl font-semibold tracking-[-0.05em] sm:text-5xl">{lessonsCount}</p>
                <p className="mt-1 text-sm font-medium text-white/78">відеоуроків</p>
              </div>
              <div className="pl-4">
                <p className="text-4xl font-semibold tracking-[-0.05em] sm:text-5xl">{topicsCount}</p>
                <p className="mt-1 text-sm font-medium text-white/78">тем у відеорозділі</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.section>
  );
}

function ButtonLikeBack({ onClick }) {
  return (
    <button
      type="button"
      className="-ml-2 inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-950 dark:text-slate-200 dark:hover:bg-slate-900 dark:hover:text-white"
      onClick={onClick}
    >
      <ArrowLeft className="h-4 w-4" />
      Назад
    </button>
  );
}

function StudyTips() {
  const tips = [
    'Починайте з теорії - спочатку прочитайте правила, потім переходьте до практики',
    'Вивчайте знаки групами - попереджувальні, заборонні, наказові окремо',
    'Повторюйте матеріал регулярно - краще по 20-30 хвилин щодня',
    'Аналізуйте помилки - розбирайте кожну неправильну відповідь',
  ];

  return (
    <motion.section {...reveal} className="rounded-2xl border border-amber-200 bg-amber-50/45 p-4 shadow-sm dark:border-amber-500/25 dark:bg-amber-950/18 sm:p-6">
      <div className="mb-4 flex items-center gap-3">
        <Lightbulb className="h-6 w-6 text-amber-500" />
        <h2 className="text-xl font-semibold tracking-[-0.03em] text-slate-950 dark:text-white sm:text-2xl">
          Поради для ефективного навчання
        </h2>
      </div>
      <div className="space-y-2.5">
        {tips.map((tip, index) => (
          <div key={tip} className="flex items-start gap-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-500 text-xs font-semibold text-white">
              {index + 1}
            </span>
            <p className="pt-0.5 text-sm leading-6 text-slate-700 dark:text-slate-200 sm:text-base">{tip}</p>
          </div>
        ))}
      </div>
    </motion.section>
  );
}
