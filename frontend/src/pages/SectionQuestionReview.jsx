// @ts-nocheck
import { useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { ArrowLeft, CheckCircle2, ListChecks, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { fetchQuestions, normalizeQuestion } from '@/api/questionsApi';
import { categoryGroups } from '@/lib/testCatalog';
import { cn } from '@/lib/utils';

export default function SectionQuestionReview() {
  const navigate = useNavigate();
  const { sectionId = '' } = useParams();
  const [searchParams] = useSearchParams();
  const category = searchParams.get('category') || 'B';
  const title = searchParams.get('title') || 'Питання розділу';
  const requestedCount = Number(searchParams.get('count') || 120);
  const [answers, setAnswers] = useState({});

  const categoryMeta = useMemo(
    () => categoryGroups.find((item) => item.id === category) || categoryGroups.find((item) => item.id === 'B'),
    [category],
  );

  const questionsQuery = useQuery({
    queryKey: ['section-question-review', sectionId, category],
    enabled: Boolean(sectionId),
    queryFn: async () => {
      const response = await fetchQuestions({
        section: sectionId,
        category,
        limit: Math.min(300, Math.max(30, requestedCount || 120)),
      });
      const items = Array.isArray(response)
        ? response
        : Array.isArray(response?.items)
          ? response.items
          : Array.isArray(response?.questions)
            ? response.questions
            : [];
      return items.map(normalizeQuestion).filter(Boolean);
    },
  });

  const questions = questionsQuery.data || [];
  const answeredCount = Object.keys(answers).length;

  return (
    <motion.div
      className="mx-auto w-full max-w-5xl space-y-6 px-4 pb-8 sm:px-6 lg:px-8"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
    >
      <Button
        type="button"
        variant="ghost"
        className="-ml-2 rounded-full px-3"
        onClick={() => navigate(`/section-tests?category=${encodeURIComponent(category)}`)}
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Назад до розділів
      </Button>

      <section className="rounded-2xl border border-slate-200 bg-card p-5 shadow-md dark:border-slate-800 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary dark:bg-sky-400/10 dark:text-sky-200">
              <ListChecks className="h-6 w-6" />
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary" className="rounded-lg px-3 py-1.5 text-xs font-medium">
                Перегляд питань
              </Badge>
              <Badge variant="outline" className="rounded-lg px-3 py-1.5 text-xs font-medium">
                Категорія {categoryMeta?.label || category}
              </Badge>
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-[-0.04em] text-slate-950 dark:text-white sm:text-4xl">
                {title}
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300 sm:text-base">
                Тут можна спокійно переглянути всі питання розділу. Відповіді показуються одразу після вибору і не записуються у статистику.
              </p>
            </div>
          </div>
          <div className="rounded-2xl bg-slate-100 px-4 py-3 text-center dark:bg-slate-900">
            <p className="text-2xl font-semibold text-slate-950 dark:text-white">{answeredCount}</p>
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
              відповідей
            </p>
          </div>
        </div>
      </section>

      {questionsQuery.isLoading ? (
        <div className="rounded-2xl border border-slate-200 bg-card p-5 text-sm text-slate-500 shadow-sm dark:border-slate-800 dark:text-slate-300">
          Завантажуємо питання...
        </div>
      ) : null}

      {!questionsQuery.isLoading && questions.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-card p-5 text-sm text-slate-500 shadow-sm dark:border-slate-800 dark:text-slate-300">
          У цьому розділі поки немає питань для перегляду.
        </div>
      ) : null}

      <div className="space-y-4">
        {questions.map((question, index) => {
          const selected = answers[String(question.id)];
          const reveal = Boolean(selected);
          const isAnswerCorrect = selected === question.correct_answer;

          return (
            <article key={question.id} className="rounded-2xl border border-slate-200 bg-card p-4 shadow-sm dark:border-slate-800 sm:p-5">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">Питання {index + 1}</p>
                {reveal ? (
                  <Badge className={cn('rounded-lg', isAnswerCorrect ? 'bg-emerald-600' : 'bg-rose-600')}>
                    {isAnswerCorrect ? (
                      <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                    ) : (
                      <XCircle className="mr-1 h-3.5 w-3.5" />
                    )}
                    {isAnswerCorrect ? 'Правильно' : 'Неправильно'}
                  </Badge>
                ) : null}
              </div>

              <p className="text-base font-semibold leading-7 text-slate-950 dark:text-white">{question.text}</p>

              {question.image_url ? (
                <div className="mt-4 overflow-hidden rounded-xl bg-slate-50 dark:bg-slate-900/60">
                  <img
                    src={question.image_url}
                    alt={`Ілюстрація до питання ${index + 1}`}
                    className="max-h-80 w-full object-contain"
                  />
                </div>
              ) : null}

              <div className="mt-4 space-y-2">
                {(question.options || []).map((option) => {
                  const isSelected = selected === option.label;
                  const isCorrect = question.correct_answer === option.label;
                  return (
                    <button
                      key={option.label}
                      type="button"
                      disabled={reveal}
                      onClick={() => setAnswers((current) => ({ ...current, [String(question.id)]: option.label }))}
                      className={cn(
                        'flex w-full min-w-0 items-start gap-3 rounded-xl border p-3 text-left text-sm transition',
                        !reveal && 'border-slate-200 bg-white hover:border-primary/40 hover:bg-primary/5 dark:border-slate-700 dark:bg-slate-950',
                        reveal && isCorrect && 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-950/30 dark:text-emerald-200',
                        reveal && isSelected && !isCorrect && 'border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-500/30 dark:bg-rose-950/30 dark:text-rose-200',
                        reveal && !isSelected && !isCorrect && 'border-slate-200 bg-slate-50 text-slate-400 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-500',
                      )}
                    >
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                        {option.label}
                      </span>
                      <span className="min-w-0 flex-1 leading-6">{option.text}</span>
                    </button>
                  );
                })}
              </div>
            </article>
          );
        })}
      </div>
    </motion.div>
  );
}
