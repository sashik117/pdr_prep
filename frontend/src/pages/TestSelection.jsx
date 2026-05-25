// @ts-nocheck
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  ChevronDown,
  CircleAlert,
  ClipboardCheck,
  Crown,
  FileCheck2,
  ListChecks,
  Medal,
  Star,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/AuthContext';
import { canStartFreeTest, getRemainingFreeTests } from '@/lib/accessLimits';
import { categoryGroups } from '@/lib/testCatalog';

const modes = [
  {
    id: 'quick',
    icon: ClipboardCheck,
    label: 'Швидкий тест',
    desc: '10 питань для короткої перевірки знань.',
    questions: 10,
  },
  {
    id: 'full',
    icon: FileCheck2,
    label: 'Тренування 20 питань',
    desc: 'Рандомна добірка для обраної категорії без імітації офіційного білета.',
    questions: 20,
  },
  {
    id: 'mvs',
    icon: Medal,
    label: 'Іспит МВС',
    desc: '20 питань за офіційною логікою блоків: ПДР, безпека, будова та домедична допомога.',
    questions: 20,
    premium: true,
  },
  {
    id: 'difficult',
    icon: CircleAlert,
    label: 'Мої помилки',
    desc: 'Питання, у яких у Вас раніше були неправильні відповіді.',
    questions: 10,
    auth: true,
  },
  {
    id: 'top',
    icon: Star,
    label: 'Топ 100 помилок',
    desc: 'Добірка складних питань, які варто повторити перед іспитом.',
    questions: 20,
  },
];

const reveal = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
};

export default function TestSelection() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const requestedMode = params.get('mode') || 'quick';
  const requestedCategory = params.get('category') || 'B';
  const [selectedMode, setSelectedMode] = useState(modes.some((item) => item.id === requestedMode) ? requestedMode : 'quick');
  const [selectedCategory, setSelectedCategory] = useState(
    categoryGroups.some((item) => item.id === requestedCategory) ? requestedCategory : 'B',
  );
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [limitOpen, setLimitOpen] = useState(false);
  const [limitText, setLimitText] = useState('');

  const currentMode = modes.find((item) => item.id === selectedMode) || modes[0];
  const selectedCategoryMeta = categoryGroups.find((item) => item.id === selectedCategory) || categoryGroups[1];
  const SelectedCategoryIcon = selectedCategoryMeta.icon;

  const openLimit = (text) => {
    setLimitText(text);
    setLimitOpen(true);
  };

  const canStartMode = (modeId) => {
    const mode = modes.find((item) => item.id === modeId);
    if (mode?.premium && !user?.is_premium) {
      openLimit('Іспит МВС доступний у Premium. Так Ви отримуєте повну імітацію білета без денних обмежень.');
      return false;
    }
    if (mode?.auth && !user) {
      openLimit('Для роботи з Вашими помилками потрібно увійти в профіль, щоб ми знали, які питання повторити.');
      return false;
    }
    if (!canStartFreeTest(user, modeId)) {
      openLimit('Сьогодні безкоштовні спроби для цього режиму вже використані. Premium відкриває тренування без лімітів.');
      return false;
    }
    return true;
  };

  const handleStart = (modeId = selectedMode) => {
    if (!canStartMode(modeId)) return;
    const query = new URLSearchParams({ mode: modeId });
    if (selectedCategory) query.set('category', selectedCategory);
    navigate(`/test?${query.toString()}`);
  };

  const selectCategory = (categoryId) => {
    setSelectedCategory(categoryId);
    setCategoryOpen(false);
  };

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5 pb-6">
      <section className="space-y-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">Режими тестування</p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-950 dark:text-white">Оберіть формат проходження</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300">
            Спершу виберіть категорію посвідчення, потім режим. Для окремих тем є самостійна сторінка тестів по розділах.
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          {modes.map((mode, index) => (
            <motion.button
              key={mode.id}
              type="button"
              {...reveal}
              transition={{ delay: index * 0.04, duration: 0.24 }}
              className={cn(
                'rounded-xl border p-4 text-left transition-colors',
                selectedMode === mode.id
                  ? 'border-primary bg-primary/5 text-slate-950 dark:border-sky-500/40 dark:bg-sky-500/10 dark:text-white'
                  : 'border-slate-200 bg-card text-slate-900 hover:border-primary/30 dark:border-slate-800 dark:text-white dark:hover:border-sky-500/30',
              )}
              onClick={() => setSelectedMode(mode.id)}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                  <mode.icon className="h-5 w-5" />
                </div>
                <Badge variant="outline" className="border-slate-200 bg-transparent text-slate-600 dark:border-slate-700 dark:bg-transparent dark:text-slate-300">
                  {mode.premium ? <Crown className="mr-1 h-3.5 w-3.5 text-amber-500" /> : null}
                  {mode.questions} питань
                </Badge>
              </div>
              <h2 className="mt-4 text-base font-medium">{mode.label}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{mode.desc}</p>
            </motion.button>
          ))}
        </div>
      </section>

      <section className="space-y-4 rounded-xl border border-slate-200 bg-card p-4 dark:border-slate-800 sm:p-5">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">Категорія посвідчення</p>
          <h2 className="mt-1 text-xl font-medium text-slate-950 dark:text-white">Оберіть свою категорію</h2>
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

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.42fr)]">
        <div className="flex flex-col gap-4 rounded-xl border border-primary/20 bg-card p-4 dark:border-sky-500/30 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-300">Готово до старту</p>
            <h3 className="mt-1 text-2xl font-semibold text-slate-950 dark:text-white">{currentMode.label}</h3>
            <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">
              Категорія {selectedCategory}. {currentMode.premium && !user?.is_premium ? 'Потрібен Premium-доступ.' : 'Можна починати, коли Вам зручно.'}
            </p>
            {!user?.is_premium && !currentMode.premium ? (
              <p className="mt-2 text-xs font-semibold uppercase tracking-[0.18em] text-amber-600 dark:text-amber-300">
                Free: ще {getRemainingFreeTests(user, selectedMode)} із 3 спроб сьогодні
              </p>
            ) : null}
          </div>

          <Button className="w-full rounded-lg text-base sm:w-auto sm:px-8" onClick={() => handleStart(selectedMode)}>
            Почати
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </div>

        <button
          type="button"
          className="rounded-xl border border-slate-200 bg-card p-4 text-left transition-colors hover:border-primary/30 dark:border-slate-800 dark:hover:border-sky-500/30"
          onClick={() => navigate(`/section-tests?category=${selectedCategory}`)}
        >
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <ListChecks className="h-5 w-5" />
            </span>
            <span>
              <span className="block text-base font-medium text-slate-950 dark:text-white">Тести по розділах</span>
              <span className="mt-1 block text-sm leading-6 text-slate-600 dark:text-slate-300">
                Оберіть конкретну тему та повторіть її окремо.
              </span>
            </span>
          </div>
        </button>
      </section>

      <Dialog open={limitOpen} onOpenChange={setLimitOpen}>
        <DialogContent className="rounded-xl border-slate-200 bg-card text-slate-950 dark:border-slate-800 dark:text-white">
          <DialogTitle>Потрібен доступ</DialogTitle>
          <DialogDescription>{limitText}</DialogDescription>
          <div className="flex flex-col gap-3 pt-2 sm:flex-row">
            <Button className="rounded-lg px-6" onClick={() => navigate('/pricing')}>Перейти до Premium</Button>
            <Button variant="outline" className="rounded-lg px-6" onClick={() => setLimitOpen(false)}>Пізніше</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
