import { useMemo, useState } from 'react';
import {
  BookOpen,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  LampDesk,
  Paintbrush,
  Shield,
  TrafficCone,
  X,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

/** @typedef {{ title: string, url: string }} TopicPage */
/** @typedef {{ title: string, icon: any, summary: string, accent: string, pages: TopicPage[] }} TheoryTopic */

const ruleSections = [
  '1. Загальні положення',
  '2. Обов’язки і права водіїв механічних транспортних засобів',
  '3. Рух транспортних засобів із спеціальними сигналами',
  '4. Обов’язки і права пішоходів',
  '5. Обов’язки і права пасажирів',
  '6. Вимоги до велосипедистів',
  '7. Вимоги до осіб, які керують гужовим транспортом, і погоничам тварин',
  '8. Регулювання дорожнього руху',
  '9. Попереджувальні сигнали',
  '10. Початок руху та зміна його напрямку',
  '11. Розташування транспортних засобів на дорозі',
  '12. Швидкість руху',
  '13. Дистанція, інтервал, зустрічний роз’їзд',
  '14. Обгін',
  '15. Зупинка і стоянка',
  '16. Проїзд перехресть',
  '17. Переваги маршрутних транспортних засобів',
  '18. Проїзд пішохідних переходів і зупинок транспортних засобів',
  '19. Користування зовнішніми світловими приладами',
  '20. Рух через залізничні переїзди',
  '21. Перевезення пасажирів',
  '22. Перевезення вантажу',
  '23. Буксирування і експлуатація транспортних складів',
  '24. Навчальна їзда',
  '25. Рух транспортних засобів у колонах',
  '26. Рух у житловій та пішохідній зоні',
  '27. Рух по автомагістралях і дорогах для автомобілів',
  '28. Рух по гірських дорогах і на крутих спусках',
  '29. Міжнародний рух',
  '30. Номерні, розпізнавальні знаки, написи і позначення',
  '31. Технічний стан транспортних засобів та їх обладнання',
  '32. Окремі питання дорожнього руху, що вимагають узгодження',
  '33. Дорожні знаки',
  '34. Дорожня розмітка',
  '35. Медицина',
];

/** @type {TheoryTopic[]} */
const topics = [
  {
    title: 'Правила дорожнього руху',
    icon: BookOpen,
    summary: 'Повний офіційний текст ПДР по розділах. Натискаєш підрозділ і відкриваєш саме офіційний матеріал.',
    accent: 'from-sky-500 via-blue-500 to-cyan-400',
    pages: ruleSections.map((title, index) => ({
      title,
      url: `https://pdr.infotech.gov.ua/theory/rules/${index + 1}`,
    })),
  },
  {
    title: 'Дорожні знаки',
    icon: TrafficCone,
    summary: 'Офіційний довідник знаків із категоріями, зображеннями та поясненнями.',
    accent: 'from-orange-500 via-amber-500 to-yellow-400',
    pages: [{ title: 'Усі дорожні знаки', url: 'https://pdr.infotech.gov.ua/theory/road-signs' }],
  },
  {
    title: 'Дорожня розмітка',
    icon: Paintbrush,
    summary: 'Офіційний розділ із горизонтальною та вертикальною розміткою, номерами і поясненнями.',
    accent: 'from-emerald-500 via-green-500 to-lime-400',
    pages: [
      { title: 'Уся дорожня розмітка', url: 'https://pdr.infotech.gov.ua/theory/road-markings' },
      { title: 'Розділ 34. Дорожня розмітка', url: 'https://pdr.infotech.gov.ua/theory/rules/34' },
    ],
  },
  {
    title: 'Регулювальник',
    icon: Shield,
    summary: 'Офіційний матеріал про сигнали регулювальника, пріоритет та алгоритм проїзду.',
    accent: 'from-fuchsia-500 via-violet-500 to-purple-500',
    pages: [
      { title: 'Сигнали регулювальника', url: 'https://pdr.infotech.gov.ua/theory/regulator' },
      { title: 'Розділ 8. Регулювання дорожнього руху', url: 'https://pdr.infotech.gov.ua/theory/rules/8' },
    ],
  },
  {
    title: 'Світлофор',
    icon: LampDesk,
    summary: 'Офіційний блок про транспортні, пішохідні, реверсивні, трамвайні та переїзні світлофори.',
    accent: 'from-rose-500 via-red-500 to-pink-500',
    pages: [{ title: 'Усі сигнали світлофора', url: 'https://pdr.infotech.gov.ua/theory/traffic-light' }],
  },
];

export default function Study() {
  const [openTopic, setOpenTopic] = useState(topics[0].title);
  const [selectedPage, setSelectedPage] = useState(topics[0].pages[0]);
  const [viewerOpen, setViewerOpen] = useState(false);

  const currentTopic = useMemo(
    () => topics.find((topic) => topic.title === openTopic) ?? topics[0],
    [openTopic]
  );

  const currentPages = currentTopic.pages;

  const openViewer = (page) => {
    setSelectedPage(page);
    setViewerOpen(true);
  };

  return (
    <>
      <div className="mx-auto max-w-6xl space-y-6">
        <Card className="overflow-hidden border-white/85 bg-[linear-gradient(135deg,rgba(20,107,255,0.08),rgba(255,255,255,1)_48%,rgba(239,246,255,0.96)_100%)] shadow-[0_24px_70px_rgba(15,23,42,0.06)] dark:border-slate-800 dark:bg-[linear-gradient(135deg,rgba(30,64,175,0.2),rgba(2,6,23,0.98)_52%,rgba(15,23,42,0.98))]">
          <CardContent className="p-6 sm:p-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="max-w-3xl">
                <p className="text-xs font-black uppercase tracking-[0.24em] text-primary">Довідники</p>
                <h1 className="mt-3 text-3xl font-black tracking-[-0.03em] text-slate-950 dark:text-white sm:text-4xl">
                  Офіційна теорія ГСЦ МВС
                </h1>
                <p className="mt-4 text-sm leading-8 text-slate-600 dark:text-slate-300 sm:text-base">
                  Вибираєш тему, потім підрозділ, і матеріал відкривається поверх усього екрана в окремому вікні.
                </p>
              </div>

              <a
                href="https://pdr.infotech.gov.ua/theory"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-2xl border border-primary/20 bg-white/85 px-4 py-3 text-sm font-semibold text-primary shadow-sm transition hover:bg-white dark:border-sky-500/20 dark:bg-slate-900/80 dark:text-sky-200 dark:hover:bg-slate-900"
              >
                <ExternalLink className="h-4 w-4" />
                Офіційне джерело
              </a>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          {topics.map((topic) => {
            const isOpen = openTopic === topic.title;
            const Icon = topic.icon;

            return (
              <Card
                key={topic.title}
                className="overflow-hidden border-white/85 bg-white shadow-[0_16px_40px_rgba(15,23,42,0.05)] dark:border-slate-800 dark:bg-slate-950/92"
              >
                <button
                  type="button"
                  onClick={() => {
                    const nextOpen = isOpen ? '' : topic.title;
                    setOpenTopic(nextOpen);
                    if (!isOpen) {
                      setSelectedPage(topic.pages[0]);
                    }
                  }}
                  className="w-full text-left"
                >
                  <CardHeader className="gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-start gap-4">
                      <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${topic.accent} text-white shadow-lg`}>
                        <Icon className="h-5 w-5" />
                      </span>
                      <div>
                        <CardTitle className="text-lg font-black text-slate-950 dark:text-white sm:text-xl">
                          {topic.title}
                        </CardTitle>
                        <p className="mt-2 text-sm leading-7 text-slate-600 dark:text-slate-300">
                          {topic.summary}
                        </p>
                      </div>
                    </div>

                    <Button
                      type="button"
                      variant="outline"
                      className="mt-1 shrink-0 border-slate-200 bg-white/90 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                    >
                      {isOpen ? 'Сховати' : 'Відкрити'}
                      {isOpen ? <ChevronUp className="ml-2 h-4 w-4" /> : <ChevronDown className="ml-2 h-4 w-4" />}
                    </Button>
                  </CardHeader>
                </button>

                {isOpen && (
                  <CardContent className="space-y-4 border-t border-slate-100 bg-slate-50/70 p-6 dark:border-slate-800 dark:bg-slate-950/40">
                    <div className="flex flex-wrap gap-2">
                      {currentPages.map((page) => {
                        const isActive = selectedPage.url === page.url;
                        return (
                          <button
                            key={page.url}
                            type="button"
                            onClick={() => openViewer(page)}
                            className={`rounded-2xl border px-4 py-2 text-left text-sm font-semibold transition ${
                              isActive
                                ? 'border-primary bg-primary text-white shadow-sm'
                                : 'border-slate-200 bg-white text-slate-700 hover:border-primary/30 hover:text-primary dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-sky-500/30 dark:hover:text-sky-200'
                            }`}
                          >
                            {page.title}
                          </button>
                        );
                      })}
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      </div>

      {viewerOpen && (
        <div className="fixed inset-0 z-[9999] flex h-screen w-screen flex-col overflow-hidden bg-slate-950">
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 bg-slate-900/95 px-4 py-4 text-white backdrop-blur-md sm:px-8">
            <div className="min-w-0">
              <p className="truncate text-lg font-black uppercase tracking-tight sm:text-xl">
                {selectedPage.title}
              </p>
              <p className="hidden truncate text-xs text-slate-400 sm:block">
                Офіційне джерело навчання
              </p>
            </div>

            <div className="flex items-center gap-3">
              <a
                href={selectedPage.url}
                target="_blank"
                rel="noopener noreferrer"
                className="hidden items-center gap-2 rounded-xl bg-white/10 px-4 py-2 text-sm font-medium transition-colors hover:bg-white/20 sm:flex"
              >
                <span>Відкрити окремо</span>
              </a>

              <button
                type="button"
                onClick={() => setViewerOpen(false)}
                className="flex h-12 w-12 items-center justify-center rounded-full bg-red-500 text-white shadow-lg transition-transform hover:scale-110 active:scale-95"
                aria-label="Закрити"
              >
                <X className="h-7 w-7" strokeWidth={3} />
              </button>
            </div>
          </div>

          <div className="h-full w-full flex-1 overflow-hidden bg-white">
            <iframe
              key={selectedPage.url}
              src={selectedPage.url}
              title={selectedPage.title}
              className="h-full w-full border-0"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
        </div>
      )}
    </>
  );
}
