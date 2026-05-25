import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, CheckCircle2, Crown, FileQuestion, Lock, PlayCircle } from 'lucide-react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import api from '@/api/apiClient';
import { normalizeQuestion } from '@/api/questionsApi';
import { useAuth } from '@/lib/AuthContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { categoryGroups } from '@/lib/testCatalog';

function TicketQuestionPreview({ question, index }) {
  const options = question.options || [];

  return (
    <Card className="border-slate-200 shadow-none dark:border-slate-800">
      <CardContent className="space-y-4 p-4 sm:p-5">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-400">Питання {index + 1}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">{question.exam_block_label || question.topic}</p>
        </div>

        <p className="text-base leading-7 text-slate-900 dark:text-slate-50">{question.text}</p>

        {question.image_url ? (
          <div className="overflow-hidden rounded-xl bg-slate-50/70 dark:bg-slate-900/40">
            <img
              src={question.image_url}
              alt={`Ілюстрація до питання ${index + 1}`}
              className="max-h-72 w-full object-contain"
            />
          </div>
        ) : null}

        {options.length ? (
          <div className="grid gap-2.5">
            {options.map((option) => {
              const isCorrect = option.label === question.correct_answer;
              return (
                <div
                  key={option.label}
                  className={cn(
                    'flex items-start gap-3 rounded-lg border p-3.5 text-left transition-colors',
                    isCorrect
                      ? 'border-emerald-400 bg-emerald-50/70 ring-1 ring-emerald-300 dark:border-emerald-500/70 dark:bg-emerald-500/10 dark:ring-emerald-500/30'
                      : 'border-slate-200 bg-background dark:border-slate-800',
                  )}
                >
                  <span
                    className={cn(
                      'flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-sm font-medium',
                      isCorrect ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-600 dark:bg-slate-900 dark:text-slate-300',
                    )}
                  >
                    {option.label}
                  </span>
                  <span className="min-w-0 flex-1 pt-1 text-sm leading-6 text-slate-800 dark:text-slate-100">{option.text}</span>
                  {isCorrect ? <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-300" /> : null}
                </div>
              );
            })}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

export default function TicketDetailPage() {
  const { user } = useAuth();
  const { ticketNumber = '' } = useParams();
  const [searchParams] = useSearchParams();
  const numericTicket = Number(ticketNumber);
  const categoryFromUrl = searchParams.get('category') || 'B';
  const category = categoryGroups.some((item) => item.id === categoryFromUrl) ? categoryFromUrl : 'B';
  const categoryMeta = useMemo(() => categoryGroups.find((item) => item.id === category) || categoryGroups[1], [category]);
  const isPremium = Boolean(user?.is_premium);
  const lockedPreview = !isPremium && numericTicket > 3;

  const ticketQuery = useQuery({
    queryKey: ['ticket', numericTicket, category],
    queryFn: () => api.getTicket(numericTicket, category),
    enabled: Number.isFinite(numericTicket) && numericTicket > 0 && !lockedPreview,
    staleTime: 5 * 60 * 1000,
  });

  const questions = (ticketQuery.data?.questions || []).map(normalizeQuestion).filter(Boolean);
  const backHref = `/tickets?category=${encodeURIComponent(category)}`;
  const testHref = `/test?mode=ticket&ticket=${numericTicket}&category=${encodeURIComponent(category)}`;

  if (!Number.isFinite(numericTicket) || numericTicket <= 0 || lockedPreview) {
    return (
      <div className="mx-auto w-full max-w-2xl space-y-5 py-10 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-amber-500/12 text-amber-600 dark:text-amber-200">
          <Lock className="h-7 w-7" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-[-0.03em] text-slate-950 dark:text-white">Цей білет відкривається у Premium</h1>
          <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">
            Без Premium можна переглянути перші 3 білети. Повна добірка та проходження білетів як тест доступні після оформлення доступу.
          </p>
        </div>
        <div className="flex flex-col justify-center gap-3 sm:flex-row">
          <Button asChild variant="outline" className="rounded-lg">
            <Link to={backHref}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              До білетів
            </Link>
          </Button>
          <Button asChild className="rounded-lg">
            <Link to="/pricing">
              <Crown className="mr-2 h-4 w-4" />
              Переглянути Premium
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-5 pb-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Button asChild variant="outline" className="rounded-lg">
          <Link to={backHref}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Назад до білетів
          </Link>
        </Button>
      </div>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)] lg:items-start">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="rounded-lg px-3 py-1.5 text-xs font-medium">
              Категорія {categoryMeta.label}
            </Badge>
            <Badge variant="outline" className="rounded-lg border-emerald-200 text-emerald-700 dark:border-emerald-500/30 dark:text-emerald-200">
              Попередній перегляд доступний
            </Badge>
          </div>
          <h1 className="text-2xl font-semibold tracking-[-0.03em] text-slate-950 dark:text-white sm:text-3xl">Білет {numericTicket}</h1>
          <p className="text-sm leading-6 text-slate-600 dark:text-slate-300 sm:text-base">
            Білет можна пройти як тест. Нижче залишили попередній перегляд складу білета з варіантами відповідей і позначеною правильною відповіддю.
          </p>
        </div>

        <Card className="border-slate-200 shadow-none dark:border-slate-800">
          <CardContent className="space-y-4 p-4 sm:p-5">
            <div>
              <p className="text-sm font-medium text-slate-950 dark:text-white">Почати білет як тест</p>
              <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">
                У режимі тесту відповіді не підсвічуються до завершення.
              </p>
            </div>
            {isPremium ? (
              <Button asChild className="w-full rounded-lg">
                <Link to={testHref}>
                  <PlayCircle className="mr-2 h-4 w-4" />
                  Почати білет
                </Link>
              </Button>
            ) : (
              <Button asChild className="w-full rounded-lg">
                <Link to="/pricing">
                  <Crown className="mr-2 h-4 w-4" />
                  Проходження з Premium
                </Link>
              </Button>
            )}
          </CardContent>
        </Card>
      </section>

      <div className="grid gap-3 sm:grid-cols-4">
        {[
          ['ПДР', 10],
          ['Безпека', 4],
          ['Будова', 4],
          ['Медицина', 2],
        ].map(([label, count]) => (
          <Card key={label} className="border-slate-200 shadow-none dark:border-slate-800">
            <CardContent className="flex items-center gap-3 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary dark:bg-sky-400/10 dark:text-sky-200">
                <FileQuestion className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-950 dark:text-white">{label}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{count} пит.</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="space-y-4">
        {ticketQuery.isLoading ? (
          <div className="rounded-xl border border-slate-200 bg-card p-5 text-sm text-slate-500 dark:border-slate-800 dark:text-slate-300">
            Завантажуємо білет...
          </div>
        ) : questions.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-card p-5 text-sm text-slate-500 dark:border-slate-800 dark:text-slate-300">
            Для цього білета поки не вдалося підібрати питання. Спробуйте іншу категорію або поверніться до списку білетів.
          </div>
        ) : (
          questions.map((question, index) => (
            <TicketQuestionPreview key={question.id} question={question} index={index} />
          ))
        )}
      </div>
    </div>
  );
}
