// @ts-nocheck
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, BookmarkCheck, Eye, FileCheck2, PlayCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import api from '@/api/apiClient';
import { normalizeQuestion } from '@/api/questionsApi';
import QuestionCard from '@/components/test/QuestionCard';
import { getSavedQuestionIds, isQuestionSaved, loadSavedQuestionIds, toggleSavedQuestion } from '@/lib/savedQuestions';
import { useAuth } from '@/lib/AuthContext';
import LoginPrompt from '@/components/auth/LoginPrompt';

const MIN_SAVED_QUESTIONS_TO_TRAIN = 5;

export default function SavedQuestions() {
  const navigate = useNavigate();
  const { user, isLoadingAuth } = useAuth();
  const [savedIds, setSavedIds] = useState(() => getSavedQuestionIds());
  const [revealedAnswers, setRevealedAnswers] = useState({});
  const idsKey = savedIds.join(',');

  const savedIdsQuery = useQuery({
    queryKey: ['saved-question-ids', user?.id],
    enabled: Boolean(user),
    queryFn: () => loadSavedQuestionIds(user),
  });

  useEffect(() => {
    const refresh = () => setSavedIds(getSavedQuestionIds());
    window.addEventListener('driveprep:saved-questions-change', refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener('driveprep:saved-questions-change', refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);

  useEffect(() => {
    if (Array.isArray(savedIdsQuery.data)) {
      setSavedIds(savedIdsQuery.data);
    }
  }, [savedIdsQuery.data]);

  const questionsQuery = useQuery({
    queryKey: ['saved-questions', idsKey],
    enabled: Boolean(user) && savedIds.length > 0,
    queryFn: async () => {
      const response = await api.getQuestions({ ids: idsKey, limit: Math.max(savedIds.length, 1) });
      const items = (response?.items || []).map(normalizeQuestion).filter(Boolean);
      const order = new Map(savedIds.map((id, index) => [String(id), index]));
      return items.sort((left, right) => (order.get(String(left.id)) ?? 9999) - (order.get(String(right.id)) ?? 9999));
    },
  });

  const questions = useMemo(() => questionsQuery.data || [], [questionsQuery.data]);
  const canStartSavedTest = questions.length >= MIN_SAVED_QUESTIONS_TO_TRAIN;
  const startSavedTest = () => {
    if (!canStartSavedTest) return;
    const ids = questions.map((question) => question.id).filter(Boolean).join(',');
    navigate(`/test?mode=saved&ids=${encodeURIComponent(ids)}&count=${questions.length}`);
  };

  if (isLoadingAuth) return null;

  if (!user) {
    return (
      <LoginPrompt
        title="Збережені запитання доступні після входу"
        description="Увійдіть або створіть профіль, щоб відкладати важливі питання й повертатися до них у будь-який момент."
      />
    );
  }

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
        <div className="mt-5 flex flex-col gap-3 rounded-xl bg-slate-50 p-3 dark:bg-slate-900/70 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-slate-900 dark:text-white">Тренування по збережених</p>
            <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
              {canStartSavedTest
                ? `${questions.length} питань готові для проходження.`
                : `Потрібно щонайменше ${MIN_SAVED_QUESTIONS_TO_TRAIN} збережених питань.`}
            </p>
          </div>
          <Button className="rounded-lg" disabled={!canStartSavedTest || questionsQuery.isLoading} onClick={startSavedTest}>
            <PlayCircle className="mr-2 h-4 w-4" />
            Пройти збережені
          </Button>
        </div>
      </section>

      {questionsQuery.isLoading ? (
        <div className="py-12 text-center text-sm text-slate-500 dark:text-slate-300">Завантажуємо збережені запитання...</div>
      ) : (
        <div className="space-y-4">
          {questions.map((question, index) => (
            <div key={question.id} className="rounded-xl border border-slate-200 bg-card p-4 dark:border-slate-800 sm:p-5">
              <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
                  Збережене питання {index + 1} з {questions.length}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full rounded-lg sm:w-auto"
                  onClick={() => setRevealedAnswers((current) => ({ ...current, [question.id]: !current[question.id] }))}
                >
                  <Eye className="mr-2 h-4 w-4" />
                  {revealedAnswers[question.id] ? 'Сховати відповідь' : 'Переглянути правильну відповідь'}
                </Button>
              </div>
              <QuestionCard
                question={question}
                index={index}
                totalQuestions={questions.length}
                selectedAnswer={revealedAnswers[question.id] ? question.correct_answer : undefined}
                onSelectAnswer={() => {}}
                revealAnswer={Boolean(revealedAnswers[question.id])}
                isFavorite={isQuestionSaved(question.id)}
                onToggleFavorite={() => {
                  toggleSavedQuestion(question.id, user);
                  setSavedIds(getSavedQuestionIds());
                  setRevealedAnswers((current) => {
                    const next = { ...current };
                    delete next[question.id];
                    return next;
                  });
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
