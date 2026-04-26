// @ts-nocheck
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { BarChart3, BookOpen, CheckCircle2, Flame, RefreshCw, Target, TrendingUp, Trophy } from 'lucide-react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/AuthContext';
import api from '@/api/apiClient';
import LoginPrompt from '@/components/auth/LoginPrompt';
import ActivityCalendar from '@/components/progress/ActivityCalendar';
import { cn } from '@/lib/utils';

const tabs = [
  { id: 'overview', label: 'Огляд' },
  { id: 'analytics', label: 'Аналітика' },
  { id: 'history', label: 'Історія' },
];

const MODE_LABELS = {
  quick: 'Швидкий тест',
  full: 'Повний іспит',
  difficult: 'Робота над помилками',
  daily: 'Виклик дня',
};

function formatDayLabel(date) {
  return new Intl.DateTimeFormat('uk-UA', { day: 'numeric', month: 'short' }).format(date);
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
    const dayKey = date.toISOString().slice(0, 10);
    const dayResults = results.filter((item) => String(item.created_at || '').slice(0, 10) === dayKey);
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
  const { user, isLoadingAuth } = useAuth();
  const [tab, setTab] = useState('overview');
  const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
  const axisColor = isDark ? '#f8fafc' : '#0f172a';
  const gridColor = isDark ? '#334155' : '#cbd5e1';
  const tooltipStyle = {
    backgroundColor: isDark ? '#f8fafc' : '#ffffff',
    border: isDark ? '1px solid #94a3b8' : '1px solid #cbd5e1',
    color: '#0f172a',
    borderRadius: '14px',
    boxShadow: '0 10px 30px rgba(15,23,42,0.12)',
  };
  const tooltipLabelStyle = { color: '#0f172a', fontWeight: 700 };
  const tooltipItemStyle = { color: '#0f172a' };

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

  if (isLoadingAuth || (!!user && (statsQuery.isLoading || resultsQuery.isLoading))) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary/20 border-t-primary" />
      </div>
    );
  }

  if (!user) {
    return <LoginPrompt title="Прогрес та аналітика" description="Увійдіть, щоб бачити свою статистику, графіки та історію тестів." />;
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
  const averageScore = results.length
    ? Math.round(results.reduce((sum, item) => sum + (item.score_percent || 0), 0) / results.length)
    : 0;

  const last30 = buildLast30Days(results);
  const scoreTrend = last30.filter((item) => item.accuracy !== null);
  const last7weeks = buildLast7Weeks(results);
  const recentChartData = [...results].reverse().slice(-10).map((item, index, rows) => ({
    name: `#${Math.max(1, results.length - rows.length + index + 1)} Тест`,
    score: item.score_percent || 0,
  }));

  const sectionData = (stats.by_section || [])
    .map((item) => {
      const total = Number(item.total) || 0;
      const correct = Number(item.correct) || 0;
      return {
        name: item.section_name || `Розділ ${item.section || ''}`,
        accuracy: total > 0 ? Math.round((correct / total) * 100) : 0,
        total,
      };
    })
    .sort((left, right) => left.accuracy - right.accuracy)
    .slice(0, 8);

  const answerPieData = [
    { name: 'Правильні', value: totalCorrect, color: '#22c55e' },
    { name: 'Неправильні', value: Math.max(0, totalAnswered - totalCorrect), color: '#ef4444' },
  ];

  const passPieData = [
    { name: 'Здано', value: passedCount, color: '#2563eb' },
    { name: 'Не здано', value: failedCount, color: '#fb923c' },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-[32px] border border-white/90 bg-[linear-gradient(135deg,rgba(20,107,255,0.1),rgba(255,255,255,0.98)_45%,rgba(239,246,255,0.94))] p-6 shadow-[0_24px_60px_rgba(37,99,235,0.08)] dark:border-slate-800 dark:bg-[linear-gradient(135deg,rgba(30,64,175,0.2),rgba(2,6,23,0.98)_48%,rgba(15,23,42,0.98))] sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-primary">Аналітика профілю</p>
            <h1 className="mt-2 flex items-center gap-3 text-3xl font-black tracking-[-0.04em] text-slate-950 dark:text-white sm:text-4xl">
              <BarChart3 className="h-8 w-8 text-primary" />
              Прогрес і статистика
            </h1>
            <p className="mt-3 text-sm leading-7 text-slate-600 dark:text-slate-200 sm:text-base">
              Тут видно реальний рух уперед: частоту тренувань, точність по темах, історію тестів і активність по місяцях без зайвого шуму.
            </p>
          </div>

          <Button
            type="button"
            variant="outline"
            className="rounded-full border-slate-300 bg-white/90 shadow-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            onClick={() => {
              statsQuery.refetch();
              resultsQuery.refetch();
            }}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Оновити
          </Button>
        </div>

        <div className="mt-5 flex flex-wrap gap-2 rounded-2xl bg-white/70 p-1.5 shadow-inner dark:bg-slate-950/70">
          {tabs.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={cn(
                'rounded-xl px-4 py-2 text-sm font-semibold transition-all',
                tab === item.id ? 'bg-primary text-white shadow-[0_10px_22px_rgba(37,99,235,0.24)]' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800',
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      </motion.div>

      {tab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 xl:grid-cols-6">
            <StatCard icon={BookOpen} label="Тестів" value={totalTests} accent="blue" delay={0} />
            <StatCard icon={Target} label="Точність" value={`${accuracy}%`} accent="green" delay={0.04} />
            <StatCard icon={CheckCircle2} label="Правильних" value={totalCorrect} accent="emerald" delay={0.08} />
            <StatCard icon={Trophy} label="Здано" value={passedCount} accent="violet" delay={0.12} />
            <StatCard icon={Flame} label="Серія" value={`${streak} дн.`} accent="orange" delay={0.16} />
            <StatCard icon={TrendingUp} label="Марафон" value={marathonBest} accent="rose" delay={0.2} />
          </div>

          <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
            <ChartCard title="Календар активності">
              <ActivityCalendar dates={stats.activity_days || []} startDate={stats?.user?.created_at || user?.created_at || null} />
            </ChartCard>

            <ChartCard title="Останні результати">
              {recentChartData.length > 0 ? (
                <div className="h-[240px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={recentChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                      <XAxis dataKey="name" tick={{ fontSize: 11, fill: axisColor }} tickLine={false} axisLine={false} stroke={axisColor} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: axisColor }} tickLine={false} axisLine={false} stroke={axisColor} />
                      <Tooltip formatter={(value) => [`${value}%`, 'Результат']} contentStyle={tooltipStyle} labelStyle={tooltipLabelStyle} itemStyle={tooltipItemStyle} />
                      <Bar dataKey="score" radius={[8, 8, 0, 0]} fill="#60a5fa" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <EmptyState text="Щойно з’являться перші результати, тут буде видно ваш темп і форму." />
              )}
            </ChartCard>
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <PiePanel title="Правильність відповідей" data={answerPieData} empty={!totalAnswered} emptyText="Після першого тесту тут з’явиться зріз по правильних і неправильних відповідях." />
            <PiePanel title="Здано / не здано" data={passPieData} empty={!results.length} emptyText="Щойно накопичиться історія тестів, тут буде видно співвідношення вдалих і невдалих проходжень." />
          </div>
        </div>
      )}

      {tab === 'analytics' && (
        <div className="space-y-6">
          <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
            <ChartCard title="Динаміка балів за 30 днів">
              {scoreTrend.length > 0 ? (
                <div className="h-[260px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={scoreTrend}>
                      <defs>
                        <linearGradient id="analyticsScoreFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#60a5fa" stopOpacity={0.32} />
                          <stop offset="100%" stopColor="#38bdf8" stopOpacity={0.04} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                      <XAxis dataKey="date" tick={{ fontSize: 10, fill: axisColor }} tickLine={false} axisLine={false} interval={4} stroke={axisColor} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: axisColor }} tickLine={false} axisLine={false} stroke={axisColor} />
                      <Tooltip formatter={(value) => [`${value}%`, 'Точність']} contentStyle={tooltipStyle} labelStyle={tooltipLabelStyle} itemStyle={tooltipItemStyle} />
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

          <div className="grid gap-6 xl:grid-cols-2">
            <ChartCard title="Тести по днях">
              <div className="h-[240px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={last30}>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                    <XAxis dataKey="date" tick={{ fontSize: 9, fill: axisColor }} tickLine={false} axisLine={false} interval={6} stroke={axisColor} />
                    <YAxis tick={{ fontSize: 11, fill: axisColor }} tickLine={false} axisLine={false} allowDecimals={false} stroke={axisColor} />
                    <Tooltip formatter={(value) => [value, 'Тестів']} contentStyle={tooltipStyle} labelStyle={tooltipLabelStyle} itemStyle={tooltipItemStyle} />
                    <Bar dataKey="tests" radius={[8, 8, 0, 0]} fill="#22c55e" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </ChartCard>

            <ChartCard title="Тести по тижнях">
              <div className="h-[240px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={last7weeks}>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                    <XAxis dataKey="week" tick={{ fontSize: 11, fill: axisColor }} tickLine={false} axisLine={false} stroke={axisColor} />
                    <YAxis tick={{ fontSize: 11, fill: axisColor }} tickLine={false} axisLine={false} allowDecimals={false} stroke={axisColor} />
                    <Tooltip formatter={(value) => [value, 'Тестів']} contentStyle={tooltipStyle} labelStyle={tooltipLabelStyle} itemStyle={tooltipItemStyle} />
                    <Bar dataKey="tests" radius={[8, 8, 0, 0]} fill="#60a5fa" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </ChartCard>
          </div>

          <ChartCard title="Точність по розділах">
            {sectionData.length > 0 ? (
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={sectionData} layout="vertical" margin={{ left: 10, right: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                    <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11, fill: axisColor }} tickLine={false} axisLine={false} stroke={axisColor} />
                    <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11, fill: axisColor }} tickLine={false} axisLine={false} stroke={axisColor} />
                    <Tooltip formatter={(value) => [`${value}%`, 'Точність']} contentStyle={tooltipStyle} labelStyle={tooltipLabelStyle} itemStyle={tooltipItemStyle} />
                    <Bar dataKey="accuracy" radius={[0, 8, 8, 0]} fill="#60a5fa" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <EmptyState text="Щойно по розділах накопичиться більше даних, тут буде видно реальну точність по темах." />
            )}
          </ChartCard>
        </div>
      )}

      {tab === 'history' && (
        <Card className="overflow-hidden border-white/90 bg-white shadow-[0_18px_45px_rgba(15,23,42,0.05)] dark:border-slate-800 dark:bg-slate-950/92">
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
                      ? 'border-emerald-100 bg-[linear-gradient(135deg,rgba(34,197,94,0.08),rgba(255,255,255,0.96))] dark:border-emerald-500/20 dark:bg-emerald-950/20'
                      : 'border-rose-100 bg-[linear-gradient(135deg,rgba(244,63,94,0.08),rgba(255,255,255,0.96))] dark:border-rose-500/20 dark:bg-rose-950/20',
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
                      <p className={cn('text-lg font-black tracking-[-0.03em]', item.passed ? 'text-emerald-600 dark:text-emerald-300' : 'text-rose-600 dark:text-rose-300')}>
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
    </div>
  );
}

function StatCard({ icon: Icon, label, value, accent = 'blue', delay = 0 }) {
  const accentMap = {
    blue: {
      card: 'border-sky-100 bg-[linear-gradient(135deg,rgba(14,165,233,0.12),rgba(255,255,255,0.98)_52%,rgba(219,234,254,0.92))] dark:border-slate-800 dark:bg-[linear-gradient(135deg,rgba(14,165,233,0.16),rgba(15,23,42,0.98)_52%,rgba(30,41,59,0.96))]',
      icon: 'from-sky-500 to-blue-600',
    },
    green: {
      card: 'border-emerald-100 bg-[linear-gradient(135deg,rgba(34,197,94,0.14),rgba(255,255,255,0.98)_52%,rgba(209,250,229,0.92))] dark:border-slate-800 dark:bg-[linear-gradient(135deg,rgba(34,197,94,0.16),rgba(15,23,42,0.98)_52%,rgba(30,41,59,0.96))]',
      icon: 'from-emerald-500 to-teal-500',
    },
    emerald: {
      card: 'border-teal-100 bg-[linear-gradient(135deg,rgba(20,184,166,0.14),rgba(255,255,255,0.98)_52%,rgba(204,251,241,0.92))] dark:border-slate-800 dark:bg-[linear-gradient(135deg,rgba(20,184,166,0.16),rgba(15,23,42,0.98)_52%,rgba(30,41,59,0.96))]',
      icon: 'from-teal-500 to-emerald-500',
    },
    violet: {
      card: 'border-violet-100 bg-[linear-gradient(135deg,rgba(139,92,246,0.14),rgba(255,255,255,0.98)_52%,rgba(237,233,254,0.92))] dark:border-slate-800 dark:bg-[linear-gradient(135deg,rgba(139,92,246,0.16),rgba(15,23,42,0.98)_52%,rgba(30,41,59,0.96))]',
      icon: 'from-violet-500 to-fuchsia-500',
    },
    orange: {
      card: 'border-orange-100 bg-[linear-gradient(135deg,rgba(251,146,60,0.14),rgba(255,255,255,0.98)_52%,rgba(255,237,213,0.92))] dark:border-slate-800 dark:bg-[linear-gradient(135deg,rgba(249,115,22,0.16),rgba(15,23,42,0.98)_52%,rgba(30,41,59,0.96))]',
      icon: 'from-amber-400 to-orange-500',
    },
    rose: {
      card: 'border-rose-100 bg-[linear-gradient(135deg,rgba(244,63,94,0.14),rgba(255,255,255,0.98)_52%,rgba(255,228,230,0.92))] dark:border-slate-800 dark:bg-[linear-gradient(135deg,rgba(244,63,94,0.16),rgba(15,23,42,0.98)_52%,rgba(30,41,59,0.96))]',
      icon: 'from-rose-500 to-orange-500',
    },
  };
  const palette = accentMap[accent] || accentMap.blue;

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay }}>
      <Card className={`overflow-hidden border shadow-[0_18px_45px_rgba(15,23,42,0.05)] ${palette.card}`}>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className={`flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-[0_12px_24px_rgba(15,23,42,0.14)] ${palette.icon}`}>
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-black leading-tight text-slate-950 dark:text-white">{value}</p>
              <p className="text-xs font-medium text-slate-600 dark:text-slate-200">{label}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function ChartCard({ title, children }) {
  return (
    <Card className="overflow-hidden border-white/90 bg-white shadow-[0_18px_45px_rgba(15,23,42,0.05)] dark:border-slate-800 dark:bg-slate-950/92">
      <CardHeader>
        <CardTitle className="dark:text-white">{title}</CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function PiePanel({ title, data, empty, emptyText }) {
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
                <Tooltip contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #cbd5e1', color: '#0f172a', borderRadius: '14px' }} labelStyle={{ color: '#0f172a', fontWeight: 700 }} itemStyle={{ color: '#0f172a' }} />
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
      <p className="text-xs font-black uppercase tracking-[0.16em] opacity-75">{label}</p>
      <p className="mt-2 text-2xl font-black tracking-[-0.03em] text-slate-950 dark:text-white">{value}</p>
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
