// @ts-nocheck
import { Link } from 'react-router-dom';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Trophy, Medal, Star, CheckCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/AuthContext';
import api from '@/api/apiClient';

export default function Leaderboard() {
  const { user } = useAuth();
  const [expanded, setExpanded] = useState(false);
  const { data: rawRows = [], isLoading } = useQuery({
    queryKey: ['leaderboard'],
    queryFn: () => api.getLeaderboard(),
  });
  const rows = rawRows || [];
  const visibleCount = expanded ? 15 : 5;

  const rankIcon = (rank) => {
    if (rank === 1) return <Trophy className="h-5 w-5 text-yellow-500" />;
    if (rank === 2) return <Medal className="h-5 w-5 text-slate-400" />;
    if (rank === 3) return <Medal className="h-5 w-5 text-amber-600" />;
    return <span className="flex h-5 w-5 items-center justify-center text-sm font-bold text-muted-foreground">{rank}</span>;
  };

  const isMe = (row) => row.email && row.email === user?.email;
  const topByPassed = [...rows]
    .sort((a, b) => {
      const delta = (b.passed_tests || 0) - (a.passed_tests || 0);
      if (delta !== 0) return delta;
      return (b.total_correct || 0) - (a.total_correct || 0);
    })
    .slice(0, visibleCount);
  const topMarathon = [...rows]
    .filter((row) => (row.marathon_best || 0) > 0)
    .sort((a, b) => {
      const bestDelta = (b.marathon_best || 0) - (a.marathon_best || 0);
      if (bestDelta !== 0) return bestDelta;
      return (b.passed_tests || 0) - (a.passed_tests || 0);
    })
    .slice(0, visibleCount);
  const topByCorrect = [...rows].sort((a, b) => (b.total_correct || 0) - (a.total_correct || 0)).slice(0, visibleCount);

  const LeaderTable = ({ data, valueKey, valueLabel }) => (
    <div className="space-y-2">
      {data.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">Поки немає даних</p>}
      {data.map((row, index) => (
        <motion.div key={`${row.id}-${valueKey}`} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * 0.05 }}>
          <Link
            to={row.username ? `/u/${row.username}` : `/users/${row.id}`}
            className={cn(
              'flex items-center gap-3 rounded-xl border p-3 transition-all hover:border-primary/30 hover:bg-primary/[0.03]',
              isMe(row) ? 'border-primary bg-primary/5 font-semibold' : 'border-border bg-card',
            )}
          >
            <div className="w-8 shrink-0">{rankIcon(index + 1)}</div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">
                {row.full_name || `${row.name || ''} ${row.surname || ''}`.trim() || row.name}
                {isMe(row) && <span className="ml-2 text-xs text-primary">(Ви)</span>}
              </p>
              {row.username ? <p className="truncate text-xs text-slate-500">@{row.username}</p> : null}
            </div>
            <div className="shrink-0 text-right">
              <p className="text-sm font-bold text-foreground">{row[valueKey] || 0}</p>
              <p className="text-xs text-muted-foreground">{valueLabel}</p>
            </div>
          </Link>
        </motion.div>
      ))}
    </div>
  );

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="flex items-center gap-3 text-3xl font-bold text-foreground">
          <Trophy className="h-8 w-8 text-yellow-500" />
          Таблиця лідерів
        </h1>
      </motion.div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <CheckCircle className="h-5 w-5 text-success" />
              За складеними іспитами
            </CardTitle>
          </CardHeader>
          <CardContent>{isLoading ? <Spinner /> : <LeaderTable data={topByPassed} valueKey="passed_tests" valueLabel="складено" />}</CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Star className="h-5 w-5 text-primary" />
              За правильними відповідями
            </CardTitle>
          </CardHeader>
          <CardContent>{isLoading ? <Spinner /> : <LeaderTable data={topByCorrect} valueKey="total_correct" valueLabel="правильних" />}</CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Trophy className="h-5 w-5 text-accent-foreground" />
            Режим марафон
          </CardTitle>
        </CardHeader>
        <CardContent>{isLoading ? <Spinner /> : <LeaderTable data={topMarathon} valueKey="marathon_best" valueLabel="питань" />}</CardContent>
      </Card>

      {rows.length > 5 ? (
        <div className="flex justify-center">
          <button
            type="button"
            className="rounded-full border border-slate-200 bg-white px-5 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-primary/20 hover:text-primary dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            onClick={() => setExpanded((value) => !value)}
          >
            {expanded ? 'Показати менше' : 'Показати більше'}
          </button>
        </div>
      ) : null}
    </div>
  );
}

function Spinner() {
  return <div className="flex justify-center py-8"><div className="h-6 w-6 animate-spin rounded-full border-2 border-primary/30 border-t-primary" /></div>;
}
