import { useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, ChevronLeft, ChevronRight, Crown, Lock, PlayCircle } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import api from '@/api/apiClient';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import TheoryAssetGallery from '@/features/theory/components/TheoryAssetGallery';
import TheoryRichContent from '@/features/theory/components/TheoryRichContent';
import TheoryVideoPanel from '@/features/theory/components/TheoryVideoPanel';
import { normalizeTheorySection } from '@/features/theory/theory-model';

const reveal = {
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.15 },
  transition: { duration: 0.42, ease: 'easeOut' },
};

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
  const value = Number(section?.chapterNum || section?.sortOrder || fallback + 1);
  return Number.isFinite(value) ? value : fallback + 1;
}

function normalizeSectionKey(section) {
  return String(section?.title || section?.slug || section?.id || '').trim().toLowerCase();
}

export default function TheorySectionPage() {
  const navigate = useNavigate();
  const { topicKey = '', entryId = '' } = useParams();
  const { user, isAuthenticated, navigateToLogin } = useAuth();
  const entryNumber = Number(entryId);

  const sectionsQuery = useQuery({
    queryKey: ['theory-sections', topicKey],
    queryFn: async () => (await api.getTheorySections(topicKey)).map(normalizeTheorySection),
    enabled: Boolean(topicKey),
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

  const resolvedSection = useMemo(() => {
    if (!sections.length || !entryNumber) return null;
    return (
      sections.find((item) => item.id === entryNumber) ||
      sections.find((item) => item.chapterNum === entryNumber) ||
      sections.find((item) => item.sortOrder === entryNumber) ||
      sections[entryNumber - 1] ||
      null
    );
  }, [entryNumber, sections]);

  const sectionQuery = useQuery({
    queryKey: ['theory-section', resolvedSection?.id],
    queryFn: async () => normalizeTheorySection(await api.getTheorySection(resolvedSection.id)),
    enabled: Boolean(resolvedSection?.id),
    staleTime: 5 * 60 * 1000,
  });

  const section = sectionQuery.data || resolvedSection;
  const resolvedTopicKey = section?.topicSlug || topicKey || '';
  const requiresPremium = isPremiumSlug(resolvedTopicKey);
  const isVideoTopic = resolvedTopicKey === 'video-lectures' || topicKey === 'video-lectures';
  const sectionTitle = isVideoTopic ? cleanVideoTitle(section?.title) : section?.title;
  const isPremiumUser = Boolean(user?.is_premium);
  const hasInlineImages = /<img\b/i.test(section?.contentHtml || '');
  const currentIndex = sections.findIndex((item) => item.id === section?.id);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [entryId]);

  useEffect(() => {
    if (!resolvedSection?.id || resolvedSection.id === entryNumber || !resolvedTopicKey) return;
    navigate(`/study/${resolvedTopicKey}/${resolvedSection.id}`, { replace: true });
  }, [entryNumber, navigate, resolvedSection, resolvedTopicKey]);

  const goToSection = (nextId) => {
    navigate(`/study/${resolvedTopicKey || topicKey}/${nextId}`);
  };

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 pb-8 sm:space-y-8 sm:px-6 lg:px-8">
      <div className="flex items-center gap-3">
        <Button asChild variant="outline" className="rounded-lg">
          <Link to={resolvedTopicKey ? `/study/${resolvedTopicKey}` : '/study'}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Назад до розділів
          </Link>
        </Button>
      </div>

      <Card className="theory-page-card overflow-hidden border-slate-200 bg-card shadow-sm dark:border-slate-800">
        <CardHeader className="theory-section-hero border-b border-slate-200 bg-sky-50/60 dark:border-slate-800 dark:bg-sky-950/15">
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Теорія</p>
            {requiresPremium ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-700 dark:bg-amber-500/15 dark:text-amber-200">
                <Crown className="h-3.5 w-3.5" />
                Premium
              </span>
            ) : null}
            {section?.embedUrl ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-rose-700 dark:bg-rose-500/15 dark:text-rose-200">
                <PlayCircle className="h-3.5 w-3.5" />
                Відео
              </span>
            ) : null}
          </div>

          <div>
            <h1 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-slate-950 dark:text-white sm:text-3xl">
              {sectionTitle || 'Завантаження розділу'}
            </h1>
            {section?.description ? (
              <p className="mt-3 hidden text-sm leading-7 text-slate-700 dark:text-slate-200 sm:block">
                {section.description}
              </p>
            ) : null}
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {sectionsQuery.isLoading && !section ? (
            <div className="px-6 py-12 text-sm text-slate-600 dark:text-slate-300">Завантажую розділ…</div>
          ) : !section ? (
            <div className="p-6 text-sm text-slate-500 dark:text-slate-300">Не вдалося знайти цей розділ.</div>
          ) : requiresPremium && !isPremiumUser ? (
            <div className="space-y-5 p-5 sm:p-8">
              <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-5 dark:border-amber-500/20 dark:bg-amber-950/20 sm:p-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-amber-400/20 text-amber-700 dark:text-amber-200">
                    <Lock className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-semibold tracking-[-0.03em] text-slate-950 dark:text-white">
                      Повний матеріал відкривається у Premium
                    </h2>
                    <p className="mt-3 text-sm leading-7 text-slate-700 dark:text-slate-300">
                      У цьому режимі доступне лише прев’ю. Після активації Premium відкриються всі лекції, локальні
                      ілюстрації, відеовставки та повний навчальний матеріал без обмежень.
                    </p>
                    <div className="mt-5 flex flex-wrap gap-3">
                      {isAuthenticated ? (
                        <Button asChild className="rounded-lg px-6">
                          <Link to="/pricing">Придбати доступ</Link>
                        </Button>
                      ) : (
                        <Button className="rounded-lg px-6" onClick={() => navigateToLogin('/lectures')}>
                          Увійти та відкрити Premium
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-8 p-4 sm:p-8">
              {section.embedUrl || section.videoUrl ? (
                <motion.div {...reveal}>
                  <TheoryVideoPanel title={sectionTitle || section.title} embedUrl={section.embedUrl} videoUrl={section.videoUrl} />
                </motion.div>
              ) : null}

              <motion.div
                {...reveal}
                transition={{ ...reveal.transition, delay: 0.05 }}
                className="theory-reading-panel min-w-0 overflow-hidden bg-transparent p-0 sm:rounded-xl sm:border sm:border-slate-200 sm:bg-card sm:p-6 sm:shadow-sm dark:sm:border-slate-800"
              >
                <details className="mb-4 rounded-lg bg-sky-50/70 px-4 py-3 text-sm text-slate-600 dark:bg-sky-950/20 dark:text-slate-300 md:hidden">
                  <summary className="cursor-pointer font-medium text-slate-900 dark:text-white">Коротко про розділ</summary>
                  <p className="mt-3 leading-relaxed">{section.description || 'Розгорніть матеріал нижче, щоб прочитати повний зміст цього розділу.'}</p>
                </details>
                <TheoryRichContent html={section.contentHtml} />
              </motion.div>

              {!hasInlineImages ? (
                <motion.div {...reveal} transition={{ ...reveal.transition, delay: 0.08 }}>
                  <TheoryAssetGallery assets={section.assets} fallbackTitle={sectionTitle || section.title} />
                </motion.div>
              ) : null}

              {sections.length > 1 ? (
                <motion.div
                  {...reveal}
                  transition={{ ...reveal.transition, delay: 0.1 }}
                  className="mt-8 border-t border-slate-200 py-6 dark:border-slate-800"
                >
                  <div className="mb-3 flex w-full items-center justify-between gap-3 text-sm text-slate-500 dark:text-slate-300">
                    <span className="font-medium text-slate-900 dark:text-white">Розділи теорії</span>
                    <span>{currentIndex + 1} / {sections.length}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-10 w-10 shrink-0 rounded-full"
                      disabled={currentIndex <= 0}
                      onClick={() => currentIndex > 0 && goToSection(sections[currentIndex - 1].id)}
                      aria-label="Попередній розділ"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>

                    <div className="min-w-0 flex-1 overflow-x-auto pb-1 [scrollbar-width:thin]">
                      <div className="flex w-max items-center gap-2 px-1">
                        {sections.map((item, index) => {
                          const active = item.id === section.id;
                          const label = item.chapterNum || index + 1;
                          return (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => goToSection(item.id)}
                              className={
                                active
                                  ? 'flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-primary bg-primary text-sm font-medium text-white shadow-sm'
                                  : 'flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-background text-sm font-medium text-slate-700 transition-colors hover:border-primary/30 hover:bg-sky-50/70 dark:border-slate-800 dark:text-slate-100 dark:hover:bg-sky-950/20'
                              }
                              aria-label={`Розділ ${label}: ${item.title}`}
                              title={item.title}
                            >
                              {label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-10 w-10 shrink-0 rounded-full"
                      disabled={currentIndex < 0 || currentIndex >= sections.length - 1}
                      onClick={() => currentIndex >= 0 && currentIndex < sections.length - 1 && goToSection(sections[currentIndex + 1].id)}
                      aria-label="Наступний розділ"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </motion.div>
              ) : null}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
