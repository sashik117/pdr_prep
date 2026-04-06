import { useState, useEffect } from 'react';
import { supabase } from '@/api/supabaseClient';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { XCircle, ArrowRight, BookOpen, AlertTriangle, RefreshCw } from 'lucide-react';
import { motion } from 'framer-motion';
import LoginPrompt from '@/components/auth/LoginPrompt';

export default function MistakesReview() {
  const navigate = useNavigate();
  const [user, setUser] = useState(undefined);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user || null)).catch(() => setUser(null));
  }, []);

  const { data: progressList = [], isLoading } = useQuery({
    queryKey: ['userProgress', user?.email],
    queryFn: async () => {
      const { data } = await supabase.from('user_progress').select('*').eq('created_by', user.email);
      return data || [];
    },
    enabled: !!user,
  });

  const { data: testResults = [] } = useQuery({
    queryKey: ['testResults'],
    queryFn: async () => {
      const { data } = await supabase.from('test_results').select('*').order('created_at', { ascending: false }).limit(200);
      return data || [];
    },
    enabled: !!user,
  });

  const { data: allQuestions = [] } = useQuery({
    queryKey: ['allQuestionsForMistakes'],
    queryFn: async () => {
      const { data } = await supabase.from('questions').select('*').eq('category', 'B');
      return data || [];
    },
    enabled: !!user,
  });

  if (user === undefined || isLoading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <LoginPrompt title="Робота над помилками" description="Увійдіть щоб бачити свої помилки та тренуватись на них" />;
  }

  const progress = progressList[0] || {};
  const difficultIds = new Set(progress.difficult_question_ids || []);

  const mistakeCount = {};
  testResults.forEach(result => {
    (result.answers || []).forEach(a => {
      if (!a.is_correct && a.question_id) {
        mistakeCount[a.question_id] = (mistakeCount[a.question_id] || 0) + 1;
      }
    });
  });

  const questionsMistakes = allQuestions
    .filter(q => mistakeCount[q.id] || difficultIds.has(q.id))
    .map(q => ({
      ...q,
      mistakeCount: mistakeCount[q.id] || 0,
      isDifficult: difficultIds.has(q.id),
    }))
    .sort((a, b) => b.mistakeCount - a.mistakeCount);

  const byTopic = {};
  questionsMistakes.forEach(q => {
    const topic = q.topic || 'Інше';
    if (!byTopic[topic]) byTopic[topic] = [];
    byTopic[topic].push(q);
  });

  const topicsSorted = Object.entries(byTopic).sort((a, b) => b[1].length - a[1].length);

  const startTopicTest = (topic) => {
    const params = new URLSearchParams({ mode: 'difficult', category: 'B', topic });
    navigate(`/test?${params.toString()}`);
  };

  const startFullMistakesTest = () => navigate('/test?mode=difficult&category=B');

  if (questionsMistakes.length === 0) {
    return (
      <div className="max-w-xl mx-auto py-20 text-center space-y-4">
        <div className="text-6xl">🎉</div>
        <h2 className="text-2xl font-bold text-foreground">Помилок не знайдено!</h2>
        <p className="text-muted-foreground">Пройдіть кілька тестів, щоб система визначила ваші слабкі місця.</p>
        <Button onClick={() => navigate('/tests')} className="gap-2">
          <BookOpen className="w-4 h-4" /> Почати тест
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
          <XCircle className="w-8 h-8 text-destructive" />
          Робота над помилками
        </h1>
        <p className="text-muted-foreground mt-1">
          Знайдено <span className="font-bold text-foreground">{questionsMistakes.length}</span> питань де ви помилилися
        </p>
      </motion.div>

      <Card className="border-destructive/30 bg-destructive/5">
        <CardContent className="p-5 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <p className="font-semibold text-foreground">Тест по всіх помилках</p>
            <p className="text-sm text-muted-foreground">{questionsMistakes.length} питань · тільки ваші помилки</p>
          </div>
          <Button onClick={startFullMistakesTest} className="gap-2 bg-destructive hover:bg-destructive/90">
            <RefreshCw className="w-4 h-4" /> Почати тренування
          </Button>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <h2 className="text-lg font-bold text-foreground">По темах</h2>
        {topicsSorted.map(([topic, questions], i) => (
          <motion.div key={topic} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}>
            <Card>
              <CardContent className="p-4 flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-destructive/10 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-6 h-6 text-destructive" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-foreground truncate">{topic}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="destructive" className="text-xs">{questions.length} помилок</Badge>
                    <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden max-w-24">
                      <div className="h-full bg-destructive rounded-full"
                        style={{ width: `${Math.min(100, (questions.length / questionsMistakes.length) * 100 * 3)}%` }} />
                    </div>
                  </div>
                  <div className="mt-2 space-y-0.5">
                    {questions.slice(0, 2).map(q => (
                      <p key={q.id} className="text-xs text-muted-foreground truncate">
                        • {q.text?.slice(0, 80)}...
                        {q.mistakeCount > 1 && <span className="text-destructive font-medium ml-1">({q.mistakeCount}×)</span>}
                      </p>
                    ))}
                  </div>
                </div>
                <Button size="sm" variant="outline" className="shrink-0 gap-1" onClick={() => startTopicTest(topic)}>
                  Тест <ArrowRight className="w-3 h-3" />
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <div className="space-y-3">
        <h2 className="text-lg font-bold text-foreground">Найчастіші помилки</h2>
        {questionsMistakes.slice(0, 5).map((q, i) => (
          <div key={q.id} className="flex items-start gap-3 p-4 rounded-xl border border-destructive/20 bg-destructive/5">
            <div className="w-7 h-7 rounded-full bg-destructive text-destructive-foreground text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
              {i + 1}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-foreground leading-relaxed line-clamp-2">{q.text}</p>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline" className="text-xs">{q.topic}</Badge>
                {q.mistakeCount > 0 && <span className="text-xs text-destructive font-medium">{q.mistakeCount} помилок</span>}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}