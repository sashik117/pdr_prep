import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, ArrowRight, BookOpen, RefreshCw, XCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useProtectedScreen } from '@/lib/useProtectedScreen';
import api from '@/api/apiClient';
import { fetchQuestions, normalizeQuestion } from '@/api/questionsApi';
import LoginPrompt from '@/components/auth/LoginPrompt';
import { cn } from '@/lib/utils';

function buildIdsParam(questions, count) {
  return questions.slice(0, count).map((question) => String(question.id)).join(',');
}

export default function MistakesReview() {
  const navigate = useNavigate();
  const { user, isCheckingAccess, canAccess } = useProtectedScreen();
  const [selectedCount, setSelectedCount] = useState(0);

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

  const mistakeQuestions = mistakeQuestionsQuery.data || [];

  useEffect(() => {
    if (!mistakeQuestions.length) return;
    setSelectedCount((current) => {
      if (current > 0 && current <= mistakeQuestions.length) return current;
      return mistakeQuestions.length;
    });
  }, [mistakeQuestions.length]);

  const topicsSorted = useMemo(() => {
    const byTopic = {};
    mistakeQuestions.forEach((question) => {
      const topic = question.topic || 'Інше';
      if (!byTopic[topic]) byTopic[topic] = [];
      byTopic[topic].push(question);
    });
    return Object.entries(byTopic).sort((a, b) => b[1].length - a[1].length);
  }, [mistakeQuestions]);

  const countOptions = useMemo(() => {
    const total = mistakeQuestions.length;
    return [10, 20, 30, total]
      .filter((value, index, list) => value > 0 && value <= total && list.indexOf(value) === index);
  }, [mistakeQuestions.length]);

  const startMistakesTest = (questions = mistakeQuestions, count = selectedCount || mistakeQuestions.length) => {
    const safeCount = Math.max(1, Math.min(count, questions.length));
    const ids = buildIdsParam(questions, safeCount);
    const params = new URLSearchParams({ mode: 'difficult', category: 'B', ids, count: String(safeCount) });
    navigate(`/test?${params.toString()}`);
  };

  if (isCheckingAccess || (!!user && (isLoading || mistakeQuestionsQuery.isLoading))) {
    return (
      <div className="flex justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary/30 border-t-primary" />
      </div>
    );
  }

  if (!canAccess || !user) {
    return (
      <LoginPrompt
        title="Мої помилки"
        description="Увійдіть, щоб бачити питання, у яких Ви помилялися, та повторювати саме слабкі теми."
      />
    );
  }

  if (mistakeQuestions.length === 0) {
    return (
      <div className="mx-auto w-full max-w-3xl space-y-5 px-4 py-12 text-center sm:px-6">
        <Button type="button" variant="ghost" className="mx-auto rounded-full px-3" onClick={() => navigate(-1)}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Назад
        </Button>
        <Card className="border-slate-200 bg-card shadow-md dark:border-slate-800">
          <CardContent className="space-y-4 p-8">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-200">
              <BookOpen className="h-7 w-7" />
            </div>
            <h1 className="text-2xl font-semibold tracking-[-0.03em] text-slate-950 dark:text-white">Помилок поки немає</h1>
            <p className="mx-auto max-w-md text-sm leading-6 text-slate-600 dark:text-slate-300">
              Пройдіть кілька тестів, і тут з’являться питання, які варто повторити окремо.
            </p>
            <Button onClick={() => navigate('/tests')} className="rounded-xl">
              Почати тест
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 pb-8 sm:px-6 lg:px-8">
      <Button type="button" variant="ghost" className="-ml-2 rounded-full px-3" onClick={() => navigate(-1)}>
        <ArrowLeft className="mr-2 h-4 w-4" />
        Назад
      </Button>

      <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="overflow-hidden border-red-100 bg-[linear-gradient(135deg,rgba(254,242,242,0.98),rgba(255,255,255,0.98)_54%,rgba(239,246,255,0.92))] shadow-[0_24px_60px_rgba(239,68,68,0.08)] dark:border-red-500/20 dark:bg-[linear-gradient(135deg,rgba(127,29,29,0.34),rgba(15,23,42,0.98)_56%,rgba(2,6,23,0.98))]">
          <CardContent className="grid gap-6 p-5 sm:p-7 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            <div>
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-100 text-red-600 dark:bg-red-500/10 dark:text-red-200">
                <XCircle className="h-7 w-7" />
              </div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-red-500 dark:text-red-300">Робота над помилками</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-slate-950 dark:text-white sm:text-4xl">
                Тест по всіх помилках
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600 dark:text-slate-200 sm:text-base">
                Зібрали {mistakeQuestions.length} питань, у яких Ви вже помилялися. Можна пройти всі одразу або вибрати коротше тренування.
              </p>
            </div>

            <div className="rounded-2xl border border-white/70 bg-white/80 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950/70">
              <p className="text-sm font-semibold text-slate-900 dark:text-white">Скільки питань пройти?</p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {countOptions.map((count) => (
                  <button
                    key={count}
                    type="button"
                    className={cn(
                      'rounded-xl border px-3 py-2 text-sm font-semibold transition-all',
                      selectedCount === count
                        ? 'border-red-500 bg-red-500 text-white shadow-[0_12px_24px_rgba(239,68,68,0.22)]'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-red-200 hover:bg-red-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:hover:border-red-500/30 dark:hover:bg-red-950/25',
                    )}
                    onClick={() => setSelectedCount(count)}
                  >
                    {count === mistakeQuestions.length ? `Усі ${count}` : count}
                  </button>
                ))}
              </div>
              <Button className="mt-4 w-full rounded-xl bg-red-600 hover:bg-red-700" onClick={() => startMistakesTest()}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Почати тренування
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.section>

      <section className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold tracking-[-0.03em] text-slate-950 dark:text-white">Помилки по темах</h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Найбільші групи показані першими, щоб Ви швидше бачили слабкі місця.</p>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          {topicsSorted.map(([topic, questions], index) => (
            <motion.div key={topic} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.04 }}>
              <Card className="h-full border-slate-200 bg-card shadow-md transition-all hover:border-red-200 hover:shadow-lg dark:border-slate-800 dark:hover:border-red-500/30">
                <CardContent className="flex h-full flex-col gap-4 p-5 pt-6">
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-200">
                      <AlertTriangle className="h-6 w-6" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-base font-semibold text-slate-950 dark:text-white">{topic}</p>
                      <Badge variant="destructive" className="mt-2 rounded-lg text-xs">{questions.length} помилок</Badge>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {questions.slice(0, 2).map((question) => (
                      <p key={question.id} className="line-clamp-2 rounded-xl bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-600 dark:bg-slate-900 dark:text-slate-300">
                        {question.text}
                      </p>
                    ))}
                  </div>

                  <Button variant="outline" className="mt-auto justify-between rounded-xl" onClick={() => startMistakesTest(questions, questions.length)}>
                    Тест по темі
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </section>
    </div>
  );
}
