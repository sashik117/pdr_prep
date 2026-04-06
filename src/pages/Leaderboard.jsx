import { supabase } from '@/api/supabaseClient';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Trophy, Medal, Star, CheckCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import LoginPrompt from '@/components/auth/LoginPrompt';

export default function Leaderboard() {
  const { data: user, isLoading: userLoading } = useQuery({
    queryKey: ['currentUser'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      return user || null;
    },
  });

  const { data: allProgress = [], isLoading } = useQuery({
    queryKey: ['leaderboard'],
    queryFn: async () => {
      const { data } = await supabase.from('user_progress').select('*').order('total_correct', { ascending: false }).limit(50);
      return data || [];
    },
    enabled: !!user,
  });

  const { data: allResults = [] } = useQuery({
    queryKey: ['leaderboardResults'],
    queryFn: async () => {
      const { data } = await supabase.from('test_results').select('*').order('created_at', { ascending: false }).limit(500);
      return data || [];
    },
    enabled: !!user,
  });

  if (!userLoading && !user) {
    return <LoginPrompt title="Таблиця лідерів" description="Зареєструйтесь щоб бачити рейтинг та змагатись з іншими учнями" />;
  }

  const topByCorrect = [...allProgress]
    .sort((a, b) => (b.total_correct || 0) - (a.total_correct || 0))
    .slice(0, 10)
    .map((p, i) => ({
      rank: i + 1,
      email: p.created_by || '—',
      name: p.created_by?.split('@')[0] || 'Анонім',
      value: p.total_correct || 0,
    }));

  const passedByUser = {};
  allResults.forEach(r => {
    if (r.passed && r.created_by) {
      passedByUser[r.created_by] = (passedByUser[r.created_by] || 0) + 1;
    }
  });
  const topByPassed = Object.entries(passedByUser)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([email, count], i) => ({ rank: i + 1, email, name: email.split('@')[0], value: count }));

  const topMarathon = [...allProgress]
    .filter(p => (p.marathon_best || 0) > 0)
    .sort((a, b) => (b.marathon_best || 0) - (a.marathon_best || 0))
    .slice(0, 10)
    .map((p, i) => ({
      rank: i + 1,
      email: p.created_by || '—',
      name: p.created_by?.split('@')[0] || 'Анонім',
      value: p.marathon_best || 0,
    }));

  const rankIcon = (rank) => {
    if (rank === 1) return <Trophy className="w-5 h-5 text-yellow-500" />;
    if (rank === 2) return <Medal className="w-5 h-5 text-slate-400" />;
    if (rank === 3) return <Medal className="w-5 h-5 text-amber-600" />;
    return <span className="w-5 h-5 flex items-center justify-center text-sm font-bold text-muted-foreground">{rank}</span>;
  };

  const isMe = (email) => email === user?.email;

  const LeaderTable = ({ data, valueLabel }) => (
    <div className="space-y-2">
      {data.length === 0 && <p className="text-muted-foreground text-sm text-center py-6">Поки немає даних</p>}
      {data.map((row, i) => (
        <motion.div
          key={row.email}
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.05 }}
          className={cn("flex items-center gap-3 p-3 rounded-xl border transition-all",
            isMe(row.email) ? "border-primary bg-primary/5 font-semibold" : "border-border bg-card"
          )}
        >
          <div className="w-8 flex items-center justify-center shrink-0">{rankIcon(row.rank)}</div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">
              {row.name}
              {isMe(row.email) && <span className="ml-2 text-xs text-primary">(Ви)</span>}
            </p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-sm font-bold text-foreground">{row.value}</p>
            <p className="text-xs text-muted-foreground">{valueLabel}</p>
          </div>
        </motion.div>
      ))}
    </div>
  );

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
          <Trophy className="w-8 h-8 text-yellow-500" />
          Таблиця лідерів
        </h1>
        <p className="text-muted-foreground mt-1">ТОП-10 найкращих учнів платформи</p>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Star className="w-5 h-5 text-primary" />За правильними відповідями
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? <div className="flex justify-center py-8"><div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" /></div>
              : <LeaderTable data={topByCorrect} valueLabel="правильних" />}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-success" />За зданими іспитами
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? <div className="flex justify-center py-8"><div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" /></div>
              : <LeaderTable data={topByPassed} valueLabel="іспитів" />}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Trophy className="w-5 h-5 text-accent-foreground" />🏃 Режим Марафон — рекорди
          </CardTitle>
        </CardHeader>
        <CardContent>
          <LeaderTable data={topMarathon} valueLabel="питань поспіль" />
        </CardContent>
      </Card>
    </div>
  );
}