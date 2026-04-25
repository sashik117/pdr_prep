import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { XCircle, ArrowRight, BookOpen, AlertTriangle, RefreshCw } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuth } from '@/lib/AuthContext';
import api from '@/api/apiClient';
import { fetchQuestions, normalizeQuestion } from '@/api/questionsApi';
import LoginPrompt from '@/components/auth/LoginPrompt';

export default function MistakesReview() {
  const navigate = useNavigate();
  const { user, isLoadingAuth } = useAuth();

  /** @type {{ data: import('@/types/app').StatsResponse | undefined, isLoading: boolean }} */
  const { data: stats, isLoading } = useQuery({
    queryKey: ['mistakes-stats'],
    queryFn: () => api.getStats(),
    enabled: !!user,
  });

  const difficultIds = stats?.difficult_question_ids || [];

  const mistakeQuestionsQuery = useQuery({
    queryKey: ['mistake-questions', difficultIds.join(',')],
    queryFn: async () => {
      if (!difficultIds.length) return [];
      const response = await fetchQuestions({ ids: difficultIds, limit: difficultIds.length });
      return (response.items || []).map(normalizeQuestion).filter(Boolean);
    },
    enabled: difficultIds.length > 0,
  });
  const mistakeQuestions = /** @type {import('@/types/questions').QuestionViewModel[]} */ (mistakeQuestionsQuery.data || []);

  if (isLoadingAuth || (!!user && isLoading)) {
    return <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" /></div>;
  }

  if (!user) {
    return <LoginPrompt title="Робота над помилками" description="Увійдіть, щоб бачити свої помилки та тренуватися саме на слабких темах." />;
  }

  /** @type {Record<string, import('@/types/questions').QuestionViewModel[]>} */
  const byTopic = {};
  mistakeQuestions.forEach((question) => {
    const topic = question.topic || 'Інше';
    if (!byTopic[topic]) byTopic[topic] = [];
    byTopic[topic].push(question);
  });
  const topicsSorted = Object.entries(byTopic).sort((a, b) => b[1].length - a[1].length);

  /** @param {string} topic */
  const startTopicTest = (topic) => {
    const params = new URLSearchParams({ mode: 'difficult', category: 'B', topic });
    navigate(`/test?${params.toString()}`);
  };

  const startFullMistakesTest = () => navigate('/test?mode=difficult&category=B');

  if (mistakeQuestions.length === 0) {
    return (
      <div className="max-w-xl mx-auto py-20 text-center space-y-4">
        <div className="text-6xl">🎉</div>
        <h2 className="text-2xl font-bold text-foreground">Помилок не знайдено</h2>
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
        <p className="text-muted-foreground mt-1">Знайдено <span className="font-bold text-foreground">{mistakeQuestions.length}</span> питань для повторення</p>
      </motion.div>

      <Card className="border-destructive/30 bg-destructive/5">
        <CardContent className="p-5 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <p className="font-semibold text-foreground">Тест по всіх помилках</p>
            <p className="text-sm text-muted-foreground">{mistakeQuestions.length} питань · тільки ваші помилки</p>
          </div>
          <Button onClick={startFullMistakesTest} className="gap-2 bg-destructive hover:bg-destructive/90">
            <RefreshCw className="w-4 h-4" /> Почати тренування
          </Button>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <h2 className="text-lg font-bold text-foreground">По темах</h2>
        {topicsSorted.map(([topic, questions], index) => (
          <motion.div key={topic} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * 0.05 }}>
            <Card>
              <CardContent className="p-4 flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-destructive/10 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-6 h-6 text-destructive" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-foreground truncate">{topic}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="destructive" className="text-xs">{questions.length} помилок</Badge>
                  </div>
                  <div className="mt-2 space-y-0.5">
                    {questions.slice(0, 2).map((question) => (
                      <p key={question.id} className="text-xs text-muted-foreground truncate">• {question.text?.slice(0, 80)}...</p>
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
    </div>
  );
}
