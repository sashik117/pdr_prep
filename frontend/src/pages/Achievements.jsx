// @ts-nocheck
import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Award, Lock, Sparkles, Trophy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { motion } from 'framer-motion';
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
  { id: 'perfect', label: 'Ідеальні' },
  { id: 'special', label: 'Особливі' },
  { id: 'accuracy', label: 'Точність' },
  { id: 'exam', label: 'Іспит' },
];

export default function Achievements() {
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

  const filtered = useMemo(
    () => (filterCategory === 'all' ? achievements : achievements.filter((achievement) => achievement.category === filterCategory)),
    [achievements, filterCategory],
  );

  const earnedAchievements = useMemo(
    () => achievements.filter((achievement) => achievement.earned),
    [achievements],
  );

  const showcaseAchievements = useMemo(
    () => featuredIds.map((id) => earnedAchievements.find((achievement) => achievement.id === id)).filter(Boolean),
    [earnedAchievements, featuredIds],
  );

  const toggleFeatured = (achievementId) => {
    setFeaturedIds((current) => {
      if (current.includes(achievementId)) {
        return current.filter((item) => item !== achievementId);
      }
      if (current.length >= 4) {
        return [...current.slice(1), achievementId];
      }
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
      <div className="mx-auto max-w-xl py-20 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-900">
          <Lock className="h-8 w-8 text-slate-500 dark:text-slate-300" />
        </div>
        <h2 className="mt-6 text-3xl font-semibold tracking-[-0.03em] text-slate-900 dark:text-white">Досягнення відкриваються після входу</h2>
        <p className="mt-3 text-slate-500 dark:text-slate-300">
          Увійдіть, щоб збирати нагороди, серії, рекорди й виставляти свої найкращі бейджі у профілі.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Button onClick={() => navigateToLogin('/achievements')}>Увійти</Button>
          <Button variant="outline" onClick={() => navigateToRegister('/achievements')}>Реєстрація</Button>
        </div>
      </div>
    );
  }

  const earnedCount = earnedAchievements.length;
  const progressWidth = achievements.length ? `${(earnedCount / achievements.length) * 100}%` : '0%';

  return (
    <div className="space-y-8">
      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <Card className="surface-glass shadow-[0_18px_45px_rgba(15,23,42,0.05)]">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 text-amber-600 dark:bg-amber-950/35 dark:text-amber-200">
                <Trophy className="h-7 w-7" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-3xl font-semibold tracking-[-0.03em] text-slate-900 dark:text-white">Мої досягнення</h2>
                <p className="mt-2 text-slate-500 dark:text-slate-300">
                  Тут можна не лише подивитися нагороди, а й вибрати до 4 головних бейджів для вітрини у своєму профілі.
                </p>
              </div>
            </div>

            <div className="mt-6 h-3 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-amber-400 to-primary"
                initial={{ width: 0 }}
                animate={{ width: progressWidth }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
              />
            </div>

            <div className="mt-4 flex flex-wrap gap-3 text-sm">
              <span className="rounded-xl bg-slate-100 px-3 py-2 font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-100">
                Отримано: {earnedCount}
              </span>
              <span className="rounded-xl bg-slate-100 px-3 py-2 font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-100">
                Усього: {achievements.length}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="surface-glass shadow-[0_18px_45px_rgba(15,23,42,0.05)]">
          <CardContent className="p-6">
            <div className="rounded-[24px] border border-slate-100 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-900/80">
              <div className="mb-3 flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                <p className="font-bold text-slate-900 dark:text-white">Вітрина профілю</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {showcaseAchievements.length > 0 ? (
                  showcaseAchievements.map((achievement) => (
                    <ShowcaseBadge key={achievement.id} achievement={achievement} />
                  ))
                ) : (
                  <p className="text-sm text-slate-500 dark:text-slate-300">
                    Поки що тут порожньо. Натисніть на отримані бейджі нижче, щоб виставити їх у профілі.
                  </p>
                )}
              </div>
              <Button className="mt-4 rounded-xl" disabled={saving} onClick={() => void saveShowcase()}>
                {saving ? 'Збереження...' : 'Зберегти вітрину'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="surface-glass shadow-[0_18px_45px_rgba(15,23,42,0.05)]">
        <CardContent className="p-6">
          <div className="mb-4 flex items-center gap-2">
            <Award className="h-5 w-5 text-primary" />
            <p className="font-bold text-slate-900 dark:text-white">Міні-статистика досягнень</p>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <MiniStat icon={Award} label="Рівень колекції" value={String(earnedCount)} />
            <MiniStat icon={Sparkles} label="Закрито" value={progressWidth} />
            <MiniStat icon={Trophy} label="Легендарних" value={String(achievements.filter((item) => item.tier === 4 && item.earned).length)} />
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        {categories.map((category) => (
          <button
            key={category.id}
            onClick={() => setFilterCategory(category.id)}
            className={cn(
              'rounded-xl border px-4 py-2 text-sm font-semibold transition-all',
              filterCategory === category.id
                ? 'border-primary bg-primary text-primary-foreground shadow-[0_10px_24px_rgba(20,107,255,0.18)]'
                : 'border-slate-200 bg-white text-slate-600 hover:border-primary/30 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100',
            )}
          >
            {category.label}
          </button>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {filtered.map((achievement, index) => {
          const colors = TIER_COLORS[achievement.tier] || TIER_COLORS[1];
          const featured = featuredIds.includes(achievement.id);
          return (
            <motion.div key={achievement.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.03 }}>
              <Card
                className={cn(
                  'h-full border-white/80 shadow-[0_16px_40px_rgba(15,23,42,0.05)] transition-all dark:border-slate-800',
                  achievement.earned
                    ? 'bg-[linear-gradient(135deg,rgba(255,255,255,0.98),rgba(248,250,252,0.95))] dark:bg-[linear-gradient(135deg,rgba(17,24,39,0.98),rgba(15,23,42,0.96))]'
                    : 'bg-[linear-gradient(135deg,rgba(241,245,249,0.95),rgba(226,232,240,0.82))] opacity-85 dark:bg-[linear-gradient(135deg,rgba(30,41,59,0.92),rgba(15,23,42,0.82))]',
                  featured && 'ring-2 ring-primary/30',
                )}
              >
                <CardContent className="p-5">
                  <div className="flex items-start gap-4">
                    <div className={cn('flex h-14 w-14 items-center justify-center rounded-2xl border text-xl shadow-sm', colors.bg, colors.text, colors.border)}>
                      <Trophy className="h-6 w-6" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-bold text-slate-900 dark:text-white">{achievement.name}</h3>
                        <span className={cn('rounded-lg border px-2 py-0.5 text-xs font-semibold', colors.bg, colors.text, colors.border)}>
                          {colors.label}
                        </span>
                      </div>
                      <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-300">{achievement.description}</p>
                      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                        <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">{achievement.category}</span>
                        {achievement.earned ? (
                          <button
                            type="button"
                            className={cn(
                              'rounded-lg px-2.5 py-1 text-xs font-bold transition-colors',
                              featured
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/35 dark:text-emerald-200',
                            )}
                            onClick={() => toggleFeatured(achievement.id)}
                          >
                            {featured ? 'На вітрині' : 'Додати у вітрину'}
                          </button>
                        ) : (
                          <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                            Ще не відкрито
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

function MiniStat({ icon: Icon, label, value }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-900/80">
      <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <Icon className="h-5 w-5" />
      </div>
      <p className="text-2xl font-semibold tracking-[-0.03em] text-slate-900 dark:text-white">{value}</p>
      <p className="text-sm text-slate-500 dark:text-slate-300">{label}</p>
    </div>
  );
}

function ShowcaseBadge({ achievement }) {
  const colors = TIER_COLORS[achievement.tier] || TIER_COLORS[1];
  return (
    <div className={cn('inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-bold shadow-sm', colors.bg, colors.text, colors.border)}>
      {achievement.name}
    </div>
  );
}
