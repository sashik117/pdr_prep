import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/api/supabaseClient';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Zap, Heart, Trophy, ArrowRight, RotateCcw } from 'lucide-react';
import LoginPrompt from '@/components/auth/LoginPrompt';
import { motion, AnimatePresence } from 'framer-motion';
import QuestionCard from '@/components/test/QuestionCard';

function shuffleArray(arr) {
  const s = [...arr];
  for (let i = s.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [s[i], s[j]] = [s[j], s[i]];
  }
  return s;
}

export default function Marathon() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [userLoading, setUserLoading] = useState(true);
  const [phase, setPhase] = useState('idle');
  const [queue, setQueue] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [score, setScore] = useState(0);
  const [bestScore, setBestScore] = useState(0);
  const [answered, setAnswered] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
      setUserLoading(false);
    }).catch(() => setUserLoading(false));
  }, []);

  const { data: allQuestions = [] } = useQuery({
    queryKey: ['marathonQuestions'],
    queryFn: async () => {
      const { data } = await supabase.from('questions').select('*').eq('category', 'B');
      return data || [];
    },
    enabled: !!user,
  });

  const { data: progressList = [] } = useQuery({
    queryKey: ['userProgress', user?.email],
    queryFn: async () => {
      const { data } = await supabase.from('user_progress').select('*').eq('created_by', user.email);
      return data || [];
    },
    enabled: !!user,
  });

  const progress = progressList[0] || {};

  useEffect(() => {
    setBestScore(progress.marathon_best || 0);
  }, [progress.marathon_best]);

  const startMarathon = () => {
    if (allQuestions.length === 0) return;
    setQueue(shuffleArray(allQuestions));
    setCurrentIndex(0);
    setScore(0);
    setSelectedAnswer(null);
    setAnswered(false);
    setPhase('running');
  };

  const handleSelectAnswer = (label) => {
    if (answered) return;
    setSelectedAnswer(label);
    setAnswered(true);
    const isCorrect = label === queue[currentIndex].correct_answer;
    if (!isCorrect) {
      const finalScore = score;
      setTimeout(async () => {
        setPhase('dead');
        const newBest = Math.max(finalScore, bestScore);
        setBestScore(newBest);
        if (newBest > (progress.marathon_best || 0)) {
          if (progressList.length > 0) {
            await supabase.from('user_progress').update({ marathon_best: newBest }).eq('id', progress.id);
          } else {
            await supabase.from('user_progress').insert([{
              marathon_best: newBest,
              total_tests: 0, total_correct: 0,
              total_questions_answered: 0,
              activity_dates: [], favorite_question_ids: [],
              difficult_question_ids: [], achievements: [],
              created_by: user.email,
            }]);
          }
        }
      }, 1500);
    } else {
      setScore(s => s + 1);
    }
  };

  const handleNext = () => {
    if (currentIndex + 1 >= queue.length) {
      setQueue(shuffleArray(allQuestions));
      setCurrentIndex(0);
    } else {
      setCurrentIndex(i => i + 1);
    }
    setSelectedAnswer(null);
    setAnswered(false);
  };

  if (userLoading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <LoginPrompt title="Режим Марафон" description="Увійдіть або зареєструйтесь щоб зіграти в Марафон та потрапити в таблицю лідерів" />;
  }

  const currentQuestion = queue[currentIndex];

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-foreground flex items-center gap-2">
            <Zap className="w-6 h-6 text-accent" />
            Марафон
          </h1>
          <p className="text-sm text-muted-foreground">Відповідай без помилок — одна помилка і кінець!</p>
        </div>
        <div className="text-right">
          <div className="flex items-center gap-2">
            <Trophy className="w-4 h-4 text-yellow-500" />
            <span className="text-sm font-medium text-muted-foreground">Рекорд: <span className="text-foreground font-bold">{bestScore}</span></span>
          </div>
        </div>
      </div>

      {phase === 'idle' && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center py-16 space-y-6">
          <div className="w-24 h-24 rounded-3xl bg-accent/20 flex items-center justify-center mx-auto">
            <Zap className="w-12 h-12 text-accent-foreground" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-foreground">Готовий до марафону?</h2>
            <p className="text-muted-foreground mt-2 max-w-md mx-auto">
              Відповідай на питання одне за одним. Одна помилка — гра закінчується.
            </p>
          </div>
          {bestScore > 0 && (
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-yellow-50 border border-yellow-200 text-yellow-800 text-sm font-medium">
              <Trophy className="w-4 h-4" />
              Ваш рекорд: {bestScore} питань поспіль
            </div>
          )}
          <Button size="lg" onClick={startMarathon} className="px-10 rounded-xl h-12">
            Почати марафон <ArrowRight className="w-5 h-5 ml-2" />
          </Button>
        </motion.div>
      )}

      {phase === 'running' && currentQuestion && (
        <>
          <div className="flex items-center justify-between px-1">
            <Badge variant="outline" className="text-base px-4 py-1.5 gap-2">
              <Zap className="w-4 h-4 text-accent" />{score} поспіль
            </Badge>
            <div className="flex items-center gap-1">
              <Heart className="w-5 h-5 text-destructive fill-destructive" />
              <span className="text-sm font-bold text-destructive">1 життя</span>
            </div>
          </div>

          <AnimatePresence mode="wait">
            <motion.div key={currentIndex} initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.2 }}
              className="bg-card rounded-2xl border border-border p-6">
              <QuestionCard
                question={currentQuestion}
                index={currentIndex}
                totalQuestions={queue.length}
                selectedAnswer={selectedAnswer}
                onSelectAnswer={handleSelectAnswer}
                isAuthenticated={true}
                isFavorite={false}
                onToggleFavorite={null}
                onAnalyzeSituation={null}
              />
            </motion.div>
          </AnimatePresence>

          {answered && selectedAnswer === currentQuestion.correct_answer && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-end">
              <Button onClick={handleNext} className="gap-2 rounded-xl px-6">
                Далі <ArrowRight className="w-4 h-4" />
              </Button>
            </motion.div>
          )}
        </>
      )}

      {phase === 'dead' && (
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-12 space-y-6">
          <div className="w-24 h-24 rounded-3xl bg-destructive/10 flex items-center justify-center mx-auto">
            <span className="text-5xl">💀</span>
          </div>
          <div>
            <h2 className="text-3xl font-black text-foreground">Гра закінчена!</h2>
            <p className="text-muted-foreground mt-2">Ви відповіли правильно на <span className="font-bold text-foreground">{score}</span> питань поспіль</p>
          </div>
          {score >= bestScore && score > 0 && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-yellow-50 border border-yellow-200 text-yellow-800 font-bold">
              🏆 Новий рекорд!
            </motion.div>
          )}
          <div className="flex justify-center gap-3">
            <Button onClick={startMarathon} className="gap-2 rounded-xl px-6">
              <RotateCcw className="w-4 h-4" /> Знову
            </Button>
            <Button variant="outline" onClick={() => navigate('/leaderboard')} className="gap-2 rounded-xl px-6">
              <Trophy className="w-4 h-4" /> Таблиця лідерів
            </Button>
          </div>
        </motion.div>
      )}
    </div>
  );
}