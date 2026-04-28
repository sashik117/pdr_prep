import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  BookOpen,
  ChevronDown,
  ChevronUp,
  LampDesk,
  Paintbrush,
  Search,
  Shield,
  TrafficCone,
} from 'lucide-react';
import api from '@/api/apiClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

/** @typedef {{ key: string, title: string, summary: string, accent: string, icon: any }} TopicMeta */

/** @type {Record<string, TopicMeta>} */
const TOPIC_META = {
  rules: {
    key: 'rules',
    title: 'Правила дорожнього руху',
    summary: 'Повний список розділів ПДР для послідовного читання.',
    accent: 'from-sky-500 via-blue-500 to-cyan-400',
    icon: BookOpen,
  },
  'road-signs': {
    key: 'road-signs',
    title: 'Дорожні знаки',
    summary: 'Офіційні групи знаків у форматі окремих сторінок.',
    accent: 'from-orange-500 via-amber-500 to-yellow-400',
    icon: TrafficCone,
  },
  'road-markings': {
    key: 'road-markings',
    title: 'Дорожня розмітка',
    summary: 'Уся розмітка без зайвого шуму на екрані.',
    accent: 'from-emerald-500 via-green-500 to-lime-400',
    icon: Paintbrush,
  },
  regulator: {
    key: 'regulator',
    title: 'Регулювальник',
    summary: 'Сигнали регулювальника і логіка руху в одному місці.',
    accent: 'from-fuchsia-500 via-violet-500 to-purple-500',
    icon: Shield,
  },
  'traffic-light': {
    key: 'traffic-light',
    title: 'Світлофор',
    summary: 'Усі сигнали та повʼязані пояснення.',
    accent: 'from-rose-500 via-red-500 to-pink-500',
    icon: LampDesk,
  },
};

export default function Study() {
  const [openTopic, setOpenTopic] = useState('');
  const [search, setSearch] = useState('');

  const topicsQuery = useQuery({
    queryKey: ['handbook-topics'],
    queryFn: () => api.getHandbookTopics(),
    staleTime: 5 * 60 * 1000,
  });

  const entriesQuery = useQuery({
    queryKey: ['handbook-entries', openTopic],
    queryFn: () => api.getHandbookEntries(openTopic),
    enabled: Boolean(openTopic),
    staleTime: 5 * 60 * 1000,
  });

  const searchQuery = useQuery({
    queryKey: ['handbook-search', openTopic, search],
    queryFn: () => api.searchHandbook(search, openTopic),
    enabled: search.trim().length >= 2,
    staleTime: 30 * 1000,
  });

  const topics = useMemo(() => {
    const serverTopics = topicsQuery.data || [];
    return serverTopics.map((topic) => ({
      ...topic,
      ...TOPIC_META[topic.key],
    }));
  }, [topicsQuery.data]);

  const currentEntries = entriesQuery.data || [];
  const searchEntries = searchQuery.data || [];
  const visibleEntries = search.trim().length >= 2 ? searchEntries : currentEntries;

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 pb-10 sm:px-6">
      <Card className="overflow-hidden border-white/85 bg-[linear-gradient(135deg,rgba(20,107,255,0.08),rgba(255,255,255,1)_48%,rgba(239,246,255,0.96)_100%)] shadow-[0_24px_70px_rgba(15,23,42,0.06)] dark:border-slate-800 dark:bg-[linear-gradient(135deg,rgba(30,64,175,0.2),rgba(2,6,23,0.98)_52%,rgba(15,23,42,0.98))]">
        <CardContent className="p-6 sm:p-8">
          <div className="max-w-3xl">
            <p className="text-xs font-black uppercase tracking-[0.24em] text-primary">Довідник</p>
            <h1 className="mt-3 text-3xl font-black tracking-[-0.03em] text-slate-950 dark:text-white sm:text-4xl">
              Обери тему і читай окремо, без перевантаження
            </h1>
            <p className="mt-4 text-sm leading-8 text-slate-600 dark:text-slate-300 sm:text-base">
              Тут тільки список тем і розділів. Сам текст правил відкривається вже на окремій сторінці,
              щоб нічого не заважало читанню.
            </p>
          </div>

          <div className="mt-5 flex items-center gap-3 rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
            <Search className="h-4 w-4 text-slate-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Шукати по правилах, знаках, термінах..."
              className="w-full bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400 dark:text-slate-100"
            />
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {topics.map((topic) => {
          const Icon = topic.icon;
          const isOpen = openTopic === topic.key;

          return (
            <Card
              key={topic.key}
              className="overflow-hidden border-white/85 bg-white shadow-[0_16px_40px_rgba(15,23,42,0.05)] dark:border-slate-800 dark:bg-slate-950/92"
            >
              <button
                type="button"
                onClick={() => {
                  setOpenTopic((prev) => (prev === topic.key ? '' : topic.key));
                  setSearch('');
                }}
                className="block w-full text-left"
              >
                <CardHeader className="gap-4">
                  <div className="flex items-start gap-4">
                    <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${topic.accent} text-white shadow-lg`}>
                      <Icon className="h-5 w-5" />
                    </span>
                    <div className="min-w-0">
                      <CardTitle className="text-lg font-black text-slate-950 dark:text-white">
                        {topic.title}
                      </CardTitle>
                      <p className="mt-2 text-sm leading-7 text-slate-600 dark:text-slate-300">
                        {topic.summary}
                      </p>
                    </div>
                  </div>
                  <span className="inline-flex w-fit items-center rounded-2xl border border-slate-200 bg-white/90 px-4 py-2 text-sm font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
                    {isOpen ? 'Сховати розділи' : 'Показати розділи'}
                    {isOpen ? <ChevronUp className="ml-2 h-4 w-4" /> : <ChevronDown className="ml-2 h-4 w-4" />}
                  </span>
                </CardHeader>
              </button>

              {isOpen && (
                <CardContent className="space-y-3 border-t border-slate-100 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-950/40">
                  {entriesQuery.isLoading && search.trim().length < 2 ? (
                    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-6 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
                      Завантажую розділи...
                    </div>
                  ) : null}

                  {visibleEntries.length > 0 ? (
                    visibleEntries.map((entry, index) => (
                      <Link
                        key={entry.id}
                        to={`/study/${topic.key}/${entry.id}`}
                        className="block rounded-2xl border border-slate-200 bg-white px-4 py-4 text-left transition hover:border-primary/30 hover:shadow-sm dark:border-slate-800 dark:bg-slate-900/80"
                      >
                        <p className="text-sm font-bold text-slate-950 dark:text-white">{entry.section_title}</p>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                          {entry.chapter_num ? `Розділ ${entry.chapter_num}` : `Сторінка ${index + 1}`}
                        </p>
                      </Link>
                    ))
                  ) : !entriesQuery.isLoading ? (
                    <div className="rounded-2xl border border-dashed border-slate-300 bg-white/70 px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-300">
                      Поки що тут немає імпортованих матеріалів.
                    </div>
                  ) : null}
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
