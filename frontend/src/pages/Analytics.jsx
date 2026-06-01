// @ts-nocheck
import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  ArrowLeft,
  BarChart3,
  BookOpen,
  Clock,
  Crown,
  Flame,
  Gauge,
  History,
  LayoutDashboard,
  LineChart,
  Route,
  Trophy,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useProtectedScreen } from '@/lib/useProtectedScreen';
import api from '@/api/apiClient';
import LoginPrompt from '@/components/auth/LoginPrompt';
import ActivityCalendar from '@/components/progress/ActivityCalendar';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';

const tabs = [
  { id: 'overview', label: 'Огляд', icon: LayoutDashboard },
  { id: 'analytics', label: 'Динаміка', premium: true, icon: LineChart },
  { id: 'history', label: 'Історія', premium: true, icon: History },
];

const MODE_LABELS = {
  quick: 'Офіційні тести',
  full: 'Тренування 20 питань',
  mvs: 'Іспит МВС',
  difficult: 'Мої помилки',
  ticket: 'Білет',
  section: 'Тест за розділом',
  top: 'Топ помилок багатьох',
};

function formatDuration(seconds) {
  const total = Math.max(0, Number(seconds) || 0);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  return [hours, minutes, secs].map((part) => String(part).padStart(2, '0')).join(':');
}

function formatDayLabel(date) {
  return new Intl.DateTimeFormat('uk-UA', { day: 'numeric', month: 'short' }).format(date);
}

function formatDayKey(date) {
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return '';
  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, '0');
  const day = String(parsed.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function startOfDay(value) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

function buildLast30Days(results) {
  const today = startOfDay(new Date());
  return Array.from({ length: 30 }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (29 - index));
    const dayKey = formatDayKey(date);
    const dayResults = results.filter((item) => formatDayKey(item.created_at) === dayKey);
    return {
      dayKey,
      date: formatDayLabel(date),
      tests: dayResults.length,
      accuracy: dayResults.length
        ? Math.round(dayResults.reduce((sum, row) => sum + (row.score_percent || 0), 0) / dayResults.length)
        : null,
    };
  });
}

function buildLast7Weeks(results) {
  const now = new Date();
  return Array.from({ length: 7 }, (_, index) => {
    const end = new Date(now);
    end.setDate(now.getDate() - (6 - index) * 7);
    const start = new Date(end);
    start.setDate(end.getDate() - 6);
    const weekResults = results.filter((item) => {
      const createdAt = new Date(item.created_at);
      return createdAt >= start && createdAt <= end;
    });
    return {
      week: `Тиж. ${index + 1}`,
      tests: weekResults.length,
    };
  });
}

export default function Analytics() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, isCheckingAccess, canAccess } = useProtectedScreen();
  const requestedTab = searchParams.get('tab') || 'overview';
  const [tab, setTab] = useState(tabs.some((item) => item.id === requestedTab) ? requestedTab : 'overview');
  const isPremiumUser = Boolean(user?.is_premium);
  const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
  const isMobile = useIsMobile();
  const axisColor = isDark ? '#dbe7ff' : '#0f172a';
  const gridColor = isDark ? '#334155' : '#dbe3ee';
  const mobileChartMargin = isMobile ? { top: 12, right: 2, left: -26, bottom: 0 } : { top: 12, right: 10, left: 0, bottom: 0 };
  const mobileAreaMargin = isMobile ? { top: 12, right: 2, left: -26, bottom: 0 } : { top: 12, right: 10, left: 0, bottom: 0 };
  const yAxisWidth = isMobile ? 34 : 60;
  const tooltipStyle = {
    backgroundColor: isDark ? '#0f172a' : '#ffffff',
    border: isDark ? '1px solid #334155' : '1px solid #dbe3ee',
    color: isDark ? '#f8fafc' : '#0f172a',
    borderRadius: '16px',
    boxShadow: '0 12px 36px rgba(15,23,42,0.16)',
  };
  const tooltipLabelStyle = { color: isDark ? '#f8fafc' : '#0f172a', fontWeight: 700 };
  const tooltipItemStyle = { color: isDark ? '#e2e8f0' : '#0f172a' };

  const statsQuery = useQuery({
    queryKey: ['analytics-stats'],
    queryFn: () => api.getStats(),
    enabled: !!user,
    staleTime: 120000,
  });

  const resultsQuery = useQuery({
    queryKey: ['analytics-results'],
    queryFn: () => api.getTestResults(),
    enabled: !!user,
    staleTime: 120000,
  });

  useEffect(() => {
    const nextTab = searchParams.get('tab') || 'overview';
    if (tabs.some((item) => item.id === nextTab)) {
      setTab(nextTab);
    }
  }, [searchParams]);

  if (isCheckingAccess || (!!user && (statsQuery.isLoading || resultsQuery.isLoading))) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary/20 border-t-primary" />
      </div>
    );
  }

  if (!canAccess || !user) {
    return <LoginPrompt title="Аналітика" description="Увійдіть, щоб бачити свій прогрес, календар активності та результати тестів." />;
  }

  const stats = statsQuery.data || {};
  const results = resultsQuery.data || [];
  const totalTests = stats.total_tests || 0;
  const totalCorrect = stats.total_correct || 0;
  const totalAnswered = stats.total_answers || 0;
  const streak = stats.streak_days || 0;
  const marathonBest = stats.marathon_best || 0;
  const accuracy = totalAnswered > 0 ? Math.round((totalCorrect / totalAnswered) * 100) : 0;
  const passedCount = results.filter((item) => item.passed).length;
  const failedCount = Math.max(0, results.length - passedCount);
  const bestExamTime = stats.best_exam_time_seconds || 0;
  const totalTestingTime = stats.total_test_time_seconds || 0;
  const averageScore = results.length
    ? Math.round(results.reduce((sum, item) => sum + (item.score_percent || 0), 0) / results.length)
    : 0;

  const last30 = buildLast30Days(results);
  const scoreTrend = last30.filter((item) => item.accuracy !== null);
  const last7weeks = buildLast7Weeks(results);
  const recentChartData = [...results].reverse().slice(-10).map((item, index, rows) => ({
    name: `Спроба ${Math.max(1, results.length - rows.length + index + 1)}`,
    score: item.score_percent || 0,
  }));

  const sectionData = (stats.by_section || [])
    .map((item) => {
      const total = Number(item.total) || 0;
      const correct = Number(item.correct) || 0;
      const accuracyFromApi = Number(item.accuracy_percent);
      return {
        name: item.section_name || `Розділ ${item.section || ''}`,
        accuracy: Number.isFinite(accuracyFromApi) ? accuracyFromApi : total > 0 ? Math.round((correct / total) * 100) : 0,
        correct,
        total,
      };
    })
    .filter((item) => item.total > 0)
    .sort((left, right) => right.total - left.total)
    .slice(0, 10);

  const answerPieData = [
    { name: 'Правильні', value: totalCorrect, color: '#22c55e' },
    { name: 'Неправильні', value: Math.max(0, totalAnswered - totalCorrect), color: '#ef4444' },
  ];

  const passPieData = [
    { name: 'Складено', value: passedCount, color: '#2563eb' },
    { name: 'Не складено', value: failedCount, color: '#fb923c' },
  ];

  const handleTabClick = (nextTab) => {
    const item = tabs.find((entry) => entry.id === nextTab);
    if (item?.premium && !isPremiumUser) {
      navigate('/pricing');
      return;
    }
    setTab(nextTab);
    setSearchParams(nextTab === 'overview' ? {} : { tab: nextTab });
  };

  const showPremiumSection = tab !== 'overview' && !isPremiumUser;
  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 px-5 pb-6 sm:px-6 lg:px-8">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-5"
      >
        <div className="mb-4">
          <Button
            type="button"
            variant="ghost"
            className="-ml-2 rounded-full px-3 text-slate-600 hover:text-slate-950 dark:text-slate-200 dark:hover:text-white"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Назад
          </Button>
        </div>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">Ваш прогрес</p>
            <h1 className="mt-2 flex items-center gap-3 text-3xl font-semibold tracking-[-0.04em] text-slate-950 dark:text-white sm:text-4xl">
              <BarChart3 className="h-8 w-8 text-primary" />
              Аналітика навчання
            </h1>
            <p className="mt-3 text-sm leading-7 text-slate-600 dark:text-slate-200 sm:text-base">
              Тут видно Ваші результати, темп і теми, які варто повторити перед наступною спробою.
            </p>
          </div>

        </div>

        <div className="mt-4 grid grid-cols-3 gap-1.5 rounded-xl border border-slate-200 bg-white p-1.5 shadow-sm dark:border-slate-800 dark:bg-slate-950 sm:inline-grid sm:min-w-[360px] sm:gap-2">
          {tabs.map((item) => {
            const Icon = item.icon;
            const isActive = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleTabClick(item.id)}
                className={cn(
                  'inline-flex min-w-0 items-center justify-center gap-1 rounded-lg border px-2 py-2 text-[11px] font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-primary/30 sm:gap-2 sm:px-3.5 sm:py-2.5 sm:text-sm',
                  isActive
                    ? 'border-primary bg-primary text-white shadow-[0_10px_22px_rgba(37,99,235,0.24)]'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:hover:border-slate-700 dark:hover:bg-slate-800',
                )}
              >
                <Icon className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" />
                <span className="inline-flex min-w-0 items-center gap-1 truncate sm:gap-2">
                  {item.label}
                  {item.premium && !isPremiumUser ? <Crown className="h-3.5 w-3.5 text-amber-500" /> : null}
                </span>
              </button>
            );
          })}
        </div>
      </motion.div>

      {tab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 xl:grid-cols-6">
            <StatCard icon={BookOpen} label="Тестів" value={totalTests} accent="blue" delay={0} />
            <StatCard icon={Gauge} label="Точність" value={`${accuracy}%`} accent="violet" delay={0.04} />
            <StatCard icon={Clock} label="Кращий іспит" value={formatDuration(bestExamTime)} accent="emerald" delay={0.08} />
            <StatCard icon={Trophy} label="Час тестування" value={formatDuration(totalTestingTime)} accent="sky" delay={0.12} />
            <StatCard icon={Flame} label="Серія" value={`${streak}\u00A0дн.`} accent="orange" delay={0.16} />
            <StatCard icon={Route} label="Марафон" value={marathonBest} accent="blue" delay={0.2} />
          </div>

          <div className="grid gap-5 xl:grid-cols-2">
            <PiePanel title="Правильність відповідей" data={answerPieData} empty={!totalAnswered} emptyText="Після першого тесту тут з’явиться зріз по правильних і неправильних відповідях." />
            <PiePanel title="Складено / не складено" data={passPieData} empty={!results.length} emptyText="Щойно накопичиться історія тестів, тут буде видно співвідношення вдалих і невдалих проходжень." />
          </div>

          <div className="grid gap-5 xl:grid-cols-[0.82fr_1.18fr]">
            <ChartCard title="Календар активності">
              <ActivityCalendar dates={stats.activity_days || []} startDate={stats?.user?.created_at || user?.created_at || null} />
            </ChartCard>

            <ChartCard title="Останні результати">
              {recentChartData.length > 0 ? (
                <div className="-mx-2 h-[300px] sm:mx-0 sm:h-[340px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={recentChartData} margin={mobileChartMargin}>
                      <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                      <XAxis dataKey="name" tick={{ fontSize: 11, fill: axisColor }} tickLine={false} axisLine={false} stroke={axisColor} />
                      <YAxis width={yAxisWidth} domain={[0, 100]} tick={{ fontSize: 11, fill: axisColor }} tickLine={false} axisLine={false} stroke={axisColor} />
                      <Tooltip formatter={(value) => [`${value}%`, 'Результат']} contentStyle={tooltipStyle} labelStyle={tooltipLabelStyle} itemStyle={tooltipItemStyle} isAnimationActive={false} />
                      <Bar dataKey="score" radius={[8, 8, 0, 0]} fill="#60a5fa" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <EmptyState text="Щойно з’являться перші результати, тут буде видно ваш темп і форму." />
              )}
            </ChartCard>
          </div>
        </div>
      )}

      {tab === 'analytics' && isPremiumUser && (
        <div className="space-y-6">
          <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
            <ChartCard title="Динаміка балів за 30 днів">
              {scoreTrend.length > 0 ? (
                <div className="-mx-2 h-[220px] sm:mx-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={scoreTrend} margin={mobileAreaMargin}>
                      <defs>
                        <linearGradient id="analyticsScoreFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#60a5fa" stopOpacity={0.32} />
                          <stop offset="100%" stopColor="#38bdf8" stopOpacity={0.04} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                      <XAxis dataKey="date" tick={{ fontSize: 10, fill: axisColor }} tickLine={false} axisLine={false} interval={4} stroke={axisColor} />
                      <YAxis width={yAxisWidth} domain={[0, 100]} tick={{ fontSize: 11, fill: axisColor }} tickLine={false} axisLine={false} stroke={axisColor} />
                      <Tooltip formatter={(value) => [`${value}%`, 'Точність']} contentStyle={tooltipStyle} labelStyle={tooltipLabelStyle} itemStyle={tooltipItemStyle} isAnimationActive={false} />
                      <Area type="monotone" dataKey="accuracy" stroke="#60a5fa" fill="url(#analyticsScoreFill)" strokeWidth={3} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <EmptyState text="Щойно з’явиться більше ніж один день з результатами, тут буде плавний графік вашого руху вгору." />
              )}
            </ChartCard>

            <ChartCard title="Середній бал і форма">
              <div className="grid grid-cols-2 gap-4">
                <MiniHighlight label="Середній бал" value={`${averageScore}%`} accent="blue" />
                <MiniHighlight label="Спроб за 30 днів" value={last30.reduce((sum, item) => sum + item.tests, 0)} accent="green" />
                <MiniHighlight label="Всього проходжень" value={results.length} accent="violet" />
                <MiniHighlight label="Краща серія" value={`${streak} дн.`} accent="orange" />
              </div>
            </ChartCard>
          </div>

          <div className="grid gap-5 xl:grid-cols-2">
            <ChartCard title="Тести по днях">
              <div className="-mx-2 h-[205px] sm:mx-0">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={last30}
                    margin={mobileChartMargin}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                    <XAxis dataKey="date" tick={{ fontSize: 9, fill: axisColor }} tickLine={false} axisLine={false} interval={6} stroke={axisColor} />
                    <YAxis width={yAxisWidth} tick={{ fontSize: 11, fill: axisColor }} tickLine={false} axisLine={false} allowDecimals={false} stroke={axisColor} />
                    <Tooltip formatter={(value) => [value, 'Тестів']} contentStyle={tooltipStyle} labelStyle={tooltipLabelStyle} itemStyle={tooltipItemStyle} isAnimationActive={false} />
                    <Bar dataKey="tests" radius={[8, 8, 0, 0]} fill="#22c55e" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </ChartCard>

            <ChartCard title="Тести по тижнях">
              <div className="-mx-2 h-[205px] sm:mx-0">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={last7weeks} margin={mobileChartMargin}>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                    <XAxis dataKey="week" tick={{ fontSize: 11, fill: axisColor }} tickLine={false} axisLine={false} stroke={axisColor} />
                    <YAxis width={yAxisWidth} tick={{ fontSize: 11, fill: axisColor }} tickLine={false} axisLine={false} allowDecimals={false} stroke={axisColor} />
                    <Tooltip formatter={(value) => [value, 'Тестів']} contentStyle={tooltipStyle} labelStyle={tooltipLabelStyle} itemStyle={tooltipItemStyle} isAnimationActive={false} />
                    <Bar dataKey="tests" radius={[8, 8, 0, 0]} fill="#60a5fa" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </ChartCard>
          </div>

          <ChartCard title="Точність по розділах">
            {sectionData.length > 0 ? <SectionAccuracyList items={sectionData} /> : <EmptyState text="Щойно по розділах накопичиться більше даних, тут буде видно точність по темах." />}
          </ChartCard>
        </div>
      )}

      {tab === 'history' && isPremiumUser && (
        <Card className="surface-glass overflow-hidden">
          <CardHeader>
            <CardTitle className="dark:text-white">Історія тестів</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {results.length > 0 ? (
              [...results].map((item) => (
                <div
                  key={item.id}
                  className={cn(
                    'rounded-[22px] border p-4 shadow-[0_8px_20px_rgba(15,23,42,0.03)]',
                    item.passed
                      ? 'border-emerald-200 bg-emerald-50/90 dark:border-emerald-400/30 dark:bg-emerald-950/35'
                      : 'border-rose-200 bg-rose-50/90 dark:border-rose-400/30 dark:bg-rose-950/35',
                  )}
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900 dark:text-white">{MODE_LABELS[item.mode] || item.mode || 'Тест'}</p>
                      <p className="text-sm text-slate-600 dark:text-slate-200">
                        {item.created_at ? new Date(item.created_at).toLocaleString('uk-UA') : 'Без дати'}
                        {item.section ? ` • ${item.section}` : ''}
                        {item.time_seconds ? ` • ${Math.floor(item.time_seconds / 60)} хв ${item.time_seconds % 60} с` : ''}
                      </p>
                    </div>
                    <div className="text-left sm:text-right">
                      <p className={cn('text-lg font-semibold tracking-[-0.03em]', item.passed ? 'text-emerald-600 dark:text-emerald-300' : 'text-rose-600 dark:text-rose-300')}>
                        {item.score_percent}%
                      </p>
                      <p className="text-sm text-slate-600 dark:text-slate-200">
                        {item.correct}/{item.total}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <EmptyState text="Історія тестів з’явиться тут після першого проходження." />
            )}
          </CardContent>
        </Card>
      )}

      {showPremiumSection ? (
        <Card className="border-amber-200/70 bg-[linear-gradient(135deg,rgba(250,204,21,0.14),rgba(255,255,255,0.98)_50%,rgba(255,247,205,0.92))] dark:border-amber-500/20 dark:bg-[linear-gradient(135deg,rgba(234,179,8,0.14),rgba(15,23,42,0.96)_55%,rgba(51,30,0,0.82))]">
          <CardContent className="p-8 text-center">
            <Crown className="mx-auto h-10 w-10 text-amber-600 dark:text-amber-200" />
            <h2 className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-slate-950 dark:text-white">Цей розділ відкривається з Premium</h2>
            <p className="mt-3 text-sm leading-7 text-slate-700 dark:text-slate-300">
              Тут будуть повні графіки, історія спроб, точність по темах і детальний розбір вашого прогресу.
            </p>
            <div className="mt-5 flex justify-center gap-3">
              <Button asChild className="rounded-full px-6"><Link to="/pricing">Перейти до Premium</Link></Button>
              <Button variant="outline" className="rounded-full px-6" onClick={() => setTab('overview')}>Повернутися до огляду</Button>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, accent = 'blue', delay = 0 }) {
  const accentMap = {
    blue: {
      card: 'border-slate-200 bg-card dark:border-slate-800',
      icon: 'bg-blue-600 text-white',
    },
    green: {
      card: 'border-slate-200 bg-card dark:border-slate-800',
      icon: 'bg-emerald-500 text-white',
    },
    emerald: {
      card: 'border-slate-200 bg-card dark:border-slate-800',
      icon: 'bg-emerald-500 text-white',
    },
    sky: {
      card: 'border-slate-200 bg-card dark:border-slate-800',
      icon: 'bg-sky-500 text-white',
    },
    amber: {
      card: 'border-slate-200 bg-card dark:border-slate-800',
      icon: 'bg-amber-500 text-white',
    },
    violet: {
      card: 'border-slate-200 bg-card dark:border-slate-800',
      icon: 'bg-violet-500 text-white',
    },
    orange: {
      card: 'border-slate-200 bg-card dark:border-slate-800',
      icon: 'bg-orange-500 text-white',
    },
    rose: {
      card: 'border-slate-200 bg-card dark:border-slate-800',
      icon: 'bg-rose-500 text-white',
    },
  };
  const palette = accentMap[accent] || accentMap.blue;

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay }}>
      <Card className={`flex h-full overflow-hidden border shadow-[0_12px_28px_rgba(15,23,42,0.04)] ${palette.card}`}>
        <CardContent className="flex min-h-[152px] flex-1 items-center justify-center p-5 text-center">
          <div className="m-auto flex min-h-[112px] w-full min-w-0 flex-col items-center justify-center gap-2.5">
            <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl shadow-[0_12px_24px_rgba(15,23,42,0.12)] ${palette.icon}`}>
              <Icon className="h-5 w-5" />
            </div>
            <div className="flex min-w-0 flex-col items-center justify-center">
              <p className="whitespace-nowrap text-center text-xl font-semibold leading-none text-slate-950 dark:text-white sm:text-[1.35rem]">{value}</p>
              <p className="mt-1 text-center text-xs font-medium leading-5 text-slate-600 dark:text-slate-200">{label}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function ChartCard({ title, children }) {
  return (
    <Card className="surface-glass overflow-hidden">
      <CardHeader className="px-4 pb-2 pt-4 sm:px-6 sm:pb-3 sm:pt-6">
        <CardTitle className="text-slate-900 dark:text-white">{title}</CardTitle>
      </CardHeader>
      <CardContent className="px-3 pb-4 sm:px-6 sm:pb-6">{children}</CardContent>
    </Card>
  );
}

function PiePanel({ title, data, empty, emptyText }) {
  const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
  return (
    <ChartCard title={title}>
      {!empty ? (
        <div className="flex flex-col items-center gap-3">
          <div className="h-[220px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data} cx="50%" cy="50%" innerRadius={54} outerRadius={84} paddingAngle={4} dataKey="value">
                  {data.map((item) => (
                    <Cell key={item.name} fill={item.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: isDark ? '#0f172a' : '#ffffff',
                    border: isDark ? '1px solid #334155' : '1px solid #cbd5e1',
                    color: isDark ? '#f8fafc' : '#0f172a',
                    borderRadius: '14px',
                  }}
                  labelStyle={{ color: isDark ? '#f8fafc' : '#0f172a', fontWeight: 700 }}
                  itemStyle={{ color: isDark ? '#e2e8f0' : '#0f172a' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap justify-center gap-4 text-xs font-semibold text-slate-600 dark:text-slate-200">
            {data.map((item) => (
              <span key={item.name} className="inline-flex items-center gap-2">
                <span className="h-3 w-3 rounded-full" style={{ backgroundColor: item.color }} />
                {item.name}: {item.value}
              </span>
            ))}
          </div>
        </div>
      ) : (
        <EmptyState text={emptyText} />
      )}
    </ChartCard>
  );
}

function MiniHighlight({ label, value, accent = 'blue' }) {
  const accentMap = {
    blue: 'border-sky-100 bg-sky-50 text-sky-700 dark:border-sky-500/20 dark:bg-sky-950/30 dark:text-sky-200',
    green: 'border-emerald-100 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-950/30 dark:text-emerald-200',
    violet: 'border-violet-100 bg-violet-50 text-violet-700 dark:border-violet-500/20 dark:bg-violet-950/30 dark:text-violet-200',
    orange: 'border-orange-100 bg-orange-50 text-orange-700 dark:border-orange-500/20 dark:bg-orange-950/30 dark:text-orange-200',
  };

  return (
    <div className={`rounded-[22px] border p-4 ${accentMap[accent] || accentMap.blue}`}>
      <p className="text-xs font-semibold uppercase tracking-[0.16em] opacity-75">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-slate-950 dark:text-white">{value}</p>
    </div>
  );
}

function SectionAccuracyList({ items = [] }) {
  return (
    <div className="space-y-3">
      {items.map((item, index) => {
        const tone =
          item.accuracy >= 85
            ? 'from-emerald-500 to-teal-400'
            : item.accuracy >= 65
              ? 'from-sky-500 to-blue-500'
              : 'from-amber-400 to-orange-500';
        return (
          <div key={`${item.name}-${index}`} className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950/50">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="line-clamp-2 text-sm font-semibold text-slate-900 dark:text-white">{item.name}</p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-300">{item.correct}/{item.total} правильних відповідей</p>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-900 dark:bg-slate-800 dark:text-white">
                {item.accuracy}%
              </span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
              <div className={`h-full rounded-full bg-gradient-to-r ${tone}`} style={{ width: `${Math.max(6, Math.min(100, item.accuracy))}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function EmptyState({ text }) {
  return (
    <div className="flex min-h-[180px] items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 py-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
      {text}
    </div>
  );
}
