// @ts-nocheck
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Award, CheckCircle2, Lock, Sparkles, Trophy } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { useProtectedScreen } from '@/lib/useProtectedScreen';
import api from '@/api/apiClient';
import { TIER_COLORS } from '@/lib/achievements';

const categories = [
  { id: 'all', label: 'Усі' },
  { id: 'tests', label: 'Тести' },
  { id: 'correct', label: 'Відповіді' },
  { id: 'streak', label: 'Серія' },
  { id: 'marathon', label: 'Марафон' },
  { id: 'perfect', label: 'Без помилок' },
  { id: 'exam', label: 'Іспит' },
  { id: 'accuracy', label: 'Точність' },
  { id: 'battle', label: 'Батли' },
  { id: 'battle_wins', label: 'Перемоги' },
];

export default function Achievements() {
  const navigate = useNavigate();
  const { user, isCheckingAccess, canAccess, navigateToLogin, navigateToRegister, checkUserAuth } = useProtectedScreen();
  const [filterCategory, setFilterCategory] = useState('all');
  const [featuredIds, setFeaturedIds] = useState(user?.featured_achievements || []);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setFeaturedIds(user?.featured_achievements || []);
  }, [user?.featured_achievements]);

  const achievementsQuery = useQuery({
    queryKey: ['achievements'],
    queryFn: () => api.getAchievements(),
    enabled: !!user,
  });

  const achievements = achievementsQuery.data || [];
  const earnedAchievements = useMemo(() => achievements.filter((achievement) => achievement.earned), [achievements]);
  const earnedCount = earnedAchievements.length;
  const totalProgress = achievements.length ? Math.round((earnedCount / achievements.length) * 100) : 0;

  const filtered = useMemo(
    () => (filterCategory === 'all' ? achievements : achievements.filter((achievement) => achievement.category === filterCategory)),
    [achievements, filterCategory],
  );

  const showcaseAchievements = useMemo(
    () => featuredIds.map((id) => earnedAchievements.find((achievement) => achievement.id === id)).filter(Boolean),
    [earnedAchievements, featuredIds],
  );

  const toggleFeatured = (achievementId) => {
    setFeaturedIds((current) => {
      if (current.includes(achievementId)) return current.filter((item) => item !== achievementId);
      if (current.length >= 4) return [...current.slice(1), achievementId];
      return [...current, achievementId];
    });
  };

  const saveShowcase = async () => {
    setSaving(true);
    try {
      await api.updateProfile({ featured_achievements: featuredIds });
      await checkUserAuth();
    } finally {
      setSaving(false);
    }
  };

  if (isCheckingAccess) {
    return (
      <div className="flex justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary/30 border-t-primary" />
      </div>
    );
  }

  if (!canAccess || !user) {
    return (
      <div className="mx-auto max-w-xl px-4 py-14 text-center sm:py-20">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-950 dark:text-slate-200 dark:hover:bg-slate-900 dark:hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Назад
        </button>
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-900">
          <Lock className="h-7 w-7 text-slate-500 dark:text-slate-300" />
        </div>
        <h2 className="mt-5 text-2xl font-semibold tracking-[-0.03em] text-slate-900 dark:text-white">Досягнення відкриваються після входу</h2>
        <p className="mt-3 text-sm leading-7 text-slate-500 dark:text-slate-300">
          Увійдіть, щоб бачити прогрес нагород, серії, рекорди й обирати бейджі для профілю.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Button onClick={() => navigateToLogin('/achievements')}>Увійти</Button>
          <Button variant="outline" onClick={() => navigateToRegister('/achievements')}>Реєстрація</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="-ml-2 inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-950 dark:text-slate-200 dark:hover:bg-slate-900 dark:hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" />
        Назад
      </button>

      <motion.section
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]"
      >
        <Card className="border-slate-200 bg-card shadow-md dark:border-slate-800">
          <CardContent className="p-5 sm:p-6">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-100 text-amber-600 dark:bg-amber-950/35 dark:text-amber-200">
                <Trophy className="h-6 w-6" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-600 dark:text-amber-300">Колекція нагород</p>
                <h1 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-slate-950 dark:text-white sm:text-3xl">Мої досягнення</h1>
                <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-600 dark:text-slate-300">
                  Кожна нагорода відкривається автоматично, коли Ви виконуєте умову. Прогрес показано просто: скільки вже є і скільки потрібно.
                </p>
              </div>
            </div>

            <div className="mt-5">
              <div className="mb-2 flex items-center justify-between text-sm font-semibold text-slate-700 dark:text-slate-200">
                <span>{earnedCount}/{achievements.length} відкрито</span>
                <span>{totalProgress}%</span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-amber-400 via-sky-500 to-emerald-500"
                  initial={{ width: 0 }}
                  animate={{ width: `${totalProgress}%` }}
                  transition={{ duration: 0.65, ease: 'easeOut' }}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-card shadow-md dark:border-slate-800">
          <CardContent className="p-5 sm:p-6">
            <div className="mb-4 flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              <p className="font-semibold text-slate-950 dark:text-white">Вітрина профілю</p>
            </div>
            <div className="min-h-16 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900/60">
              <div className="flex flex-wrap gap-2">
                {showcaseAchievements.length > 0 ? (
                  showcaseAchievements.map((achievement) => <ShowcaseBadge key={achievement.id} achievement={achievement} />)
                ) : (
                  <p className="text-sm leading-6 text-slate-500 dark:text-slate-300">
                    Натисніть на отриману нагороду нижче, щоб показати її у профілі.
                  </p>
                )}
              </div>
            </div>
            <Button className="mt-4 rounded-xl" disabled={saving} onClick={() => void saveShowcase()}>
              {saving ? 'Зберігаємо...' : 'Зберегти вітрину'}
            </Button>
          </CardContent>
        </Card>
      </motion.section>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {categories.map((category) => (
          <button
            key={category.id}
            onClick={() => setFilterCategory(category.id)}
            className={cn(
              'shrink-0 rounded-full border px-3.5 py-2 text-xs font-semibold transition-all sm:text-sm',
              filterCategory === category.id
                ? 'border-primary bg-primary text-primary-foreground shadow-[0_10px_22px_rgba(37,99,235,0.2)]'
                : 'border-slate-200 bg-white text-slate-600 hover:border-primary/30 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100',
            )}
          >
            {category.label}
          </button>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {filtered.map((achievement, index) => (
          <AchievementCard
            key={achievement.id}
            achievement={achievement}
            index={index}
            featured={featuredIds.includes(achievement.id)}
            onToggleFeatured={() => toggleFeatured(achievement.id)}
          />
        ))}
      </div>
    </div>
  );
}

function AchievementCard({ achievement, index, featured, onToggleFeatured }) {
  const colors = TIER_COLORS[achievement.tier] || TIER_COLORS[1];
  const current = Number(achievement.current ?? achievement.raw_current ?? 0);
  const target = Number(achievement.target ?? achievement.threshold ?? 1);
  const percent = Math.min(100, Math.max(0, Number(achievement.progress_percent ?? Math.round((current / Math.max(1, target)) * 100))));

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.025 }}>
      <Card
        className={cn(
          'h-full border-slate-200 bg-card shadow-md transition-all dark:border-slate-800',
          achievement.earned ? 'opacity-100' : 'opacity-90',
          featured && 'ring-2 ring-primary/30',
        )}
      >
        <CardContent className="flex h-full flex-col p-5 pt-6">
          <div className="flex items-start gap-4">
            <div className={cn('flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border shadow-sm', colors.bg, colors.text, colors.border)}>
              {achievement.earned ? <CheckCircle2 className="h-6 w-6" /> : <Award className="h-6 w-6" />}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-semibold text-slate-950 dark:text-white">{achievement.name}</h3>
                <span className={cn('rounded-full border px-2 py-0.5 text-[11px] font-semibold', colors.bg, colors.text, colors.border)}>
                  {colors.label}
                </span>
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{achievement.description}</p>
            </div>
          </div>

          <div className="mt-5">
            <div className="mb-2 flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-300">
              <span>{achievement.earned ? 'Відкрито' : 'Прогрес'}</span>
              <span>{achievement.progress_text || `${Math.min(current, target)}/${target}`}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
              <div className={cn('h-full rounded-full transition-all duration-500', achievement.earned ? 'bg-emerald-500' : 'bg-primary')} style={{ width: `${percent}%` }} />
            </div>
          </div>

          <div className="mt-auto pt-5">
            {achievement.earned ? (
              <button
                type="button"
                className={cn(
                  'rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors',
                  featured
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-950/35 dark:text-emerald-200',
                )}
                onClick={onToggleFeatured}
              >
                {featured ? 'На вітрині' : 'Додати у вітрину'}
              </button>
            ) : (
              <span className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                Ще не відкрито
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function ShowcaseBadge({ achievement }) {
  const colors = TIER_COLORS[achievement.tier] || TIER_COLORS[1];
  return (
    <div className={cn('inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-semibold shadow-sm', colors.bg, colors.text, colors.border)}>
      {achievement.name}
    </div>
  );
}
