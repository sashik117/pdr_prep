// @ts-nocheck
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, BookmarkCheck, FileCheck2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import api from '@/api/apiClient';
import { normalizeQuestion } from '@/api/questionsApi';
import QuestionCard from '@/components/test/QuestionCard';
import { getSavedQuestionIds, isQuestionSaved, toggleSavedQuestion } from '@/lib/savedQuestions';

export default function SavedQuestions() {
  const navigate = useNavigate();
  const [savedIds, setSavedIds] = useState(() => getSavedQuestionIds());
  const idsKey = savedIds.join(',');

  useEffect(() => {
    const refresh = () => setSavedIds(getSavedQuestionIds());
    window.addEventListener('driveprep:saved-questions-change', refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener('driveprep:saved-questions-change', refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);

  const questionsQuery = useQuery({
    queryKey: ['saved-questions', idsKey],
    enabled: savedIds.length > 0,
    queryFn: async () => {
      const response = await api.getQuestions({ ids: idsKey, limit: Math.max(savedIds.length, 1) });
      const items = (response?.items || []).map(normalizeQuestion).filter(Boolean);
      const order = new Map(savedIds.map((id, index) => [String(id), index]));
      return items.sort((left, right) => (order.get(String(left.id)) ?? 9999) - (order.get(String(right.id)) ?? 9999));
    },
  });

  const questions = useMemo(() => questionsQuery.data || [], [questionsQuery.data]);

  if (!savedIds.length) {
    return (
      <div className="mx-auto w-full max-w-5xl space-y-5 pb-6">
        <BackButton onClick={() => navigate(-1)} />
        <div className="mx-auto flex max-w-xl flex-col items-center gap-4 py-16 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <BookmarkCheck className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-slate-950 dark:text-white">Збережених запитань поки немає</h1>
            <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
              Натисніть закладку біля питання під час тесту, і воно з’явиться тут для повторення.
            </p>
          </div>
          <Button asChild className="rounded-lg">
            <Link to="/tests">
              <FileCheck2 className="mr-2 h-4 w-4" />
              Перейти до тестів
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-5 pb-6">
      <BackButton onClick={() => navigate(-1)} />

      <section className="rounded-xl border border-slate-200 bg-card p-4 dark:border-slate-800 sm:p-5">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-primary">Збережені запитання</p>
        <h1 className="mt-2 text-2xl font-semibold text-slate-950 dark:text-white">Ваш список для повторення</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
          Тут зібрані питання, до яких Ви захотіли повернутися. Приберіть закладку, коли матеріал уже зрозумілий.
        </p>
      </section>

      {questionsQuery.isLoading ? (
        <div className="py-12 text-center text-sm text-slate-500 dark:text-slate-300">Завантажуємо збережені запитання...</div>
      ) : (
        <div className="space-y-4">
          {questions.map((question, index) => (
            <div key={question.id} className="rounded-xl border border-slate-200 bg-card p-4 dark:border-slate-800 sm:p-5">
              <QuestionCard
                question={question}
                index={index}
                totalQuestions={questions.length}
                selectedAnswer={undefined}
                onSelectAnswer={() => {}}
                isFavorite={isQuestionSaved(question.id)}
                onToggleFavorite={() => {
                  toggleSavedQuestion(question.id);
                  setSavedIds(getSavedQuestionIds());
                }}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function BackButton({ onClick }) {
  return (
    <Button type="button" variant="ghost" className="-ml-2 rounded-full px-3 text-slate-600 hover:text-slate-950 dark:text-slate-200 dark:hover:text-white" onClick={onClick}>
      <ArrowLeft className="mr-2 h-4 w-4" />
      Назад
    </Button>
  );
}
