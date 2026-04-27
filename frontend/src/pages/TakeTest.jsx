// @ts-nocheck
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Brain, CheckCircle, ChevronLeft, ChevronRight, Clock, Ghost, Flame, Star } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
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

const MODE_CONFIG = {
  quick: { count: 10, label: 'Швидкий тест', time: 600 },
  full: { count: 20, label: 'Повний іспит', time: 1200 },
  difficult: { count: 10, label: 'Робота над помилками', time: 600 },
  daily: { count: 15, label: 'Виклик дня', time: 900 },
  srs: { count: 20, label: 'Інтервальне повторення', time: 1200 },
};

const answerToIndex = (answer) => ['A', 'B', 'C', 'D', 'E', 'F'].indexOf(answer || '') + 1;
const guestTestKey = `guest_test_limit:${new Date().toISOString().slice(0, 10)}`;

export default function TakeTest() {
  const navigate = useNavigate();
  const { user, isLoadingAuth } = useAuth();
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const mode = params.get('mode') || 'quick';
  const category = params.get('category') || '';
  const topic = params.get('topic') || '';
  const section = params.get('section') || '';
  const config = MODE_CONFIG[/** @type {keyof typeof MODE_CONFIG} */ (mode)] || MODE_CONFIG.quick;
  const requiresAuth = mode === 'difficult';
  const guestLocked = !user && localStorage.getItem(guestTestKey) === '1';

  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [showResults, setShowResults] = useState(false);
  const [timeLeft, setTimeLeft] = useState(config.time);
  const [questions, setQuestions] = useState([]);
  const [resultMeta, setResultMeta] = useState(null);
  const [analyzingQuestion, setAnalyzingQuestion] = useState(null);
  const [exitDialogOpen, setExitDialogOpen] = useState(false);
  const [ghostEnabled, setGhostEnabled] = useState(() => {
    const raw = localStorage.getItem('ghost_bar_enabled');
    return raw === null ? true : raw === '1';
  });
  const [ghostBestTime, setGhostBestTime] = useState(0);
  const startTimeRef = useRef(Date.now());
  const { toast } = useToast();

  const ghostKey = useMemo(
    () => `ghost_best_time:${mode}:${category || 'all'}:${section || 'all'}:${topic || 'all'}`,
    [mode, category, section, topic],
  );

  const { data: rawQuestions = [], isLoading } = useQuery({
    queryKey: ['take-test', mode, category, topic, section, user?.id],
    enabled: (!requiresAuth || !!user) && !guestLocked,
    queryFn: async () => {
      const seed = mode === 'daily' ? `${new Date().toISOString().slice(0, 10)}:${category || 'all'}:${section || 'all'}:${topic || 'all'}` : undefined;
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
    if (showResults) return undefined;
    const handleBeforeUnload = (event) => {
      if (Object.keys(answers).length === 0) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [answers, showResults]);

  const handleSelectAnswer = (label) => {
    const question = questions[currentIndex];
    if (!question) return;
    if (answers[String(question.id)]) return;
    setAnswers((prev) => ({ ...prev, [String(question.id)]: label }));
  };

  const handleFinish = async () => {
    if (showResults || questions.length === 0) return;
    setShowResults(true);
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
    if (user) {
      try {
        response = await api.submitTestResult(resultPayload);

        (response?.new_achievements || []).forEach((achievement) => {
          toast({
            title: `Нове досягнення: ${achievement.name}`,
            description: achievement.description,
          });
        });
      } catch {
        await queuePendingTestResult(resultPayload);
        toast({
          title: 'Результат збережено офлайн',
          description: 'Ми автоматично надішлемо його на сервер, щойно з’явиться інтернет.',
        });
      }
    } else {
      localStorage.setItem(guestTestKey, '1');
    }

    setResultMeta({
      correct,
      total: questions.length,
      percent: questions.length > 0 ? Math.round((correct / questions.length) * 100) : 0,
      perfect: questions.length > 0 && correct === questions.length,
      streak: response?.streak ?? streakFallback(correct, questions.length),
      streakActivated: (response?.streak_status ?? 'active') === 'active' && (user?.streak_status || 'inactive') !== 'active',
      streakRestored: !!response?.streak_restored,
      restoresLeft: response?.streak_restores_left ?? null,
      totalStars: response?.total_stars ?? null,
      earnedStar: response?.earned_star ?? (questions.length > 0 && correct === questions.length),
    });
  };

  const currentQuestion = questions[currentIndex];
  const answeredCount = Object.keys(answers).length;
  const correctCount = questions.filter((question) => answers[String(question.id)] === question.correct_answer).length;
  const passed = questions.length > 0 && correctCount / questions.length >= 0.8;

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
      <div className="space-y-4 py-20 text-center">
        <Ghost className="mx-auto h-12 w-12 text-slate-400" />
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Для гостей сьогодні тест уже використано</h2>
        <p className="text-sm text-slate-500 dark:text-slate-300">
          Гість може пройти лише один тест на день. Увійдіть у профіль, щоб тренуватися без ліміту, зберігати прогрес і відкривати батли.
        </p>
        <div className="flex justify-center gap-3">
          <Button onClick={() => navigate('/auth')}>Увійти або зареєструватися</Button>
          <Button variant="outline" onClick={() => navigate('/')}>На головну</Button>
        </div>
      </div>
    );
  }

  if (isLoading || (rawQuestions.length > 0 && questions.length === 0)) {
    return <Spinner text="Готуємо питання..." />;
  }

  if (!isLoading && questions.length === 0) {
    return (
      <div className="space-y-4 py-20 text-center">
        <AlertTriangle className="mx-auto h-12 w-12 text-slate-400" />
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Питань для цього набору не знайдено</h2>
        <p className="text-sm text-slate-500 dark:text-slate-300">Спробуйте іншу категорію або інший розділ.</p>
        <Button onClick={() => navigate('/tests')}>Назад до вибору</Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-black text-slate-900 dark:text-white">
            {mode === 'srs' ? <Brain className="h-5 w-5 text-primary" /> : null}
            {config.label}
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-300">
            {category ? `Категорія ${category}` : 'Усі категорії'}
            {section ? ` • Розділ ${section}` : ''}
            {topic ? ` • ${topic}` : ''}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {!showResults ? (
            <Button
              variant="outline"
              size="sm"
              className="gap-2 rounded-full border-slate-200 bg-white/85 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
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
            <Badge variant="outline" className="gap-2 rounded-full border-slate-200 bg-white/85 px-3 py-1.5 text-base text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
              <Clock className="h-4 w-4" />
              {formatTime(timeLeft)}
            </Badge>
          ) : null}
          <Badge variant="secondary" className="rounded-full px-3 py-1.5 text-sm">
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

      <QuestionNavigator
        questions={questions}
        answers={answers}
        currentIndex={currentIndex}
        onNavigate={setCurrentIndex}
        showResults={showResults}
      />

      {currentQuestion ? (
        <motion.div key={currentIndex} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="rounded-[28px] border border-white/70 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950/80">
          <QuestionCard
            question={currentQuestion}
            index={currentIndex}
            totalQuestions={questions.length}
            selectedAnswer={answers[String(currentQuestion.id)]}
            onSelectAnswer={handleSelectAnswer}
            isFavorite={false}
            onToggleFavorite={undefined}
            isAuthenticated={!!user}
            onAnalyzeSituation={currentQuestion.image_url ? setAnalyzingQuestion : null}
          />
        </motion.div>
      ) : null}

      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          className="gap-2 rounded-full"
          onClick={() => {
            if (!showResults && answeredCount > 0) {
              setExitDialogOpen(true);
              return;
            }
            navigate('/tests');
          }}
        >
          <ChevronLeft className="h-4 w-4" />
          Назад
        </Button>

        {currentIndex < questions.length - 1 ? (
          <Button className="gap-2 rounded-full" disabled={!answers[String(currentQuestion?.id)]} onClick={() => setCurrentIndex((value) => value + 1)}>
            Далі
            <ChevronRight className="h-4 w-4" />
          </Button>
        ) : !showResults ? (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button className="gap-2 rounded-full bg-emerald-600 hover:bg-emerald-500">
                <CheckCircle className="h-4 w-4" />
                Завершити
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Завершити тест?</AlertDialogTitle>
                <AlertDialogDescription>
                  Ви відповіли на {answeredCount} з {questions.length} питань.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Повернутися</AlertDialogCancel>
                <AlertDialogAction onClick={() => void handleFinish()}>Завершити</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        ) : null}
      </div>

      {analyzingQuestion ? (
        <SituationAnalysisModal
          question={analyzingQuestion}
          revealAnswer={Boolean(answers[String(analyzingQuestion.id)]) || showResults}
          onClose={() => setAnalyzingQuestion(null)}
        />
      ) : null}

      <Dialog open={showResults} onOpenChange={(open) => !open && setShowResults(false)}>
        <DialogContent className="overflow-hidden rounded-[32px] border-white/80 bg-[linear-gradient(135deg,rgba(255,255,255,0.98),rgba(239,246,255,0.96))] p-0 shadow-[0_30px_80px_rgba(15,23,42,0.14)] sm:max-w-xl dark:border-slate-800 dark:bg-[linear-gradient(135deg,rgba(15,23,42,0.98),rgba(30,41,59,0.98))]">
          <DialogTitle className="sr-only">Результат тесту</DialogTitle>
          <DialogDescription className="sr-only">Підсумок тесту, серії активності та ідеальних зірок.</DialogDescription>
          <div className="p-6 text-center sm:p-8">
            <motion.div initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }}>
              <div className={cn('mx-auto flex h-24 w-24 items-center justify-center rounded-full', passed ? 'bg-emerald-50 dark:bg-emerald-950/40' : 'bg-rose-50 dark:bg-rose-950/40')}>
                <span className={cn('text-4xl font-black', passed ? 'text-emerald-600' : 'text-rose-600')}>
                  {resultMeta?.percent ?? Math.round((correctCount / questions.length) * 100)}
                </span>
              </div>

              <h2 className="mt-5 text-3xl font-black tracking-[-0.04em] text-slate-950 dark:text-white">
                {passed ? 'Тест завершено' : 'Результат готовий'}
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-300">
                Правильних відповідей: {resultMeta?.correct ?? correctCount} з {resultMeta?.total ?? questions.length}
              </p>

              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <motion.div
                  initial={false}
                  animate={resultMeta?.earnedStar ? { scale: [0.72, 1.22, 1], rotate: [0, -8, 8, 0] } : { opacity: [0.72, 1] }}
                  transition={{ duration: 0.9 }}
                  className={cn(
                    'rounded-[24px] border p-4',
                    resultMeta?.earnedStar ? 'border-amber-200 bg-amber-50 dark:border-amber-900/60 dark:bg-amber-950/30' : 'border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/70',
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
                      <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">Зірочки</p>
                      <p className="text-2xl font-black text-slate-950 dark:text-white">{resultMeta?.totalStars ?? '—'}</p>
                    </div>
                  </div>
                </motion.div>

                <motion.div
                  initial={false}
                  animate={resultMeta?.streakActivated || resultMeta?.streakRestored ? { scale: [0.92, 1.12, 1] } : {}}
                  transition={{ duration: 0.8 }}
                  className={cn(
                    'rounded-[24px] border p-4',
                    (resultMeta?.streakActivated || resultMeta?.streakRestored || user?.streak_status === 'active')
                      ? 'border-orange-200 bg-[linear-gradient(135deg,rgba(251,146,60,0.14),rgba(255,255,255,0.98))] dark:border-orange-900/60 dark:bg-[linear-gradient(135deg,rgba(194,65,12,0.35),rgba(15,23,42,0.95))]'
                      : 'border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/70',
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
                      <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">Серія</p>
                      <motion.p
                        key={resultMeta?.streak ?? 0}
                        initial={(resultMeta?.streakActivated || resultMeta?.streakRestored) ? { opacity: 0, y: 10, scale: 0.92 } : false}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        className="text-2xl font-black text-slate-950 dark:text-white"
                      >
                        {resultMeta?.streak ?? '—'}
                      </motion.p>
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

      <AlertDialog open={exitDialogOpen} onOpenChange={setExitDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Вийти з тесту?</AlertDialogTitle>
            <AlertDialogDescription>
              Ви впевнені, що хочете вийти? Ваш прогрес у цьому тесті буде втрачено.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Залишитись</AlertDialogCancel>
            <AlertDialogAction onClick={() => navigate('/tests')}>Вийти</AlertDialogAction>
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

