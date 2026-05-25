// @ts-nocheck
import { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { UNSAFE_NavigationContext, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Brain, CheckCircle, ChevronLeft, ChevronRight, Clock, Ghost, Flame, Star } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/lib/AuthContext';
import { cn } from '@/lib/utils';
import { fetchRandomQuestions, normalizeQuestion } from '@/api/questionsApi';
import api from '@/api/apiClient';
import { queuePendingTestResult } from '@/lib/offlineProgress';
import QuestionCard from '@/components/test/QuestionCard';
import QuestionNavigator from '@/components/test/QuestionNavigator';
import SituationAnalysisModal from '@/components/test/SituationAnalysisModal';
import GhostBar from '@/components/test/GhostBar';
import LoginPrompt from '@/components/auth/LoginPrompt';
import { canStartFreeTest, registerFreeTestCompletion } from '@/lib/accessLimits';
import { getSavedQuestionIds, isQuestionSaved, toggleSavedQuestion } from '@/lib/savedQuestions';
import { playTone } from '@/lib/soundEffects';

const AUTO_ADVANCE_DELAY_MS = 1100;

const MODE_CONFIG = {
  quick: { count: 10, label: 'Швидкий тест', time: 600 },
  full: { count: 20, label: 'Тренування 20 питань', time: 1200 },
  mvs: { count: 20, label: 'Іспит МВС', time: 1200 },
  difficult: { count: 10, label: 'Мої помилки', time: 600 },
  top: { count: 20, label: 'Топ 100 помилок', time: 1200 },
  section: { count: 20, label: 'Тест за розділом', time: 1200 },
  daily: { count: 15, label: 'Виклик дня', time: 900 },
  srs: { count: 20, label: 'Інтервальне повторення', time: 1200 },
  ticket: { count: 20, label: 'Екзаменаційний білет', time: 1200 },
};

const answerToIndex = (answer) => ['A', 'B', 'C', 'D', 'E', 'F'].indexOf(answer || '') + 1;
const guestTestKey = `guest_test_limit:${new Date().toISOString().slice(0, 10)}`;

export default function TakeTest() {
  const navigate = useNavigate();
  const { navigator } = useContext(UNSAFE_NavigationContext);
  const { user, isLoadingAuth } = useAuth();
  const queryClient = useQueryClient();
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const mode = params.get('mode') || 'quick';
  const category = params.get('category') || '';
  const topic = params.get('topic') || '';
  const section = params.get('section') || '';
  const ticket = params.get('ticket') || '';
  const config = MODE_CONFIG[/** @type {keyof typeof MODE_CONFIG} */ (mode)] || MODE_CONFIG.quick;
  const requiresAuth = mode === 'difficult';
  const premiumOnly = mode === 'mvs' || mode === 'ticket';
  const guestLocked = !user && localStorage.getItem(guestTestKey) === '1';

  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [showResults, setShowResults] = useState(false);
  const [timeLeft, setTimeLeft] = useState(config.time);
  const [questions, setQuestions] = useState([]);
  const [resultMeta, setResultMeta] = useState(null);
  const [analyzingQuestion, setAnalyzingQuestion] = useState(null);
  const [exitDialogOpen, setExitDialogOpen] = useState(false);
  const [finishDialogOpen, setFinishDialogOpen] = useState(false);
  const [ghostEnabled, setGhostEnabled] = useState(() => {
    const raw = localStorage.getItem('ghost_bar_enabled');
    return raw === null ? true : raw === '1';
  });
  const [ghostBestTime, setGhostBestTime] = useState(0);
  const [limitBlocked, setLimitBlocked] = useState(false);
  const [, setSavedIds] = useState(() => getSavedQuestionIds());
  const startTimeRef = useRef(Date.now());
  const autoAdvanceRef = useRef(/** @type {number | null} */ (null));
  const allowNavigationRef = useRef(false);
  const { toast } = useToast();
  const [pendingNavigation, setPendingNavigation] = useState(null);

  const ghostKey = useMemo(
    () => `ghost_best_time:${mode}:${category || 'all'}:${section || 'all'}:${topic || 'all'}`,
    [mode, category, section, topic],
  );

  const { data: rawQuestions = [], isLoading } = useQuery({
    queryKey: ['take-test', mode, category, topic, section, ticket, user?.id],
    enabled: (!requiresAuth || !!user) && !guestLocked,
    queryFn: async () => {
      const seed = mode === 'top' ? `top100:${category || 'all'}` : undefined;
      if (mode === 'mvs') {
        const response = await api.getMvsExamQuestions({ category: category || 'B' });
        return (response?.questions || response || []).map(normalizeQuestion).filter(Boolean);
      }
      if (mode === 'ticket' && ticket) {
        const response = await api.getTicket(ticket, category || 'B');
        return (response?.questions || []).map(normalizeQuestion).filter(Boolean);
      }
      const response = await fetchRandomQuestions({
        count: config.count,
        category: category || undefined,
        section: section || undefined,
        topic: topic || undefined,
        difficultOnly: mode === 'difficult',
        seed,
      });
      return response.map(normalizeQuestion).filter(Boolean);
    },
  });

  useEffect(() => {
    if (rawQuestions.length === 0) return;
    setQuestions(rawQuestions);
    setAnswers({});
    setCurrentIndex(0);
    setShowResults(false);
    setTimeLeft(config.time);
    startTimeRef.current = Date.now();
  }, [rawQuestions, config.time]);

  useEffect(() => () => {
    if (autoAdvanceRef.current) {
      window.clearTimeout(autoAdvanceRef.current);
    }
  }, []);

  useEffect(() => {
    if (user?.is_premium) return;
    if (premiumOnly) {
      setLimitBlocked(true);
      return;
    }
    if (['quick', 'full', 'difficult', 'section', 'top'].includes(mode) && !canStartFreeTest(user, mode)) {
      setLimitBlocked(true);
    }
  }, [mode, premiumOnly, user]);

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
    const raw = Number(localStorage.getItem(ghostKey));
    setGhostBestTime(Number.isFinite(raw) && raw > 0 ? raw : 0);
  }, [ghostKey]);

  useEffect(() => {
    if (showResults || questions.length === 0) return;
    const timer = setInterval(() => {
      setTimeLeft((value) => {
        if (value <= 1) {
          clearInterval(timer);
          void handleFinish();
          return 0;
        }
        return value - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [showResults, questions.length]);

  useEffect(() => {
    if (showResults || questions.length === 0) return undefined;
    const handleBeforeUnload = (event) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [questions.length, showResults]);

  const clearAutoAdvance = () => {
    if (autoAdvanceRef.current) {
      window.clearTimeout(autoAdvanceRef.current);
      autoAdvanceRef.current = null;
    }
  };

  const goToQuestion = (index) => {
    clearAutoAdvance();
    setCurrentIndex(Math.max(0, Math.min(index, questions.length - 1)));
  };

  const handleSelectAnswer = (label) => {
    const question = questions[currentIndex];
    if (!question) return;
    if (answers[String(question.id)]) return;
    setAnswers((prev) => ({ ...prev, [String(question.id)]: label }));
    playTone(label === question.correct_answer ? 'correct' : 'wrong');

    if (autoAdvanceRef.current) {
      window.clearTimeout(autoAdvanceRef.current);
    }
    autoAdvanceRef.current = window.setTimeout(() => {
      const isLastQuestion = currentIndex >= questions.length - 1;
      if (!isLastQuestion) {
        setCurrentIndex((value) => Math.min(value + 1, questions.length - 1));
      }
    }, AUTO_ADVANCE_DELAY_MS);
  };

  const handleFinish = async () => {
    if (showResults || questions.length === 0) return;
    clearAutoAdvance();
    setShowResults(true);
    playTone('finish');
    const timeSpent = Math.floor((Date.now() - startTimeRef.current) / 1000);
    const correct = questions.filter((question) => answers[String(question.id)] === question.correct_answer).length;
    const nextBest = ghostBestTime > 0 ? Math.min(ghostBestTime, timeSpent) : timeSpent;
    setGhostBestTime(nextBest);
    localStorage.setItem(ghostKey, String(nextBest));

    const resultPayload = {
      section: section || topic || null,
      mode,
      total: questions.length,
      correct,
      time_seconds: timeSpent,
      answers: questions.map((question) => ({
        question_id: Number(question.id),
        selected_index: answerToIndex(answers[String(question.id)]),
        is_correct: answers[String(question.id)] === question.correct_answer,
        time_ms: null,
      })),
    };

    let response = null;
    let resultSyncStatus = user ? 'pending' : 'guest';
    if (user) {
      try {
        response = await api.submitTestResult(resultPayload);
        resultSyncStatus = 'synced';
        if (!user?.is_premium && ['quick', 'full', 'difficult', 'section', 'top'].includes(mode)) {
          registerFreeTestCompletion(user, mode);
        }
        await Promise.allSettled([
          queryClient.invalidateQueries({ queryKey: ['cabinet-stats'] }),
          queryClient.invalidateQueries({ queryKey: ['analytics-stats'] }),
          queryClient.invalidateQueries({ queryKey: ['analytics-results'] }),
          queryClient.invalidateQueries({ queryKey: ['mistakes-stats'] }),
          queryClient.invalidateQueries({ queryKey: ['achievements'] }),
          queryClient.invalidateQueries({ queryKey: ['friends-list'] }),
          queryClient.invalidateQueries({ queryKey: ['notification-summary'] }),
        ]);

        (response?.new_achievements || []).forEach((achievement) => {
          toast({
            title: `Нове досягнення: ${achievement.name}`,
            description: achievement.description,
          });
        });
      } catch {
        resultSyncStatus = 'queued_offline';
        if (!user?.is_premium && ['quick', 'full', 'difficult', 'section', 'top'].includes(mode)) {
          registerFreeTestCompletion(user, mode);
        }
        await queuePendingTestResult(resultPayload);
        toast({
          title: 'Результат збережено офлайн',
          description: 'Ми автоматично надішлемо його на сервер, щойно з’явиться інтернет.',
        });
      }
    } else {
      localStorage.setItem(guestTestKey, '1');
    }

    const streakValue =
      typeof response?.streak_days === 'number'
        ? response.streak_days
        : typeof response?.streak === 'number'
          ? response.streak
          : streakFallback(correct, questions.length);
    const totalStars =
      typeof response?.available_stars === 'number'
        ? response.available_stars
        : typeof response?.total_stars === 'number'
          ? response.total_stars
          : null;
    const earnedStar =
      typeof response?.earned_star === 'boolean'
        ? response.earned_star
        : questions.length > 0 && correct === questions.length;
    const rewardDataMissing = Boolean(user && resultSyncStatus === 'synced' && (!response || totalStars === null));

    setResultMeta({
      correct,
      total: questions.length,
      percent: questions.length > 0 ? Math.round((correct / questions.length) * 100) : 0,
      perfect: questions.length > 0 && correct === questions.length,
      streak: streakValue,
      streakActivated: (response?.streak_status ?? 'active') === 'active' && (user?.streak_status || 'inactive') !== 'active',
      streakRestored: !!response?.streak_restored,
      restoresLeft: response?.streak_restores_left ?? null,
      totalStars,
      earnedStar,
      syncStatus: resultSyncStatus,
      rewardDataMissing,
    });
  };

  const currentQuestion = questions[currentIndex];
  const answeredCount = Object.keys(answers).length;
  const correctCount = questions.filter((question) => answers[String(question.id)] === question.correct_answer).length;
  const passed = questions.length > 0 && correctCount / questions.length >= 0.8;
  const hasStartedUnfinishedTest = !showResults && questions.length > 0;

  useEffect(() => {
    if (!hasStartedUnfinishedTest || typeof navigator?.block !== 'function') return undefined;
    const unblock = navigator.block((transition) => {
      if (allowNavigationRef.current) {
        allowNavigationRef.current = false;
        unblock();
        transition.retry();
        return;
      }
      setPendingNavigation(() => () => {
        unblock();
        transition.retry();
      });
      setExitDialogOpen(true);
    });
    return unblock;
  }, [hasStartedUnfinishedTest, navigator]);

  useEffect(() => {
    if (!hasStartedUnfinishedTest) return undefined;

    const handleDocumentClick = (event) => {
      if (event.defaultPrevented || allowNavigationRef.current) return;
      if (event.button && event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const target = event.target instanceof Element ? event.target : null;
      if (!target) return;

      const anchor = target.closest('a[href]');
      if (anchor) {
        const href = anchor.getAttribute('href') || '';
        if (anchor.target || anchor.hasAttribute('download') || href.startsWith('#')) return;

        const nextUrl = new URL(anchor.href, window.location.href);
        if (nextUrl.origin !== window.location.origin) return;

        const currentPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;
        const nextPath = `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`;
        if (nextPath === currentPath) return;

        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation?.();
        setPendingNavigation(() => () => navigate(nextPath));
        setExitDialogOpen(true);
        return;
      }

      const backButton = target.closest('button[aria-label="Назад"]');
      if (backButton) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation?.();
        setPendingNavigation(() => () => navigate(-1));
        setExitDialogOpen(true);
      }
    };

    document.addEventListener('click', handleDocumentClick, true);
    return () => document.removeEventListener('click', handleDocumentClick, true);
  }, [hasStartedUnfinishedTest, navigate]);

  const requestFinish = () => {
    if (answeredCount < questions.length) {
      setFinishDialogOpen(true);
      return;
    }
    void handleFinish();
  };

  const confirmExit = () => {
    const retryPendingNavigation = pendingNavigation;
    clearAutoAdvance();
    setExitDialogOpen(false);
    setPendingNavigation(null);
    if (retryPendingNavigation) {
      allowNavigationRef.current = true;
      retryPendingNavigation();
      return;
    }
    allowNavigationRef.current = true;
    navigate('/tests');
  };

  const cancelExit = () => {
    setExitDialogOpen(false);
    setPendingNavigation(null);
  };

  if (isLoadingAuth) {
    return <Spinner />;
  }

  if (!user && requiresAuth) {
    return (
      <LoginPrompt
        title="Режим із персональними помилками"
        description="Увійдіть, щоб тренувати саме ті теми, де вже були неправильні відповіді."
      />
    );
  }

  if (guestLocked && !showResults) {
    return (
      <div className="mx-auto max-w-xl space-y-4 py-16 text-center">
        <Ghost className="mx-auto h-12 w-12 text-slate-400" />
        <h2 className="text-xl font-medium text-slate-900 dark:text-white">Для гостей сьогодні тест уже використано</h2>
        <p className="text-sm text-slate-500 dark:text-slate-300">
          Гість може пройти лише один тест на день. Увійдіть у профіль, щоб тренуватися без ліміту, зберігати прогрес і відкривати батли.
        </p>
        <div className="flex flex-col justify-center gap-3 sm:flex-row">
          <Button onClick={() => navigate('/auth')}>Увійти або зареєструватися</Button>
          <Button variant="outline" onClick={() => navigate('/')}>На головну</Button>
        </div>
      </div>
    );
  }

  if (limitBlocked) {
    return (
      <div className="mx-auto max-w-xl space-y-4 py-16 text-center">
        <Star className="mx-auto h-12 w-12 text-amber-500" />
        <h2 className="text-xl font-medium text-slate-900 dark:text-white">Денний trial для цього режиму вичерпано</h2>
        <p className="text-sm text-slate-500 dark:text-slate-300">
          {premiumOnly
            ? 'Цей режим відкривається у Premium, щоб Ви могли тренуватися без обмежень і з повним набором питань.'
            : 'Для безкоштовного доступу є лише 3 спроби на день у кожному режимі. Продовжити без лімітів можна з Premium.'}
        </p>
        <div className="flex flex-col justify-center gap-3 sm:flex-row">
          <Button onClick={() => navigate('/pricing')}>Перейти до Premium</Button>
          <Button variant="outline" onClick={() => navigate('/tests')}>До вибору режиму</Button>
        </div>
      </div>
    );
  }

  if (isLoading || (rawQuestions.length > 0 && questions.length === 0)) {
    return <Spinner text="Готуємо питання..." />;
  }

  if (!isLoading && questions.length === 0) {
    return (
      <div className="mx-auto max-w-xl space-y-4 py-16 text-center">
        <AlertTriangle className="mx-auto h-12 w-12 text-slate-400" />
        <h2 className="text-xl font-medium text-slate-900 dark:text-white">Питань для цього набору не знайдено</h2>
        <p className="text-sm text-slate-500 dark:text-slate-300">Спробуйте іншу категорію або інший розділ.</p>
        <Button onClick={() => navigate('/tests')}>Назад до вибору</Button>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-5 pb-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold text-slate-900 dark:text-white">
            {mode === 'srs' ? <Brain className="h-5 w-5 text-primary" /> : null}
            {config.label}
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-300">
            {mode === 'ticket' && ticket ? `Білет ${ticket}` : category ? `Категорія ${category}` : 'Усі категорії'}
            {section ? ` • Розділ ${section}` : ''}
            {topic ? ` • ${topic}` : ''}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {!showResults ? (
            <Button
              variant="outline"
              size="sm"
              className="hidden gap-2 rounded-lg border-slate-200 bg-background text-slate-700 dark:border-slate-700 dark:text-slate-200 sm:inline-flex"
              onClick={() => {
                const next = !ghostEnabled;
                setGhostEnabled(next);
                localStorage.setItem('ghost_bar_enabled', next ? '1' : '0');
              }}
            >
              <Ghost className="h-4 w-4" />
              {ghostEnabled ? 'Привид увімкнено' : 'Привид вимкнено'}
            </Button>
          ) : null}
          {!showResults ? (
            <Badge variant="outline" className="gap-2 rounded-lg border-slate-200 bg-background px-3 py-1.5 text-base text-slate-700 dark:border-slate-700 dark:text-slate-200">
              <Clock className="h-4 w-4" />
              {formatTime(timeLeft)}
            </Badge>
          ) : null}
          <Badge variant="secondary" className="rounded-lg px-3 py-1.5 text-sm">
            {answeredCount}/{questions.length}
          </Badge>
        </div>
      </div>

      {!showResults && ghostEnabled ? (
        <GhostBar
          currentIndex={currentIndex}
          totalQuestions={questions.length}
          timeLeft={timeLeft}
          totalTime={config.time}
          ghostBestTime={ghostBestTime}
        />
      ) : null}

      <div className="rounded-xl border border-slate-200 bg-card p-3 dark:border-slate-800 sm:p-4">
        <QuestionNavigator
          questions={questions}
          answers={answers}
          currentIndex={currentIndex}
          onNavigate={goToQuestion}
          showResults
        />
      </div>

      {currentQuestion ? (
        <motion.div
          key={currentIndex}
          initial={{ opacity: 0, x: 14 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.28, ease: 'easeOut' }}
          className="rounded-xl border border-slate-200 bg-card p-4 dark:border-slate-800 sm:p-5"
        >
          <QuestionCard
            question={currentQuestion}
            index={currentIndex}
            totalQuestions={questions.length}
            selectedAnswer={answers[String(currentQuestion.id)]}
            onSelectAnswer={handleSelectAnswer}
            revealAnswer={showResults || answers[String(currentQuestion.id)] !== undefined}
            isFavorite={isQuestionSaved(currentQuestion.id)}
            onToggleFavorite={() => {
              const saved = toggleSavedQuestion(currentQuestion.id);
              setSavedIds(getSavedQuestionIds());
              toast({
                title: saved ? 'Питання збережено' : 'Питання прибрано зі збережених',
                description: saved
                  ? 'Ви зможете повернутися до нього в розділі “Збережені запитання”.'
                  : 'Список повторення оновлено.',
              });
            }}
            isAuthenticated={!!user}
            onAnalyzeSituation={currentQuestion.image_url ? setAnalyzingQuestion : null}
          />
        </motion.div>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
          <Button
            variant="outline"
            className="gap-2 rounded-lg"
            disabled={currentIndex <= 0}
            onClick={() => goToQuestion(currentIndex - 1)}
          >
            <ChevronLeft className="h-4 w-4" />
            Попереднє
          </Button>
          <Button
            variant="outline"
            className="gap-2 rounded-lg"
            disabled={currentIndex >= questions.length - 1}
            onClick={() => goToQuestion(currentIndex + 1)}
          >
            Наступне
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {!showResults ? (
          <Button className="w-full gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 sm:w-auto" onClick={requestFinish}>
            <CheckCircle className="h-4 w-4" />
            Завершити
          </Button>
        ) : null}
      </div>

      <AlertDialog open={finishDialogOpen} onOpenChange={setFinishDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Завершити тест?</AlertDialogTitle>
            <AlertDialogDescription>
              Ви відповіли на {answeredCount} з {questions.length} питань. Невідповіді зарахуються як неправильні.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Повернутися до тесту</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setFinishDialogOpen(false);
                void handleFinish();
              }}
            >
              Завершити
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {analyzingQuestion ? (
        <SituationAnalysisModal
          question={analyzingQuestion}
          revealAnswer={showResults}
          onClose={() => setAnalyzingQuestion(null)}
        />
      ) : null}

      <Dialog open={showResults} onOpenChange={(open) => !open && setShowResults(false)}>
        <DialogContent className="overflow-hidden rounded-xl border-slate-200 bg-card p-0 shadow-xl sm:max-w-xl dark:border-slate-800">
          <DialogTitle className="sr-only">Результат тесту</DialogTitle>
          <DialogDescription className="sr-only">Підсумок тесту, серії активності та ідеальних зірок.</DialogDescription>
          <div className="p-6 text-center sm:p-8">
            <motion.div initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }}>
              <div className={cn('mx-auto flex h-24 w-24 items-center justify-center rounded-full', passed ? 'bg-emerald-50 dark:bg-emerald-950/40' : 'bg-rose-50 dark:bg-rose-950/40')}>
                <span className={cn('text-4xl font-semibold', passed ? 'text-emerald-600' : 'text-rose-600')}>
                  {resultMeta?.percent ?? Math.round((correctCount / questions.length) * 100)}
                </span>
              </div>

              <h2 className="mt-5 text-3xl font-semibold text-slate-950 dark:text-white">
                {passed ? 'Тест завершено' : 'Результат готовий'}
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-300">
                Правильних відповідей: {resultMeta?.correct ?? correctCount} з {resultMeta?.total ?? questions.length}
              </p>
              {resultMeta?.syncStatus === 'queued_offline' ? (
                <p className="mt-2 text-xs font-semibold text-amber-600 dark:text-amber-300">
                  Результат збережено офлайн. Зірочки й серія синхронізуються, щойно з’явиться інтернет.
                </p>
              ) : null}
              {resultMeta?.rewardDataMissing ? (
                <p className="mt-2 text-xs font-semibold text-rose-600 dark:text-rose-300">
                  Сервер прийняв результат, але не повернув повні дані про нагороду. Оновіть профіль і перевірте статистику.
                </p>
              ) : null}

              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <motion.div
                  initial={false}
                  animate={resultMeta?.earnedStar ? { scale: [0.72, 1.22, 1], rotate: [0, -8, 8, 0] } : { opacity: [0.72, 1] }}
                  transition={{ duration: 0.9 }}
                  className={cn(
                    'rounded-2xl border p-4',
                    resultMeta?.earnedStar ? 'border-amber-200 bg-amber-50 dark:border-amber-900/60 dark:bg-amber-950/30' : 'border-slate-200 bg-slate-50/70 dark:border-slate-800 dark:bg-slate-900/50',
                  )}
                >
                  <div className="flex items-center justify-center gap-3">
                    <div className="relative">
                      <Star className={cn('h-8 w-8 transition-all duration-700', resultMeta?.earnedStar ? 'fill-amber-400 text-amber-500 drop-shadow-[0_0_14px_rgba(251,191,36,0.45)]' : 'fill-slate-200 text-slate-300')} />
                      {resultMeta?.earnedStar ? (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.2, y: 8 }}
                          animate={{ opacity: [0, 1, 0], scale: [0.2, 1.15, 0.9], y: [8, -12, -22] }}
                          transition={{ duration: 0.9 }}
                          className="pointer-events-none absolute -right-2 -top-2"
                        >
                          <Star className="h-4 w-4 fill-amber-300 text-amber-400" />
                        </motion.div>
                      ) : null}
                    </div>
                    <div className="text-left">
                      <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-400">Зірочки</p>
                      <p className="text-2xl font-semibold text-slate-950 dark:text-white">{resultMeta?.totalStars ?? '—'}</p>
                      <p className="text-xs font-semibold text-slate-500 dark:text-slate-300">
                        {resultMeta?.earnedStar ? 'Нова зірочка отримана' : 'Без нової зірочки цього разу'}
                      </p>
                    </div>
                  </div>
                </motion.div>

                <motion.div
                  initial={false}
                  animate={resultMeta?.streakActivated || resultMeta?.streakRestored ? { scale: [0.92, 1.12, 1] } : {}}
                  transition={{ duration: 0.8 }}
                  className={cn(
                    'rounded-2xl border p-4',
                    (resultMeta?.streakActivated || resultMeta?.streakRestored || user?.streak_status === 'active')
                      ? 'border-orange-200 bg-orange-50 dark:border-orange-900/60 dark:bg-orange-950/30'
                      : 'border-slate-200 bg-slate-50/70 dark:border-slate-800 dark:bg-slate-900/50',
                  )}
                >
                  <div className="flex items-center justify-center gap-3">
                    <motion.div
                      initial={false}
                      animate={resultMeta?.streakActivated || resultMeta?.streakRestored ? { scale: [0.76, 1.2, 1], opacity: [0.55, 1], rotate: [0, -6, 4, 0] } : {}}
                      transition={{ duration: 0.8 }}
                    >
                      <Flame className={cn('h-8 w-8 transition-all duration-700', (resultMeta?.streakActivated || resultMeta?.streakRestored || user?.streak_status === 'active') ? 'fill-orange-500 text-orange-500 drop-shadow-[0_0_14px_rgba(249,115,22,0.45)]' : 'text-slate-300')} />
                    </motion.div>
                    <div className="text-left">
                      <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-400">Серія</p>
                      <motion.p
                        key={resultMeta?.streak ?? 0}
                        initial={(resultMeta?.streakActivated || resultMeta?.streakRestored) ? { opacity: 0, y: 10, scale: 0.92 } : false}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        className="text-2xl font-semibold text-slate-950 dark:text-white"
                        >
                          {resultMeta?.streak ?? '—'}
                        </motion.p>
                        <p className="text-xs font-semibold text-slate-500 dark:text-slate-300">
                          {resultMeta?.streakRestored
                            ? 'Серію відновлено'
                            : resultMeta?.streakActivated
                              ? 'Серія активна'
                              : 'Прогрес серії оновлено'}
                        </p>
                      </div>
                    </div>
                  </motion.div>
              </div>

              <div className="mt-6 flex flex-wrap justify-center gap-3">
                <Button variant="outline" onClick={() => navigate('/tests')}>
                  Повернутися до списку
                </Button>
                {user ? <Button onClick={() => navigate('/cabinet')}>До кабінету</Button> : null}
              </div>
            </motion.div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={exitDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            cancelExit();
            return;
          }
          setExitDialogOpen(true);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Вийти з тесту?</AlertDialogTitle>
            <AlertDialogDescription>
              Ви впевнені, що хочете вийти? Поточні відповіді не збережуться.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={cancelExit}>Залишитись у тесті</AlertDialogCancel>
            <AlertDialogAction onClick={confirmExit}>Вийти</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function streakFallback(correct, total) {
  return correct >= Math.ceil(total * 0.8) ? 1 : 0;
}

function formatTime(seconds) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

function Spinner({ text = 'Завантаження...' }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-20">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary/30 border-t-primary" />
      <p className="text-sm text-slate-500 dark:text-slate-300">{text}</p>
    </div>
  );
}

