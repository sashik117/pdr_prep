import { useState, useEffect } from 'react';
import { supabase } from '@/api/supabaseClient';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart3, CheckCircle, XCircle, TrendingUp, Target } from 'lucide-react';
import LoginPrompt from '@/components/auth/LoginPrompt';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { motion } from 'framer-motion';
import ActivityCalendar from '@/components/progress/ActivityCalendar';

export default function Progress() {
  const [user, setUser] = useState(undefined);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user || null)).catch(() => setUser(null));
  }, []);

  const { data: results = [], isLoading: loadingResults } = useQuery({
    queryKey: ['testResults'],
    queryFn: async () => {
      const { data } = await supabase.from('test_results').select('*').order('created_at', { ascending: false }).limit(50);
      return data || [];
    },
    enabled: !!user,
  });

  const { data: progressList = [], isLoading: loadingProgress } = useQuery({
    queryKey: ['userProgress'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data } = await supabase.from('user_progress').select('*').eq('created_by', user.email);
      return data || [];
    },
    enabled: !!user,
  });

  const isLoading = user === undefined || loadingResults || loadingProgress;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <LoginPrompt title="Мій прогрес" description="Увійдіть щоб бачити свою статистику, графіки та календар активності" />;
  }

  const progress = progressList[0] || {};
  const totalTests = progress.total_tests || 0;
  const totalCorrect = progress.total_correct || 0;
  const totalAnswered = progress.total_questions_answered || 0;
  const accuracy = totalAnswered > 0 ? Math.round((totalCorrect / totalAnswered) * 100) : 0;
  const passedCount = results.filter(r => r.passed).length;

  const stats = [
    { icon: BarChart3, label: 'Тестів пройдено', value: totalTests, color: 'text-primary' },
    { icon: Target, label: 'Точність', value: `${accuracy}%`, color: 'text-accent-foreground' },
    { icon: CheckCircle, label: 'Правильних', value: totalCorrect, color: 'text-success' },
    { icon: TrendingUp, label: 'Іспитів здано', value: passedCount, color: 'text-primary' },
  ];

  const chartData = results.slice(0, 7).reverse().map((r, i) => ({
    name: `Тест ${i + 1}`,
    score: r.score_percent || 0,
  }));

  const pieData = [
    { name: 'Правильні', value: totalCorrect, color: 'hsl(152, 60%, 45%)' },
    { name: 'Неправильні', value: Math.max(0, totalAnswered - totalCorrect), color: 'hsl(0, 84%, 60%)' },
  ];

  return (
    <div className="space-y-8">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-3xl font-bold text-foreground">Мій прогрес</h1>
        <p className="text-muted-foreground mt-1">Відстежуйте свій шлях до успіху</p>
      </motion.div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, i) => (
          <motion.div key={stat.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
            <Card>
              <CardContent className="p-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center">
                    <stat.icon className={`w-5 h-5 ${stat.color}`} />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                    <p className="text-xs text-muted-foreground">{stat.label}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {chartData.length > 0 && (
          <Card>
            <CardHeader><CardTitle className="text-base">Результати останніх тестів</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 15%, 90%)" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="score" fill="hsl(217, 91%, 50%)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {totalAnswered > 0 && (
          <Card>
            <CardHeader><CardTitle className="text-base">Відсоток правильних відповідей</CardTitle></CardHeader>
            <CardContent className="flex items-center justify-center">
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={4} dataKey="value">
                    {pieData.map((entry, index) => <Cell key={index} fill={entry.color} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Календар активності</CardTitle></CardHeader>
        <CardContent>
          <ActivityCalendar dates={progress.activity_dates || []} />
        </CardContent>
      </Card>

      {results.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Історія тестів</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {results.slice(0, 10).map((r) => (
                <div key={r.id} className="flex items-center justify-between p-3 rounded-xl bg-muted/50">
                  <div className="flex items-center gap-3">
                    {r.passed ? <CheckCircle className="w-5 h-5 text-success" /> : <XCircle className="w-5 h-5 text-destructive" />}
                    <div>
                      <p className="text-sm font-medium text-foreground capitalize">
                        {r.test_type === 'quick' ? 'Швидкий' : r.test_type === 'full' ? 'Повний' : r.test_type === 'daily' ? 'Виклик дня' : 'Складні'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(r.created_at).toLocaleDateString('uk-UA')}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold">{r.score_percent}%</p>
                    <p className="text-xs text-muted-foreground">{r.correct_answers}/{r.total_questions}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}