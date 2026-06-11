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
import { fetchQuestions, fetchRandomQuestions, normalizeQuestion } from '@/api/questionsApi';
import api from '@/api/apiClient';
import { queuePendingTestResult } from '@/lib/offlineProgress';
import QuestionCard from '@/components/test/QuestionCard';
import QuestionNavigator from '@/components/test/QuestionNavigator';
import SituationAnalysisModal from '@/components/test/SituationAnalysisModal';
import GhostBar from '@/components/test/GhostBar';
import LoginPrompt from '@/components/auth/LoginPrompt';
import PremiumLimitDialog from '@/components/premium/PremiumLimitDialog';
import { hasPremiumAccess, registerFreeTestCompletion } from '@/lib/accessLimits';
import { getSavedQuestionIds, isQuestionSaved, toggleSavedQuestion } from '@/lib/savedQuestions';
import { playTone } from '@/lib/soundEffects';
import { getAchievementCopy } from '@/lib/achievements';

const AUTO_ADVANCE_DELAY_MS = 1100;
const AUTO_FINISH_DELAY_MS = 1000;

const MODE_CONFIG = {
  quick: { count: 10, label: 'Офіційні тести', time: 600 },
  full: { count: 20, label: 'Тренування 20 питань', time: 1200 },
  mvs: { count: 20, label: 'Іспит МВС', time: 1200 },
  difficult: { count: 10, label: 'Мої помилки', time: 600 },
  top: { count: 20, label: 'Топ помилок багатьох', time: 1200 },
  section: { count: 20, label: 'Тест за розділом', time: 1200 },
  daily: { count: 15, label: 'Виклик дня', time: 900 },
  srs: { count: 20, label: 'Інтервальне повторення', time: 1200 },
  saved: { count: 20, label: 'Збережені запитання', time: 1200 },
  ticket: { count: 20, label: 'Екзаменаційний білет', time: 1200 },
};

const answerToIndex = (answer) => ['A', 'B', 'C', 'D', 'E', 'F'].indexOf(answer || '') + 1;
const LIMITED_FREE_TEST_MODES = ['quick', 'full', 'difficult', 'section', 'top'];
const TEST_DRAFT_PREFIX = 'driveprep:test-draft:v2';

function readTestDraft(key) {
  try {
    const draft = JSON.parse(localStorage.getItem(key) || 'null');
    if (!draft || !Array.isArray(draft.questions) || draft.questions.length === 0) return null;
    return draft;
  } catch {
    return null;
  }
}

function writeTestDraft(key, draft) {
  try {
    localStorage.setItem(key, JSON.stringify(draft));
  } catch {
    // Storage can be full or unavailable; the test should still continue.
  }
}

function removeTestDraft(key) {
  try {
    localStorage.removeItem(key);
  } catch {
    // Ignore storage failures.
  }
}

function normalizeQuestionResponse(response) {
  const list = Array.isArray(response)
    ? response
    : Array.isArray(response?.questions)
      ? response.questions
      : Array.isArray(response?.items)
        ? response.items
        : [];

  return list.map(normalizeQuestion).filter(Boolean);
}

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
  const idsParam = params.get('ids') || '';
  const requestedIds = useMemo(() => idsParam.split(',').map((value) => value.trim()).filter(Boolean), [idsParam]);
  const requestedCount = Math.max(0, Math.min(200, Number(params.get('count') || 0) || 0));
  const config = MODE_CONFIG[/** @type {keyof typeof MODE_CONFIG} */ (mode)] || MODE_CONFIG.quick;
  const requiresAuth = mode === 'difficult' || mode === 'saved';
  const premiumOnly = mode === 'mvs' || mode === 'ticket';
  const guestLocked = false;
  const effectiveQuestionCount = requestedCount || requestedIds.length || config.count;
  const effectiveTime = Math.max(config.time, effectiveQuestionCount * 60);
  const draftKey = useMemo(
    () => [
      TEST_DRAFT_PREFIX,
      user?.id || 'guest',
      mode,
      category || 'all',
      topic || 'all',
      section || 'all',
      ticket || 'none',
      idsParam || 'random',
      requestedCount || effectiveQuestionCount,
    ].join(':'),
    [category, effectiveQuestionCount, idsParam, mode, requestedCount, section, ticket, topic, user?.id],
  );
  const initialDraft = useMemo(() => readTestDraft(draftKey), [draftKey]);
  const hasRestorableDraft = Boolean(initialDraft?.questions?.length);
  const premiumAccess = hasPremiumAccess(user);

  const [currentIndex, setCurrentIndex] = useState(() => Math.max(0, Number(initialDraft?.currentIndex || 0)));
  const [answers, setAnswers] = useState(() => initialDraft?.answers || {});
  const [showResults, setShowResults] = useState(false);
  const [resultsDialogOpen, setResultsDialogOpen] = useState(false);
  const [isFinishing, setIsFinishing] = useState(false);
  const [timeLeft, setTimeLeft] = useState(() => Math.max(0, Number(initialDraft?.timeLeft || effectiveTime)));
  const [questions, setQuestions] = useState(() => initialDraft?.questions || []);
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
  const [serverAccessReady, setServerAccessReady] = useState(false);
  const [, setSavedIds] = useState(() => getSavedQuestionIds());
  const startTimeRef = useRef(Number(initialDraft?.startTime || Date.now()));
  const attemptIdRef = useRef(String(initialDraft?.attemptId || ''));
  const answersRef = useRef(initialDraft?.answers || {});
  const answeredAllAtRef = useRef(null);
  const finishInProgressRef = useRef(false);
  const finishedAtRef = useRef(null);
  const limitRegisteredRef = useRef(Boolean(initialDraft?.limitRegistered));
  const autoAdvanceRef = useRef(/** @type {number | null} */ (null));
  const allowNavigationRef = useRef(false);
  const { toast } = useToast();
  const [pendingNavigation, setPendingNavigation] = useState(null);

  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

  const ghostKey = useMemo(
    () => `ghost_best_time:${mode}:${category || 'all'}:${section || 'all'}:${topic || 'all'}`,
    [mode, category, section, topic],
  );

  const { data: rawQuestions = [], isLoading, isError, error, refetch } = useQuery({
    queryKey: ['take-test', mode, category, topic, section, ticket, idsParam, requestedCount, user?.id],
    enabled: !isLoadingAuth && serverAccessReady && (!requiresAuth || !!user) && !guestLocked && !hasRestorableDraft,
    queryFn: async () => {
      const seed = mode === 'top' ? `top100:${category || 'all'}` : undefined;
      if (requestedIds.length > 0) {
        const limit = requestedCount > 0 ? Math.min(requestedCount, requestedIds.length) : requestedIds.length;
        const response = await fetchQuestions({ ids: requestedIds.slice(0, limit), limit });
        return normalizeQuestionResponse(response);
      }
      if (mode === 'mvs') {
        const response = await api.getMvsExamQuestions({ category: category || 'B' });
        return normalizeQuestionResponse(response);
      }
      if (mode === 'ticket' && ticket) {
        const response = await api.getTicket(ticket, category || 'B');
        return normalizeQuestionResponse(response);
      }
      const response = await fetchRandomQuestions({
        count: effectiveQuestionCount,
        category: category || undefined,
        section: section || undefined,
        topic: topic || undefined,
        difficultOnly: mode === 'difficult',
        difficulty: mode === 'top' ? 'hard' : undefined,
        seed,
      });
      return normalizeQuestionResponse(response);
    },
  });

  useEffect(() => {
    let canceled = false;
    async function prepareAccess() {
      if (isLoadingAuth) return;
      if (hasRestorableDraft || showResults || premiumAccess) {
        if (!canceled) setServerAccessReady(true);
        return;
      }
      if (premiumOnly) {
        if (!canceled) {
          setLimitBlocked(true);
          setServerAccessReady(true);
        }
        return;
      }
      if (!LIMITED_FREE_TEST_MODES.includes(mode)) {
        if (!canceled) setServerAccessReady(true);
        return;
      }
      const action = mode === 'section' ? 'section_test_v2' : 'test_v2';
      try {
        const access = await api.consumeAccessLimit(action);
        if (canceled) return;
        if (!access?.allowed) {
          setLimitBlocked(true);
        }
      } catch {
        if (!canceled) setLimitBlocked(true);
      } finally {
        if (!canceled) setServerAccessReady(true);
      }
    }
    void prepareAccess();
    return () => {
      canceled = true;
    };
  }, [hasRestorableDraft, isLoadingAuth, mode, premiumOnly, premiumAccess, showResults]);

  useEffect(() => {
    if (hasRestorableDraft) return;
    if (rawQuestions.length === 0) return;
    setQuestions(rawQuestions);
    setAnswers({});
    setCurrentIndex(0);
    setShowResults(false);
    setIsFinishing(false);
    setTimeLeft(effectiveTime);
    startTimeRef.current = Date.now();
    attemptIdRef.current =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    answeredAllAtRef.current = null;
    finishInProgressRef.current = false;
    finishedAtRef.current = null;
    if (!premiumAccess && LIMITED_FREE_TEST_MODES.includes(mode) && !limitRegisteredRef.current) {
      registerFreeTestCompletion(user || null, mode);
      limitRegisteredRef.current = true;
    }
  }, [rawQuestions, effectiveTime, mode, user, hasRestorableDraft]);

  useEffect(() => {
    if (!initialDraft?.questions?.length || questions.length > 0) return;
    setQuestions(initialDraft.questions);
    setAnswers(initialDraft.answers || {});
    setCurrentIndex(Math.max(0, Number(initialDraft.currentIndex || 0)));
    setTimeLeft(Math.max(0, Number(initialDraft.timeLeft || effectiveTime)));
    startTimeRef.current = Number(initialDraft.startTime || Date.now());
    attemptIdRef.current = String(initialDraft.attemptId || '');
    limitRegisteredRef.current = Boolean(initialDraft.limitRegistered);
  }, [effectiveTime, initialDraft, questions.length]);

  useEffect(() => {
    if (questions.length === 0 || showResults) return;
    writeTestDraft(draftKey, {
      answers,
      attemptId: attemptIdRef.current,
      currentIndex,
      limitRegistered: limitRegisteredRef.current,
      mode,
      questions,
      startTime: startTimeRef.current,
      timeLeft,
      updatedAt: Date.now(),
    });
  }, [answers, currentIndex, draftKey, mode, questions, showResults, timeLeft]);

  useEffect(() => () => {
    if (autoAdvanceRef.current) {
      window.clearTimeout(autoAdvanceRef.current);
    }
  }, []);

  useEffect(() => {
    if (attemptIdRef.current) return;
    attemptIdRef.current =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }, []);

  useEffect(() => {
    if (premiumAccess) return;
    if (premiumOnly) {
      setLimitBlocked(true);
      return;
    }
    // Server-side access limit decides this now.
  }, [mode, premiumAccess, premiumOnly, user]);

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

  const currentQuestion = questions[currentIndex];
  const answeredCount = Object.keys(answers).length;
  const allQuestionsAnswered = questions.length > 0 && answeredCount >= questions.length;

  useEffect(() => {
    if (showResults || allQuestionsAnswered || questions.length === 0) return;
    const timer = setInterval(() => {
      setTimeLeft((value) => {
        if (value <= 1) {
          clearInterval(timer);
          return 0;
        }
        return value - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [showResults, allQuestionsAnswered, questions.length]);

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
    const nextAnswers = { ...answersRef.current, [String(question.id)]: label };
    answersRef.current = nextAnswers;
    setAnswers((prev) => {
      const next = { ...prev, [String(question.id)]: label };
      if (Object.keys(next).length >= questions.length && !answeredAllAtRef.current) {
        answeredAllAtRef.current = Date.now();
      }
      return next;
    });
    playTone(label === question.correct_answer ? 'correct' : 'wrong');

    if (autoAdvanceRef.current) {
      window.clearTimeout(autoAdvanceRef.current);
    }
    autoAdvanceRef.current = window.setTimeout(() => {
      const isLastQuestion = currentIndex >= questions.length - 1;
      if (!isLastQuestion) {
        setCurrentIndex((value) => Math.min(value + 1, questions.length - 1));
        return;
      }
      if (Object.keys(nextAnswers).length >= questions.length) {
        void handleFinish();
      }
    }, currentIndex >= questions.length - 1 ? AUTO_FINISH_DELAY_MS : AUTO_ADVANCE_DELAY_MS);
  };

  const handleFinish = async () => {
    if (finishInProgressRef.current || showResults || questions.length === 0) return;
    finishInProgressRef.current = true;
    setIsFinishing(true);
    clearAutoAdvance();
    setShowResults(true);
    setResultsDialogOpen(true);
    removeTestDraft(draftKey);
    playTone('finish');
    const finishedAt = finishedAtRef.current || answeredAllAtRef.current || Date.now();
    finishedAtRef.current = finishedAt;
    const timeSpent = Math.floor((finishedAt - startTimeRef.current) / 1000);
    const finalAnswers = answersRef.current;
    const correct = questions.filter((question) => finalAnswers[String(question.id)] === question.correct_answer).length;
    const nextBest = ghostBestTime > 0 ? Math.min(ghostBestTime, timeSpent) : timeSpent;
    setGhostBestTime(nextBest);
    localStorage.setItem(ghostKey, String(nextBest));
    const validAnswerRows = questions
      .map((question) => {
        const questionId = Number(question.id);
        if (!Number.isFinite(questionId)) return null;
        return {
          question_id: questionId,
          selected_index: answerToIndex(finalAnswers[String(question.id)]),
          is_correct: finalAnswers[String(question.id)] === question.correct_answer,
          time_ms: null,
        };
      })
      .filter(Boolean);

    const resultPayload = {
      section: section || topic || null,
      mode,
      total: questions.length,
      correct,
      time_seconds: timeSpent,
      client_attempt_id: attemptIdRef.current,
      answers: validAnswerRows,
    };

    let response = null;
    let resultSyncStatus = user ? 'pending' : 'guest';
    if (user) {
      try {
        response = await api.submitTestResult(resultPayload);
        resultSyncStatus = 'synced';
        await Promise.allSettled([
          queryClient.invalidateQueries({ queryKey: ['cabinet-stats'] }),
          queryClient.invalidateQueries({ queryKey: ['cabinet-results'] }),
          queryClient.invalidateQueries({ queryKey: ['analytics-stats'] }),
          queryClient.invalidateQueries({ queryKey: ['analytics-results'] }),
          queryClient.invalidateQueries({ queryKey: ['section-tests-stats'] }),
          queryClient.invalidateQueries({ queryKey: ['section-tests-results'] }),
          queryClient.invalidateQueries({ queryKey: ['mistakes-stats'] }),
          queryClient.invalidateQueries({ queryKey: ['achievements'] }),
          queryClient.invalidateQueries({ queryKey: ['friends-list'] }),
          queryClient.invalidateQueries({ queryKey: ['notification-summary'] }),
        ]);

        (response?.new_achievements || []).forEach((achievement) => {
          const achievementCopy = getAchievementCopy?.(achievement.id) || getAchievementCopy?.(achievement.achievement_id);
          toast({
            title: `Нове досягнення: ${achievementCopy?.name || achievement.name}`,
            description: achievementCopy?.desc || achievement.description,
          });
        });
      } catch {
        resultSyncStatus = 'queued_offline';
        await queuePendingTestResult(resultPayload);
        toast({
          title: 'Результат збережено офлайн',
          description: 'Ми автоматично надішлемо його на сервер, щойно з’явиться інтернет.',
        });
      }
    }

    const streakValue = !user
      ? null
      : typeof response?.streak_days === 'number'
        ? response.streak_days
        : typeof response?.streak === 'number'
          ? response.streak
          : streakFallback(correct, questions.length);
    const totalStars = !user
      ? null
      : typeof response?.available_stars === 'number'
        ? response.available_stars
        : typeof response?.total_stars === 'number'
          ? response.total_stars
          : null;
    const earnedStar = user && (
      typeof response?.earned_star === 'boolean'
        ? response.earned_star
        : questions.length > 0 && correct === questions.length
    );
    const rewardDataMissing = Boolean(user && resultSyncStatus === 'synced' && (!response || totalStars === null));

    setResultMeta({
      correct,
      total: questions.length,
      percent: questions.length > 0 ? Math.round((correct / questions.length) * 100) : 0,
      perfect: questions.length > 0 && correct === questions.length,
      streak: streakValue,
      streakActivated: Boolean(user && (response?.streak_status ?? 'active') === 'active' && (user?.streak_status || 'inactive') !== 'active'),
      streakRestored: !!response?.streak_restored,
      restoresLeft: response?.streak_restores_left ?? null,
      totalStars,
      earnedStar,
      syncStatus: resultSyncStatus,
      rewardDataMissing,
    });
    setIsFinishing(false);
  };
  const correctCount = questions.filter((question) => answers[String(question.id)] === question.correct_answer).length;
  const passed = questions.length > 0 && correctCount / questions.length >= 0.8;
  const hasStartedUnfinishedTest = !showResults && questions.length > 0;
  const returnPath = useMemo(() => {
    if (mode === 'ticket') return '/tickets';
    if (mode === 'section') return `/section-tests${category ? `?category=${encodeURIComponent(category)}` : ''}`;
    if (mode === 'difficult') return '/mistakes';
    if (mode === 'top') return '/mistakes';
    if (mode === 'srs') return '/repetition';
    if (mode === 'saved') return '/saved-questions';
    return '/tests';
  }, [category, mode]);

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
    removeTestDraft(draftKey);
    setExitDialogOpen(false);
    setPendingNavigation(null);
    if (retryPendingNavigation) {
      allowNavigationRef.current = true;
      retryPendingNavigation();
      return;
    }
    allowNavigationRef.current = true;
    navigate(returnPath);
  };

  const cancelExit = () => {
    setExitDialogOpen(false);
    setPendingNavigation(null);
  };

  if (isLoadingAuth) {
    return <Spinner />;
  }

  if (!serverAccessReady && !showResults) {
    return <Spinner text="Перевіряємо доступ..." />;
  }

  if (!user && requiresAuth) {
    return (
      <LoginPrompt
        title={mode === 'saved' ? 'Збережені запитання доступні після входу' : 'Режим із персональними помилками'}
        description={mode === 'saved'
          ? 'Увійдіть, щоб пройти власний список питань для повторення.'
          : 'Увійдіть, щоб тренувати саме ті теми, де вже були неправильні відповіді.'}
      />
    );
  }

  if (guestLocked && !showResults) {
    return (
      <PremiumLimitDialog
        open
        onOpenChange={() => navigate('/')}
        title="Ви вичерпали ліміт тестів"
        description="Гість може пройти одну спробу на день. Зареєструйтесь, щоб отримати більше спроб і зберігати прогрес."
        primaryLabel="Зареєструватися"
        primaryTo="/auth?tab=register"
        intent="register"
      />
    );
  }

  if (limitBlocked) {
    return (
      <PremiumLimitDialog
        open
        onOpenChange={() => navigate('/tests')}
        title={premiumOnly ? 'Цей режим доступний у Premium' : 'Ви вичерпали денний ліміт'}
        description={premiumOnly
          ? 'Premium відкриває іспит МВС, білети як тест, усі режими практики та навчання без денних обмежень.'
          : user
            ? 'Ви використали 3 безкоштовні спроби на сьогодні. Premium відкриває тестування без денних обмежень.'
            : 'Гостьова спроба на сьогодні вже використана. Зареєструйтесь, щоб отримати більше спроб і зберігати прогрес.'}
        primaryLabel={user ? 'Отримати Premium' : 'Зареєструватися'}
        primaryTo={user ? '/pricing' : '/auth?tab=register'}
        intent={user ? 'premium' : 'register'}
        homeLabel="До вибору режиму"
      />
    );
  }

  if (isLoading || (rawQuestions.length > 0 && questions.length === 0)) {
    return <Spinner text="Готуємо питання..." />;
  }

  if (isError) {
    return (
      <div className="mx-auto max-w-xl space-y-4 px-4 py-16 text-center sm:px-6">
        <AlertTriangle className="mx-auto h-12 w-12 text-rose-500" />
        <h2 className="text-xl font-medium text-slate-900 dark:text-white">Не вдалося завантажити питання</h2>
        <p className="text-sm leading-6 text-slate-500 dark:text-slate-300">
          Спробуйте ще раз. Якщо інтернет є, ми не ховаємо помилку білим екраном, а покажемо її тут.
        </p>
        {error?.message ? (
          <p className="rounded-xl bg-rose-50 px-4 py-3 text-xs text-rose-700 dark:bg-rose-950/30 dark:text-rose-200">
            {error.message}
          </p>
        ) : null}
        <div className="flex flex-col justify-center gap-3 sm:flex-row">
          <Button onClick={() => refetch()}>Спробувати ще раз</Button>
          <Button variant="outline" onClick={() => navigate('/tests')}>Назад до тестів</Button>
        </div>
      </div>
    );
  }

  if (!isLoading && questions.length === 0) {
    return (
      <div className="mx-auto max-w-xl space-y-4 px-4 py-16 text-center sm:px-6">
        <AlertTriangle className="mx-auto h-12 w-12 text-slate-400" />
        <h2 className="text-xl font-medium text-slate-900 dark:text-white">Питань для цього набору не знайдено</h2>
        <p className="text-sm text-slate-500 dark:text-slate-300">Спробуйте іншу категорію або інший розділ.</p>
        <Button onClick={() => navigate(returnPath)}>Назад до вибору</Button>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <Button type="button" variant="ghost" size="icon" className="mt-0.5 shrink-0 rounded-full" aria-label="Назад" onClick={() => navigate(-1)}>
            <ChevronLeft className="h-5 w-5" />
          </Button>
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
          className="overflow-hidden rounded-2xl bg-white p-6 shadow-lg dark:bg-slate-900 md:p-8"
        >
          <QuestionCard
            question={currentQuestion}
            index={currentIndex}
            totalQuestions={questions.length}
            selectedAnswer={answers[String(currentQuestion.id)]}
            onSelectAnswer={handleSelectAnswer}
            revealAnswer={showResults || answers[String(currentQuestion.id)] !== undefined}
            isFavorite={user ? isQuestionSaved(currentQuestion.id) : false}
            onToggleFavorite={user ? () => {
              const saved = toggleSavedQuestion(currentQuestion.id, user);
              setSavedIds(getSavedQuestionIds());
              toast({
                title: saved ? 'Питання збережено' : 'Питання прибрано зі збережених',
                description: saved
                  ? 'Ви зможете повернутися до нього в розділі “Збережені запитання”.'
                  : 'Список повторення оновлено.',
              });
            } : undefined}
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
          <Button className="w-full gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 sm:w-auto" disabled={isFinishing} onClick={requestFinish}>
            <CheckCircle className="h-4 w-4" />
            {isFinishing ? 'Зберігаємо...' : 'Завершити'}
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
              disabled={isFinishing}
            >
              {isFinishing ? 'Зберігаємо...' : 'Завершити'}
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

      <Dialog open={showResults && resultsDialogOpen} onOpenChange={setResultsDialogOpen}>
        <DialogContent className="overflow-hidden rounded-xl border-slate-200 bg-card p-0 shadow-xl sm:max-w-xl dark:border-slate-800">
          <DialogTitle className="sr-only">Результат тесту</DialogTitle>
          <DialogDescription className="sr-only">Підсумок тесту, серії активності та ідеальних зірок.</DialogDescription>
          <div className="p-6 text-center sm:p-8">
            <motion.div initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }}>
              <div className={cn('mx-auto flex h-24 w-24 items-center justify-center rounded-full', passed ? 'bg-emerald-50 dark:bg-emerald-950/40' : 'bg-rose-50 dark:bg-rose-950/40')}>
                <span className={cn('text-4xl font-semibold', passed ? 'text-emerald-600' : 'text-rose-600')}>
                  {resultMeta?.percent ?? Math.round((correctCount / questions.length) * 100)}%
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

              {user ? <div className="mt-6 grid grid-cols-2 items-stretch gap-3">
                <motion.div
                  initial={false}
                  animate={resultMeta?.earnedStar ? { scale: [0.72, 1.22, 1], rotate: [0, -8, 8, 0] } : { opacity: [0.72, 1] }}
                  transition={{ duration: 0.9 }}
                  className={cn(
                    'flex min-h-[132px] rounded-2xl border p-3 sm:min-h-[140px] sm:p-4',
                    resultMeta?.earnedStar ? 'border-amber-200 bg-amber-50 dark:border-amber-900/60 dark:bg-amber-950/30' : 'border-slate-200 bg-slate-50/70 dark:border-slate-800 dark:bg-slate-900/50',
                  )}
                >
                  <div className="flex w-full flex-col items-center justify-center gap-2 text-center">
                    <div className="relative">
                      <Star className={cn('h-7 w-7 transition-all duration-700 sm:h-8 sm:w-8', resultMeta?.earnedStar ? 'fill-amber-400 text-amber-500 drop-shadow-[0_0_14px_rgba(251,191,36,0.45)]' : 'fill-slate-200 text-slate-300')} />
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
                    <div>
                      <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-slate-400 sm:text-xs">Зірочки</p>
                      <p className="text-2xl font-semibold leading-tight text-slate-950 dark:text-white">{resultMeta?.totalStars ?? '—'}</p>
                      <p className="mt-1 line-clamp-2 text-[11px] font-semibold leading-4 text-slate-500 dark:text-slate-300 sm:text-xs">
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
                    'flex min-h-[132px] rounded-2xl border p-3 sm:min-h-[140px] sm:p-4',
                    (resultMeta?.streakActivated || resultMeta?.streakRestored || user?.streak_status === 'active')
                      ? 'border-orange-200 bg-orange-50 dark:border-orange-900/60 dark:bg-orange-950/30'
                      : 'border-slate-200 bg-slate-50/70 dark:border-slate-800 dark:bg-slate-900/50',
                  )}
                >
                  <div className="flex w-full flex-col items-center justify-center gap-2 text-center">
                    <motion.div
                      initial={false}
                      animate={resultMeta?.streakActivated || resultMeta?.streakRestored ? { scale: [0.76, 1.2, 1], opacity: [0.55, 1], rotate: [0, -6, 4, 0] } : {}}
                      transition={{ duration: 0.8 }}
                    >
                      <Flame className={cn('h-7 w-7 transition-all duration-700 sm:h-8 sm:w-8', (resultMeta?.streakActivated || resultMeta?.streakRestored || user?.streak_status === 'active') ? 'fill-orange-500 text-orange-500 drop-shadow-[0_0_14px_rgba(249,115,22,0.45)]' : 'text-slate-300')} />
                    </motion.div>
                    <div>
                      <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-slate-400 sm:text-xs">Серія</p>
                      <motion.p
                        key={resultMeta?.streak ?? 0}
                        initial={(resultMeta?.streakActivated || resultMeta?.streakRestored) ? { opacity: 0, y: 10, scale: 0.92 } : false}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        className="text-2xl font-semibold leading-tight text-slate-950 dark:text-white"
                        >
                          {resultMeta?.streak ?? '—'}
                        </motion.p>
                        <p className="mt-1 line-clamp-2 text-[11px] font-semibold leading-4 text-slate-500 dark:text-slate-300 sm:text-xs">
                          {resultMeta?.streakRestored
                            ? 'Серію відновлено'
                            : resultMeta?.streakActivated
                              ? 'Серія активна'
                              : 'Серія активна'}
                        </p>
                      </div>
                    </div>
                  </motion.div>
              </div> : null}

              <div className="mt-6 flex flex-wrap justify-center gap-3">
                <Button variant="outline" onClick={() => setResultsDialogOpen(false)}>
                  Переглянути відповіді
                </Button>
                <Button variant="outline" onClick={() => navigate(returnPath)}>
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

