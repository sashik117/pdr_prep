import { useEffect, useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react';
import api from '@/api/apiClient';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

function normalizeText(value) {
  return String(value || '')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripTrailingDuplicate(text, sectionTitle = '') {
  let next = normalizeText(text);
  if (!next) return '';

  const title = normalizeText(sectionTitle);
  if (title) {
    const escapedTitle = title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    next = next.replace(new RegExp(`\\s+${escapedTitle}$`, 'i'), '').trim();
  }

  const firstToken = next.match(/^((?:\d+\.)+\d+|\d+\.\d+|\d+|[A-Za-zА-Яа-яІіЇїЄєҐґ'’-]+)/)?.[1];
  const lastToken = next.match(/((?:\d+\.)+\d+|\d+\.\d+|\d+|[A-Za-zА-Яа-яІіЇїЄєҐґ'’-]+)$/)?.[1];
  if (firstToken && lastToken && firstToken.toLowerCase() === lastToken.toLowerCase()) {
    next = next.slice(0, next.length - lastToken.length).trim();
  }

  return next.replace(/\s+/g, ' ').trim();
}

function dedupeSiblingNodes(root, getSignature) {
  if (!root) return;
  const seen = new Set();
  Array.from(root.children).forEach((node) => {
    const signature = getSignature(node);
    if (!signature) return;
    if (seen.has(signature)) {
      node.remove();
      return;
    }
    seen.add(signature);
  });
}

function sanitizeHandbookHtml(html, sectionTitle) {
  if (!html || typeof DOMParser === 'undefined') return html || '';

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(String(html), 'text/html');
    const body = doc.body;
    const titleNormalized = normalizeText(sectionTitle).toLowerCase();

    Array.from(body.querySelectorAll('script, style, noscript, nav')).forEach((node) => node.remove());

    Array.from(body.querySelectorAll('a')).forEach((link) => {
      const text = normalizeText(link.textContent);
      if (/^\d{1,2}$/.test(text)) {
        link.removeAttribute('href');
      }
    });

    Array.from(body.querySelectorAll('h1, h2')).forEach((heading) => {
      const text = normalizeText(heading.textContent).toLowerCase();
      if (!text || text === titleNormalized) {
        heading.remove();
      }
    });

    Array.from(body.querySelectorAll('p, li, div')).forEach((node) => {
      const text = normalizeText(node.textContent);
      const normalized = text.toLowerCase();
      const anchors = Array.from(node.querySelectorAll('a'));
      const anchorText = normalizeText(anchors.map((item) => item.textContent).join(' '));

      if (!text) {
        node.remove();
        return;
      }

      if (/^(?:\d{1,2}\s*){8,}$/.test(text) || /^(?:\d{1,2}\s*){8,}$/.test(anchorText)) {
        node.remove();
        return;
      }

      if (titleNormalized && (normalized === titleNormalized || normalized === `${titleNormalized}.` || normalized === `${titleNormalized}:`)) {
        node.remove();
        return;
      }

      const cleaned = stripTrailingDuplicate(text, sectionTitle);
      if (!cleaned) {
        node.remove();
        return;
      }

      if (cleaned !== text && node.children.length === 0) {
        node.textContent = cleaned;
      }
    });

    dedupeSiblingNodes(body, (node) => {
      const text = normalizeText(node.textContent).toLowerCase();
      return text ? `${node.tagName}:${text}` : '';
    });

    Array.from(body.querySelectorAll('div, section, article')).forEach((container) => {
      dedupeSiblingNodes(container, (node) => {
        const text = normalizeText(node.textContent).toLowerCase();
        return text ? `${node.tagName}:${text}` : '';
      });
    });

    return body.innerHTML.trim();
  } catch {
    return html || '';
  }
}

function hasRealContent(entry) {
  const html = normalizeText(entry?.content_html || '').replace(/<[^>]+>/g, ' ').trim();
  const text = normalizeText(entry?.content_text || '');
  return (html && html.length > 40) || (text && text.length > 40);
}

function pageBadge(entry, index) {
  if (entry?.chapter_num) return String(entry.chapter_num);
  return String(index + 1);
}

export default function StudyChapter() {
  const navigate = useNavigate();
  const { topicKey = 'rules', entryId = '' } = useParams();
  const numericEntryId = Number(entryId);
  const paginationRef = useRef(null);
  const activePageRef = useRef(null);

  const entriesQuery = useQuery({
    queryKey: ['handbook-entries', topicKey],
    queryFn: () => api.getHandbookEntries(topicKey),
    enabled: Boolean(topicKey),
    staleTime: 5 * 60 * 1000,
  });

  const entryQuery = useQuery({
    queryKey: ['handbook-entry', numericEntryId],
    queryFn: () => api.getHandbookEntry(numericEntryId),
    enabled: Number.isFinite(numericEntryId) && numericEntryId > 0,
    staleTime: 5 * 60 * 1000,
  });

  const entries = entriesQuery.data || [];
  const selectedEntry = entryQuery.data;
  const currentIndex = entries.findIndex((entry) => entry.id === numericEntryId);

  const sanitizedHtml = useMemo(() => {
    return sanitizeHandbookHtml(selectedEntry?.content_html || '', selectedEntry?.section_title || '');
  }, [selectedEntry?.content_html, selectedEntry?.section_title]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [numericEntryId]);

  useEffect(() => {
    const strip = paginationRef.current;
    const active = activePageRef.current;
    if (!strip || !active) return;

    const targetLeft = active.offsetLeft - strip.clientWidth / 2 + active.clientWidth / 2;
    strip.scrollTo({ left: Math.max(0, targetLeft), behavior: 'smooth' });
  }, [numericEntryId]);

  useEffect(() => {
    const node = paginationRef.current;
    if (!node) return undefined;

    const handleWheel = (event) => {
      if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
      node.scrollLeft += event.deltaY;
      event.preventDefault();
    };

    node.addEventListener('wheel', handleWheel, { passive: false });
    return () => node.removeEventListener('wheel', handleWheel);
  }, [entries.length]);

  const goToEntry = (nextEntryId) => {
    navigate(`/study/${topicKey}/${nextEntryId}`);
  };

  const goPrev = () => {
    if (currentIndex > 0) {
      goToEntry(entries[currentIndex - 1].id);
    }
  };

  const goNext = () => {
    if (currentIndex >= 0 && currentIndex < entries.length - 1) {
      goToEntry(entries[currentIndex + 1].id);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 pb-10 sm:px-6">
      <div className="flex items-center gap-3">
        <Button asChild variant="outline" className="rounded-2xl">
          <Link to="/study">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Назад до списку
          </Link>
        </Button>
      </div>

      <Card className="overflow-hidden border-white/85 bg-white shadow-[0_16px_40px_rgba(15,23,42,0.05)] dark:border-slate-800 dark:bg-slate-950/92">
        <CardHeader className="border-b border-slate-100 bg-[linear-gradient(135deg,rgba(255,255,255,0.98),rgba(239,246,255,0.98))] dark:border-slate-800 dark:bg-[linear-gradient(135deg,rgba(14,31,71,0.98),rgba(10,21,45,0.98))]">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-sky-700/80 dark:text-sky-200/80">
              Довідник
            </p>
            <h1 className="mt-2 text-2xl font-black tracking-[-0.02em] text-slate-950 dark:text-white sm:text-3xl">
              {selectedEntry?.section_title || 'Завантаження розділу'}
            </h1>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {entryQuery.isError ? (
            <div className="p-6 sm:p-8">
              <div className="rounded-3xl border border-rose-200 bg-rose-50 p-6 text-rose-900 shadow-sm dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-100">
                <h2 className="text-xl font-black">Не вдалося відкрити розділ</h2>
                <p className="mt-3 text-sm leading-7">
                  Схоже, цей запис у довіднику пошкоджений або ще не переімпортований. Після очищення
                  `handbook_data` і нового імпорту він має запрацювати нормально.
                </p>
              </div>
            </div>
          ) : entryQuery.isLoading ? (
            <div className="px-6 py-12 text-sm text-slate-600 dark:text-slate-300">
              Завантажую розділ довідника...
            </div>
          ) : selectedEntry ? (
            hasRealContent(selectedEntry) ? (
              <div className="p-6 sm:p-8">
                <div className="rounded-[2rem] border border-slate-200 bg-slate-50/75 p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/70">
                  <div
                    className={cn(
                      '[&_h1]:hidden [&_h2]:hidden [&_h3]:mb-3 [&_h3]:mt-6 [&_h3]:text-xl [&_h3]:font-bold [&_h3]:text-slate-900 dark:[&_h3]:text-slate-100',
                      '[&_p]:mb-4 [&_p]:leading-8 [&_p]:text-slate-700 dark:[&_p]:text-slate-200',
                      '[&_ul]:mb-5 [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-6 [&_ul]:text-slate-700 dark:[&_ul]:text-slate-200',
                      '[&_ol]:mb-5 [&_ol]:list-decimal [&_ol]:space-y-2 [&_ol]:pl-6 [&_ol]:text-slate-700 dark:[&_ol]:text-slate-200',
                      '[&_li]:leading-7',
                      '[&_a]:font-semibold [&_a]:text-primary [&_a]:no-underline',
                      '[&_img]:my-5 [&_img]:max-w-full [&_img]:rounded-2xl [&_img]:border [&_img]:border-slate-200 dark:[&_img]:border-slate-700',
                      '[&_table]:mb-5 [&_table]:w-full [&_table]:border-collapse [&_table]:overflow-hidden [&_table]:rounded-2xl',
                      '[&_td]:border [&_td]:border-slate-200 [&_td]:p-3 dark:[&_td]:border-slate-700',
                      '[&_th]:border [&_th]:border-slate-200 [&_th]:bg-slate-50 [&_th]:p-3 [&_th]:text-left dark:[&_th]:border-slate-700 dark:[&_th]:bg-slate-800'
                    )}
                    dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
                  />
                </div>

                {entries.length > 1 ? (
                  <div className="mt-8 flex flex-col items-center gap-4 border-t border-slate-200 py-6 dark:border-white/10">
                    <div className="flex w-full max-w-md items-center justify-between text-sm text-slate-500 dark:text-slate-300">
                      <span>Навігація по розділах</span>
                      <span>{currentIndex + 1} / {entries.length}</span>
                    </div>

                    <div className="flex w-full max-w-md items-center justify-center gap-3">
                      <button
                        type="button"
                        onClick={goPrev}
                        disabled={currentIndex <= 0}
                        className="shrink-0 rounded-full border border-slate-200 bg-white p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-35 dark:border-white/10 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white"
                      >
                        <ChevronLeft className="h-5 w-5" />
                      </button>

                      <div
                        ref={paginationRef}
                        className="flex max-w-full gap-2 overflow-x-auto py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                      >
                        {entries.map((entry, index) => {
                          const active = entry.id === numericEntryId;
                          return (
                            <button
                              key={entry.id}
                              type="button"
                              onClick={() => goToEntry(entry.id)}
                              ref={active ? activePageRef : null}
                              className={cn(
                                'h-10 w-10 shrink-0 rounded-full border text-sm font-medium transition',
                                active
                                  ? 'border-sky-300 bg-sky-400 text-slate-950 shadow-[0_10px_25px_rgba(56,189,248,0.35)]'
                                  : 'border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-200 dark:border-white/10 dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700'
                              )}
                              title={entry.section_title}
                            >
                              {pageBadge(entry, index)}
                            </button>
                          );
                        })}
                      </div>

                      <button
                        type="button"
                        onClick={goNext}
                        disabled={currentIndex < 0 || currentIndex >= entries.length - 1}
                        className="shrink-0 rounded-full border border-slate-200 bg-white p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-35 dark:border-white/10 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white"
                      >
                        <ChevronRight className="h-5 w-5" />
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="p-6 sm:p-8">
                <div className="rounded-3xl border border-amber-200 bg-amber-50 p-6 text-slate-800 shadow-sm dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
                  <h2 className="text-xl font-black">Розділ імпортований некоректно</h2>
                  <p className="mt-3 text-sm leading-7">
                    У базі для цього підрозділу зараз збережений тільки заголовок або пошкоджений текст.
                    Треба переімпортувати довідник оновленим скриптом, і тоді тут зʼявиться повний контент.
                  </p>
                </div>
              </div>
            )
          ) : (
            <div className="p-6 sm:p-8">
              <div className="rounded-3xl border border-dashed border-slate-300 bg-white/75 p-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-300">
                Не вдалося знайти цей розділ.
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
