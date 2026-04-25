import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Zap, Heart, Trophy, ArrowRight, RotateCcw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/lib/AuthContext';
import api from '@/api/apiClient';
import { fetchRandomQuestions, normalizeQuestion } from '@/api/questionsApi';
import LoginPrompt from '@/components/auth/LoginPrompt';
import QuestionCard from '@/components/test/QuestionCard';

const TOTAL_LIVES = 3;

export default function Marathon() {
  const navigate = useNavigate();
  const { user, isLoadingAuth } = useAuth();
  const [phase, setPhase] = useState('idle');
  const [queue, setQueue] = useState(/** @type {import('@/types/questions').QuestionViewModel[]} */ ([]));
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState(/** @type {string | null} */ (null));
  const [score, setScore] = useState(0);
  const [answered, setAnswered] = useState(false);
  const [seenIds, setSeenIds] = useState(/** @type {number[]} */ ([]));
  const [lives, setLives] = useState(TOTAL_LIVES);

  /** @type {{ data: import('@/types/app').StatsResponse | undefined }} */
  const { data: stats } = useQuery({
    queryKey: ['marathon-stats'],
    queryFn: () => api.getStats(),
    enabled: !!user,
  });

  const bestScore = stats?.marathon_best || 0;

  /** @param {number[]} excludeIds */
  const loadNextQuestion = async (excludeIds) => {
    const data = await fetchRandomQuestions({ count: 1, category: 'B', excludeIds });
    const question = normalizeQuestion(data[0]);
    return question || null;
  };

  const startMarathon = async () => {
    const first = await loadNextQuestion([]);
    if (!first) return;
    setQueue([first]);
    setCurrentIndex(0);
    setScore(0);
    setSelectedAnswer(null);
    setAnswered(false);
    setSeenIds([Number(first.id)]);
    setLives(TOTAL_LIVES);
    setPhase('running');
  };

  /** @param {string} label */
  const handleSelectAnswer = async (label) => {
    if (answered) return;
    setSelectedAnswer(label);
    setAnswered(true);
    const currentQuestion = queue[currentIndex];
    if (!currentQuestion) return;

    if (label !== currentQuestion.correct_answer) {
      const nextLives = lives - 1;
      setLives(nextLives);
      if (nextLives <= 0) {
        try {
          await api.submitMarathonScore(score);
        } catch {
          // Keep local result visible.
        }
        setTimeout(() => setPhase('dead'), 1200);
      } else {
        setTimeout(() => {
          void handleNext();
        }, 900);
      }
      return;
    }

    setScore((prev) => prev + 1);
  };

  const handleNext = async () => {
    const nextQuestion = await loadNextQuestion(seenIds);
    if (!nextQuestion) {
      setPhase('dead');
      return;
    }
    setQueue((prev) => [...prev, nextQuestion]);
    setSeenIds((prev) => [...prev, Number(nextQuestion.id)]);
    setCurrentIndex((prev) => prev + 1);
    setSelectedAnswer(null);
    setAnswered(false);
  };

  if (isLoadingAuth) {
    return <div className="flex justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary/30 border-t-primary" /></div>;
  }

  if (!user) {
    return <LoginPrompt title="Режим Марафон" description="Увійдіть або зареєструйтесь, щоб грати в марафон і потрапити в таблицю лідерів." />;
  }

  const currentQuestion = queue[currentIndex];

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-black text-foreground">
            <Zap className="h-6 w-6 text-accent" />
            Марафон
          </h1>
          <p className="text-sm text-muted-foreground">Три життя. Кожна помилка розбиває одне сердечко.</p>
        </div>
        <div className="text-right">
          <div className="flex items-center gap-2">
            <Trophy className="h-4 w-4 text-yellow-500" />
            <span className="text-sm font-medium text-muted-foreground">Рекорд: <span className="font-bold text-foreground">{bestScore}</span></span>
          </div>
        </div>
      </div>

      {phase === 'idle' ? (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 py-16 text-center">
          <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-3xl bg-accent/20">
            <Zap className="h-12 w-12 text-accent-foreground" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-foreground">Готові до марафону?</h2>
            <p className="mx-auto mt-2 max-w-md text-muted-foreground">Відповідайте на питання одне за одним. Помилилися? Втрачаєте життя, але ще можете повернутись у гру.</p>
          </div>
          {bestScore > 0 ? (
            <div className="inline-flex items-center gap-2 rounded-xl border border-yellow-200 bg-yellow-50 px-4 py-2 text-sm font-medium text-yellow-800 dark:border-yellow-900/60 dark:bg-yellow-950/30 dark:text-yellow-300">
              <Trophy className="h-4 w-4" />
              Ваш рекорд: {bestScore} питань поспіль
            </div>
          ) : null}
          <Button size="lg" onClick={() => void startMarathon()} className="h-12 rounded-xl px-10">
            Почати марафон
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </motion.div>
      ) : null}

      {phase === 'running' && currentQuestion ? (
        <>
          <div className="flex items-center justify-between px-1">
            <Badge variant="outline" className="gap-2 px-4 py-1.5 text-base">
              <Zap className="h-4 w-4 text-accent" />
              {score} поспіль
            </Badge>

            <div className="flex items-center gap-2">
              {Array.from({ length: TOTAL_LIVES }).map((_, index) => {
                const alive = index < lives;
                return (
                  <motion.div
                    key={index}
                    initial={false}
                    animate={alive ? { scale: 1, rotate: 0, opacity: 1 } : { scale: [1, 1.1, 0.9], rotate: [0, -20, 18, -12], opacity: 0.45 }}
                    transition={{ duration: 0.45 }}
                    className="relative"
                  >
                    <Heart className={alive ? 'h-6 w-6 fill-rose-500 text-rose-500' : 'h-6 w-6 text-slate-300'} />
                    {!alive ? <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-[10px] font-black text-slate-500">×</span> : null}
                  </motion.div>
                );
              })}
            </div>
          </div>

          <AnimatePresence mode="wait">
            <motion.div key={currentIndex} initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.2 }} className="rounded-2xl border border-border bg-card p-6">
              <QuestionCard
                question={currentQuestion}
                index={currentIndex}
                totalQuestions={queue.length}
                selectedAnswer={selectedAnswer}
                onSelectAnswer={(label) => void handleSelectAnswer(label)}
                isFavorite={false}
                onToggleFavorite={undefined}
                isAuthenticated
                onAnalyzeSituation={null}
              />
            </motion.div>
          </AnimatePresence>

          {answered && selectedAnswer === currentQuestion.correct_answer ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-end">
              <Button onClick={() => void handleNext()} className="gap-2 rounded-xl px-6">
                Далі <ArrowRight className="h-4 w-4" />
              </Button>
            </motion.div>
          ) : null}
        </>
      ) : null}

      {phase === 'dead' ? (
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="space-y-6 py-12 text-center">
          <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-3xl bg-destructive/10">
            <span className="text-5xl">💔</span>
          </div>
          <div>
            <h2 className="text-3xl font-black text-foreground">Марафон завершено</h2>
            <p className="mt-2 text-muted-foreground">Ви відповіли правильно на <span className="font-bold text-foreground">{score}</span> питань поспіль.</p>
          </div>
          <div className="flex justify-center gap-3">
            <Button onClick={() => void startMarathon()} className="gap-2 rounded-xl px-6">
              <RotateCcw className="h-4 w-4" /> Знову
            </Button>
            <Button variant="outline" onClick={() => navigate('/leaderboard')} className="gap-2 rounded-xl px-6">
              <Trophy className="h-4 w-4" /> Таблиця лідерів
            </Button>
          </div>
        </motion.div>
      ) : null}
    </div>
  );
}
