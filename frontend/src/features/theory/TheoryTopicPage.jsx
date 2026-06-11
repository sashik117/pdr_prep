import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  Crown,
  FolderKanban,
  Lock,
  PlayCircle,
  Sparkles,
} from 'lucide-react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import api from '@/api/apiClient';
import { useAuth } from '@/lib/AuthContext';
import { hasPremiumAccess } from '@/lib/accessLimits';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { normalizeTheoryCategory, normalizeTheorySection, normalizeTheoryTopic } from '@/features/theory/theory-model';

const reveal = {
  initial: { opacity: 0, y: 18 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.15 },
  transition: { duration: 0.35, ease: 'easeOut' },
};

const academyBasicsRoadmap = [
  'Терміни, учасники руху та базові орієнтири на дорозі.',
  'Початок руху, зупинка й робота з органами керування.',
  'Маневрування, паркування та контроль траєкторії.',
  'Безпечна поведінка в потоці та перші виїзди.',
];

function isPremiumSlug(slug) {
  return slug === 'video-lectures' || slug.startsWith('academy');
}

function cleanVideoTitle(title) {
  return String(title || '')
    .replace(/^Розділ\s*\d+(?:[.)]\s*)?/i, '')
    .replace(/^\d+(?:[.)]\s*)?/, '')
    .trim();
}

function sectionOrderValue(section, fallback) {
  const numericSignature = String(`${section?.title || ''} ${section?.description || ''} ${section?.slug || ''}`).match(
    /(?:^|\s|rozdil[-_\s])(\d{1,2})(?:[.\-_](\d{1,2}))?(?:[.\-_](\d{1,2}))?/i,
  );
  if (numericSignature) {
    const major = Number(numericSignature[1] || 0);
    const minor = Number(numericSignature[2] || 0);
    const patch = Number(numericSignature[3] || 0);
    return major * 10000 + minor * 100 + patch;
  }
  const value = Number(section?.chapterNum || section?.sortOrder || fallback + 1);
  return Number.isFinite(value) ? value : fallback + 1;
}

function topicOrderValue(topic, fallback) {
  const directValue = Number(topic?.sortOrder ?? topic?.order ?? topic?.chapterNum ?? topic?.position);
  if (Number.isFinite(directValue) && directValue > 0) return directValue;
  const match = String(topic?.title || topic?.slug || '').match(/^\s*(\d+(?:\.\d+)?)/);
  const titleValue = match ? Number(match[1]) : Number.NaN;
  return Number.isFinite(titleValue) ? titleValue : fallback + 1;
}

function normalizeSectionKey(section) {
  return String(section?.title || section?.slug || section?.id || '').trim().toLowerCase();
}

export default function TheoryTopicPage() {
  const { topicKey = '' } = useParams();
  const [searchParams] = useSearchParams();
  const { user, isAuthenticated, navigateToLogin } = useAuth();

  const isPremiumUser = hasPremiumAccess(user);
  const selectedTopicSlug = searchParams.get('topic') || '';

  const categoriesQuery = useQuery({
    queryKey: ['theory-categories'],
    queryFn: async () => (await api.getTheoryCategories()).map(normalizeTheoryCategory),
    staleTime: 5 * 60 * 1000,
  });

  const topicsQuery = useQuery({
    queryKey: ['theory-topics', topicKey],
    queryFn: async () => (await api.getTheoryTopics(topicKey)).map(normalizeTheoryTopic),
    enabled: Boolean(topicKey),
    staleTime: 5 * 60 * 1000,
  });

  const category = (categoriesQuery.data || []).find((item) => item.slug === topicKey);
  const topics = topicsQuery.data || [];
  const sortedTopics = useMemo(
    () =>
      [...topics].sort(
        (left, right) =>
          topicOrderValue(left, 0) - topicOrderValue(right, 0) ||
          String(left.title || '').localeCompare(String(right.title || ''), 'uk'),
      ),
    [topics],
  );
  const hasNestedTopics = sortedTopics.length > 1;

  const resolvedTopic = useMemo(
    () =>
      sortedTopics.find((item) => item.slug === selectedTopicSlug) ||
      sortedTopics.find((item) => item.slug === topicKey) ||
      sortedTopics[0] ||
      null,
    [selectedTopicSlug, topicKey, sortedTopics],
  );

  const resolvedTopicSlug = resolvedTopic?.slug || '';
  const topicIsPremium = isPremiumSlug(topicKey) || isPremiumSlug(resolvedTopicSlug);
  const isVideoTopic = topicKey === 'video-lectures';
  const showAcademyRoadmap = resolvedTopicSlug === 'academy-driving-basics';

  const sectionsQuery = useQuery({
    queryKey: ['theory-sections', resolvedTopicSlug],
    queryFn: async () => (await api.getTheorySections(resolvedTopicSlug)).map(normalizeTheorySection),
    enabled: Boolean(resolvedTopicSlug) && (!hasNestedTopics || Boolean(selectedTopicSlug) || sortedTopics.some((item) => item.slug === topicKey)),
    staleTime: 5 * 60 * 1000,
  });

  const sections = useMemo(() => {
    const seen = new Set();
    return (sectionsQuery.data || [])
      .filter((section) => {
        const key = normalizeSectionKey(section);
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort((left, right) => sectionOrderValue(left, 0) - sectionOrderValue(right, 0));
  }, [sectionsQuery.data]);
  const previewSections = sections.slice(0, 3);

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 px-4 pb-8 sm:space-y-8 sm:px-6 lg:px-8">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" className="-ml-2 rounded-full px-3 text-slate-600 hover:text-slate-950 dark:text-slate-200 dark:hover:text-white">
          <Link to="/study">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Назад
          </Link>
        </Button>
      </div>

      <Card className="border-slate-200 bg-card shadow-md dark:border-slate-800">
        <CardContent className="space-y-3 p-5 sm:p-6">
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Розділи теми</p>
            {topicIsPremium ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-700 dark:bg-amber-500/15 dark:text-amber-200">
                <Crown className="h-3.5 w-3.5" />
                Premium
              </span>
            ) : null}
          </div>
          <h1 className="text-2xl font-semibold tracking-[-0.03em] text-slate-950 dark:text-white">
            {category?.title || 'Тема довідника'}
          </h1>
          <p className="text-sm leading-6 text-slate-600 dark:text-slate-300 sm:max-w-3xl">
            На телефоні всередині теми залишили лише назви розділів і швидкий перехід, щоб не перевантажувати екран.
          </p>
        </CardContent>
      </Card>

      {topicIsPremium && !isPremiumUser ? (
        <div className="space-y-4">
          <Card className="overflow-hidden border-amber-200 bg-amber-50/70 shadow-sm dark:border-amber-500/20 dark:bg-amber-950/20">
            <CardContent className="p-5 sm:p-6">
              <div className="flex items-start gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-amber-400/20 text-amber-700 dark:text-amber-200">
                  <PlayCircle className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <h2 className="text-xl font-semibold tracking-[-0.03em] text-slate-950 dark:text-white">
                    Повний доступ до цього розділу відкривається у Premium
                  </h2>
                  <p className="mt-3 text-sm leading-6 text-slate-700 dark:text-slate-300">
                    Зараз доступне лише прев’ю. Після активації Premium відкриються всі модулі, відео та повний маршрут навчання.
                  </p>
                  <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                    {isAuthenticated ? (
                      <Button asChild className="rounded-lg px-6">
                        <Link to="/pricing">Придбати доступ</Link>
                      </Button>
                    ) : (
                      <Button className="rounded-lg px-6" onClick={() => navigateToLogin(`/study/${topicKey}`)}>
                        Увійти та відкрити Premium
                      </Button>
                    )}
                    <Button asChild variant="outline" className="rounded-lg px-6">
                      <Link to="/study">Повернутися до теорії</Link>
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {hasNestedTopics ? (
            <div className="grid gap-4 md:grid-cols-2">
              {sortedTopics.slice(0, 4).map((topic, index) => (
                <motion.div key={topic.id || topic.slug} {...reveal} transition={{ ...reveal.transition, delay: index * 0.04 }}>
                  <Card className="overflow-hidden border-slate-200 bg-card dark:border-slate-700">
                    <CardContent className="relative p-5">
                      <div className="absolute inset-0 bg-white/50 backdrop-blur-[2px] dark:bg-slate-950/65" />
                      <div className="relative flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-slate-950 dark:text-white">{topic.title}</p>
                          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Огляд модуля</p>
                        </div>
                        <span className="inline-flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700 dark:bg-amber-500/15 dark:text-amber-200">
                          <Lock className="h-3.5 w-3.5" />
                          Premium
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="grid gap-4">
              {previewSections.map((section, index) => (
                <motion.div key={section.id} {...reveal} transition={{ ...reveal.transition, delay: index * 0.04 }}>
                  <Card className="border-slate-200 bg-card shadow-none dark:border-slate-700">
                    <CardContent className="flex flex-col items-start gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-950 dark:text-white">{isVideoTopic ? cleanVideoTitle(section.title) : section.title}</p>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Прев’ю матеріалу</p>
                      </div>
                      <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-200">
                        <Lock className="h-3.5 w-3.5" />
                        Premium
                      </span>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      ) : hasNestedTopics && !selectedTopicSlug && !sortedTopics.some((item) => item.slug === topicKey) ? (
        <div className="grid gap-4 md:grid-cols-2">
          {sortedTopics.map((topic, index) => (
            <motion.div key={topic.id || topic.slug} {...reveal} transition={{ ...reveal.transition, delay: index * 0.04 }}>
              <Link to={`/study/${topicKey}?topic=${encodeURIComponent(topic.slug)}`} className="block">
                <Card className="border-slate-200 bg-card shadow-sm transition-colors hover:border-primary/30 dark:border-slate-800 dark:hover:border-sky-500/30">
                  <CardContent className="p-4 sm:p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-base font-medium text-slate-950 dark:text-white">{topic.title}</p>
                        <p className="mt-2 hidden text-sm leading-6 text-slate-600 dark:text-slate-300 sm:block">
                          {topic.description || 'Окремий модуль із локальними ілюстраціями та швидким переходом до матеріалу.'}
                        </p>
                      </div>
                      <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                        <FolderKanban className="h-4 w-4" />
                      </span>
                    </div>
                    <div className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-primary">
                      Відкрити
                      <ChevronRight className="h-3.5 w-3.5" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {hasNestedTopics && selectedTopicSlug ? (
            <div className="flex items-center gap-3">
              <Button asChild variant="ghost" className="-ml-2 rounded-full px-3 text-slate-600 hover:text-slate-950 dark:text-slate-200 dark:hover:text-white">
                <Link to={`/study/${topicKey}`}>
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Назад до підтем
                </Link>
              </Button>
            </div>
          ) : null}

          {showAcademyRoadmap ? (
            <Card className="border-sky-200/80 bg-card shadow-sm dark:border-sky-900/60">
              <CardContent className="space-y-4 p-5 sm:p-6">
                <div className="space-y-2">
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-sky-600 dark:text-sky-300">План курсу</p>
                  <h2 className="text-xl font-semibold tracking-[-0.03em] text-slate-950 dark:text-white">
                    Основи водіння — маршрут проходження
                  </h2>
                  <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">
                    Короткий план, щоб навіть на телефоні було зрозуміло, що проходити далі.
                  </p>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  {academyBasicsRoadmap.map((item, index) => (
                    <div key={item} className="rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/40">
                      <div className="flex items-start gap-3">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                        <div>
                          <p className="text-sm font-medium text-slate-900 dark:text-white">Крок {index + 1}</p>
                          <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">{item}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : null}

          {sectionsQuery.isLoading ? (
            <div className="rounded-xl border border-slate-200 bg-card p-5 text-sm text-slate-500 dark:border-slate-800 dark:text-slate-300">
              Завантажую розділи...
            </div>
          ) : sections.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-card p-5 text-sm text-slate-500 dark:border-slate-800 dark:text-slate-300">
              Для цієї теми поки що не знайдено імпортованих розділів.
            </div>
          ) : (
            sections.map((section, index) => (
              <motion.div key={section.id} {...reveal} transition={{ ...reveal.transition, delay: index * 0.03 }}>
                <Link to={`/study/${resolvedTopicSlug || topicKey}/${section.chapterNum || section.sortOrder || index + 1}`} className="group block">
                  <Card className="border-2 border-transparent bg-card shadow-md transition-all hover:border-primary/30 hover:shadow-xl dark:border-slate-800 dark:hover:border-sky-500/40">
                    <CardContent className="p-4 sm:p-5">
                      <div className="flex items-center gap-4">
                        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-base font-semibold text-blue-600 transition-colors group-hover:bg-blue-600 group-hover:text-white dark:bg-blue-500/10 dark:text-blue-200">
                          {section.chapterNum || section.sortOrder || index + 1}
                        </span>
                        <div className="min-w-0">
                          <p className="text-base font-semibold text-slate-950 transition-colors group-hover:text-primary dark:text-white">{isVideoTopic ? cleanVideoTitle(section.title) : section.title}</p>
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <span className="rounded-md bg-slate-100 px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.12em] text-slate-600 dark:bg-slate-800 dark:text-slate-200">
                              {section.chapterNum ? `Розділ ${section.chapterNum}` : `Сторінка ${index + 1}`}
                            </span>
                            {section.embedUrl ? (
                              <span className="inline-flex items-center gap-1 rounded-md bg-rose-100 px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.12em] text-rose-700 dark:bg-rose-500/15 dark:text-rose-200">
                                <PlayCircle className="h-3.5 w-3.5" />
                                Відео
                              </span>
                            ) : null}
                          </div>
                        </div>
                        <span className="ml-auto inline-flex shrink-0 items-center gap-2 text-sm font-semibold text-primary">
                          <span className="hidden sm:inline">Відкрити</span>
                          <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                        </span>
                      </div>

                      {section.description ? (
                        <p className="mt-4 hidden text-sm leading-7 text-slate-600 dark:text-slate-300 sm:block">{section.description}</p>
                      ) : null}
                    </CardContent>
                  </Card>
                </Link>
              </motion.div>
            ))
          )}

          {!topicIsPremium ? (
            <motion.div {...reveal}>
              <Card className="border-slate-200 bg-card shadow-sm dark:border-slate-800">
                <CardContent className="flex flex-col items-start gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-950 dark:text-white">Хочете ще більше матеріалів?</p>
                    <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">
                      У Premium доступні відеолекції, розширені курси та додаткові блоки для системної підготовки.
                    </p>
                  </div>
                  <Button asChild className="rounded-lg">
                    <Link to="/pricing">
                      <Sparkles className="mr-2 h-4 w-4" />
                      Переглянути Premium
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          ) : null}
        </div>
      )}
    </div>
  );
}
