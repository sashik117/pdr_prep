import { useState, useEffect } from 'react';
import { supabase } from '@/api/supabaseClient';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { User, Mail, LogOut, BarChart3, Trophy, BookOpen, UserPlus, XCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';

export default function Profile() {
  const navigate = useNavigate();
  const [user, setUser] = useState(undefined);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user || null)).catch(() => setUser(null));
  }, []);

  const { data: progressList = [] } = useQuery({
    queryKey: ['userProgress'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data } = await supabase.from('user_progress').select('*').eq('created_by', user.email);
      return data || [];
    },
    enabled: !!user,
  });

  const { data: results = [] } = useQuery({
    queryKey: ['testResults'],
    queryFn: async () => {
      const { data } = await supabase.from('test_results').select('*').order('created_at', { ascending: false }).limit(100);
      return data || [];
    },
    enabled: !!user,
  });

  if (user === undefined) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="max-w-xl mx-auto py-20 text-center space-y-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="w-20 h-20 rounded-3xl bg-muted flex items-center justify-center mx-auto mb-6">
            <User className="w-10 h-10 text-muted-foreground" />
          </div>
          <h2 className="text-2xl font-bold text-foreground">Ви не увійшли</h2>
          <p className="text-muted-foreground mt-2 max-w-sm mx-auto">
            Увійдіть або зареєструйтесь, щоб зберігати прогрес, отримувати досягнення та потрапити в рейтинг
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-3 mt-8">
            <Button size="lg" className="gap-2 rounded-xl px-8" onClick={() => navigate('/login')}>
              <User className="w-5 h-5" /> Увійти
            </Button>
            <Button size="lg" variant="outline" className="gap-2 rounded-xl px-8" onClick={() => navigate('/login')}>
              <UserPlus className="w-5 h-5" /> Зареєструватись
            </Button>
          </div>
          <div className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-4 text-left">
            {[
              { icon: BarChart3, title: 'Прогрес та статистика', desc: 'Відстежуйте свій розвиток' },
              { icon: Trophy, title: 'Досягнення', desc: 'Отримуйте нагороди за успіхи' },
              { icon: BookOpen, title: 'Таблиця лідерів', desc: 'Змагайтесь з іншими учнями' },
            ].map((f) => (
              <div key={f.title} className="p-4 rounded-xl border border-border bg-card flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <f.icon className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{f.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    );
  }

  const progress = progressList[0] || {};
  const totalTests = progress.total_tests || 0;
  const totalCorrect = progress.total_correct || 0;
  const totalAnswered = progress.total_questions_answered || 0;
  const accuracy = totalAnswered > 0 ? Math.round((totalCorrect / totalAnswered) * 100) : 0;

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-3xl font-bold text-foreground">Профіль</h1>
      </motion.div>

      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
              <User className="w-8 h-8 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-foreground">{user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Користувач'}</h2>
              <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-1">
                <Mail className="w-3.5 h-3.5" />{user?.email || ''}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-3 gap-4">
        <Card><CardContent className="p-5 text-center">
          <BookOpen className="w-6 h-6 text-primary mx-auto mb-2" />
          <p className="text-2xl font-bold text-foreground">{totalTests}</p>
          <p className="text-xs text-muted-foreground">Тестів</p>
        </CardContent></Card>
        <Card><CardContent className="p-5 text-center">
          <BarChart3 className="w-6 h-6 text-primary mx-auto mb-2" />
          <p className="text-2xl font-bold text-foreground">{accuracy}%</p>
          <p className="text-xs text-muted-foreground">Точність</p>
        </CardContent></Card>
        <Card><CardContent className="p-5 text-center">
          <Trophy className="w-6 h-6 text-primary mx-auto mb-2" />
          <p className="text-2xl font-bold text-foreground">{results.filter(r => r.passed).length}</p>
          <p className="text-xs text-muted-foreground">Здано</p>
        </CardContent></Card>
      </div>

      <div className="space-y-3">
        <Button asChild variant="outline" className="w-full justify-start h-12 gap-3">
          <Link to="/progress"><BarChart3 className="w-5 h-5" />Детальна статистика</Link>
        </Button>
        <Button asChild variant="outline" className="w-full justify-start h-12 gap-3">
          <Link to="/achievements"><Trophy className="w-5 h-5" />Мої досягнення</Link>
        </Button>
        <Button asChild variant="outline" className="w-full justify-start h-12 gap-3">
          <Link to="/mistakes"><XCircle className="w-5 h-5 text-destructive" />Робота над помилками</Link>
        </Button>
        <Button asChild variant="outline" className="w-full justify-start h-12 gap-3">
          <Link to="/signs"><BookOpen className="w-5 h-5 text-primary" />Тренажер знаків</Link>
        </Button>
        <Button variant="outline" className="w-full justify-start h-12 gap-3 text-destructive hover:text-destructive" onClick={handleLogout}>
          <LogOut className="w-5 h-5" />Вийти з акаунту
        </Button>
      </div>
    </div>
  );
}