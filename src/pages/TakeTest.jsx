import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/api/supabaseClient';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight, Clock, CheckCircle, AlertTriangle, Brain } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import QuestionCard from '@/components/test/QuestionCard';
import QuestionNavigator from '@/components/test/QuestionNavigator';
import SituationAnalysisModal from '@/components/test/SituationAnalysisModal';
import { updateSRSData, getDueQuestions } from '@/lib/spacedRepetition';
import { ACHIEVEMENTS } from '@/pages/Achievements';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

const MODE_CONFIG = {
  quick:     { count: 10, label: 'Швидкий тест',          time: 600  },
  full:      { count: 20, label: 'Повний іспит',           time: 1200 },
  difficult: { count: 10, label: 'Складні питання',        time: 600  },
  daily:     { count: 15, label: 'Виклик дня',             time: 900  },
  srs:       { count: 20, label: 'Інтервальне повторення', time: 1200 },
};

function shuffleArray(arr, seed) {
  const shuffled = [...arr];
  let currentIndex = shuffled.length;
  let s = seed;
  while (currentIndex !== 0) {
    s = (s * 9301 + 49297) % 233280;
    const randomIndex = Math.floor((s / 233280) * currentIndex);
    currentIndex--;
    [shuffled[currentIndex], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[currentIndex]];
  }
  return shuffled;
}

export default function TakeTest() {
  const navigate = useNavigate();
  const urlParams = new URLSearchParams(window.location.search);
  const mode = urlParams.get('mode') || 'quick';
  const category = urlParams.get('category') || 'B';
  const topic = urlParams.get('topic');
  const config = MODE_CONFIG[mode] || MODE_CONFIG.quick;

  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [showFinalResults, setShowFinalResults] = useState(false);
  const [timeLeft, setTimeLeft] = useState(config.time);
  const [testQuestions, setTestQuestions] = useState([]);
  const [analyzingQuestion, setAnalyzingQuestion] = useState(null);
  const [user, setUser] = useState(null);
  const [newAchievements, setNewAchievements] = useState([]);
  const startTimeRef = useRef(Date.now());

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user || null)).catch(() => setUser(null));
  }, []);

  const { data: allQuestions = [], isLoading } = useQuery({
    queryKey: ['questions', category, topic],
    queryFn: async () => {
      let query = supabase.from('questions').select('*').eq('category', category);
      if (topic) query = query.eq('topic', topic);
      const { data } = await query;
      return data || [];
    },
  });

  const { data: progressList = [] } = useQuery({
    queryKey: ['userProgress', user?.email],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from('user_progress').select('*').eq('created_by', user.email);
      return data || [];
    },
  });

  const progress = progressList[0] || {};

  useEffect(() => {
    if (allQuestions.length === 0) return;
    let selected;

    if (mode === 'srs' && user) {
      const srsData = progress.srs_data || {};
      const dueIds = getDueQuestions(srsData, allQuestions.map(q => q.id));
      const dueQuestions = dueIds.map(id => allQuestions.find(q => q.id === id)).filter(Boolean).slice(0, config.count);
      selected = dueQuestions.length > 0 ? dueQuestions : shuffleArray(allQuestions, Date.now()).slice(0, config.count);
    } else if (mode === 'difficult' && user) {
      const difficultIds = new Set(progress.difficult_question_ids || []);
      const difficult = allQuestions.filter(q => difficultIds.has(q.id));
      selected = difficult.length >= 5
        ? shuffleArray(difficult, Date.now()).slice(0, config.count)
        : shuffleArray(allQuestions, Date.now()).slice(0, config.count);
    } else if (mode === 'daily') {
      const today = new Date();
      const seed = today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate();
      selected = shuffleArray(allQuestions, seed).slice(0, config.count);
    } else {
      selected = shuffleArray(allQuestions, Date.now()).slice(0, config.count);
    }

    setTestQuestions(selected);
  }, [allQuestions, mode, progress, user]);

  useEffect(() => {
    if (showFinalResults) return;
    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) { clearInterval(interval); handleFinish(); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [showFinalResults]);

  const formatTime = (s) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

  const handleSelectAnswer = (label) => {
    const qid = testQuestions[currentIndex].id;
    if (answers[qid] !== undefined) return;
    setAnswers(prev => ({ ...prev, [qid]: label }));
  };

  const handleFinish = async () => {
    setShowFinalResults(true);
    const timeSpent = Math.floor((Date.now() - startTimeRef.current) / 1000);
    const correct = testQuestions.filter(q => answers[q.id] === q.correct_answer).length;
    const scorePercent = Math.round((correct / testQuestions.length) * 100);

    const resultAnswers = testQuestions.map(q => ({
      question_id: q.id,
      selected_answer: answers[q.id] || '',
      is_correct: answers[q.id] === q.correct_answer,
    }));

    if (user) {
      await supabase.from('test_results').insert([{
        test_type: mode, category,
        total_questions: testQuestions.length,
        correct_answers: correct,
        score_percent: scorePercent,
        time_spent_seconds: timeSpent,
        answers: resultAnswers,
        passed: scorePercent >= 80,
        created_by: user.email,
      }]);

      const today = new Date().toISOString().split('T')[0];
      const wrongIds = testQuestions.filter(q => answers[q.id] !== q.correct_answer).map(q => q.id);
      const correctIds = testQuestions.filter(q => answers[q.id] === q.correct_answer).map(q => q.id);

      let srsData = { ...(progress.srs_data || {}) };
      testQuestions.forEach(q => {
        srsData = updateSRSData(srsData, q.id, answers[q.id] === q.correct_answer);
      });

      const existingDifficult = progress.difficult_question_ids || [];
      const mergedDifficult = [...new Set([...existingDifficult, ...wrongIds])].filter(id => !correctIds.includes(id));
      const activityDates = progress.activity_dates || [];
      if (!activityDates.includes(today)) activityDates.push(today);

      const updatedProgress = {
        total_tests: (progress.total_tests || 0) + 1,
        total_correct: (progress.total_correct || 0) + correct,
        total_questions_answered: (progress.total_questions_answered || 0) + testQuestions.length,
        last_activity_date: today,
        difficult_question_ids: mergedDifficult,
        activity_dates: activityDates,
        srs_data: srsData,
      };

      if (progressList.length > 0) {
        await supabase.from('user_progress').update(updatedProgress).eq('id', progress.id);
      } else {
        await supabase.from('user_progress').insert([{
          ...updatedProgress,
          total_tests: 1, total_correct: correct,
          total_questions_answered: testQuestions.length,
          difficult_question_ids: wrongIds,
          favorite_question_ids: [],
          achievements: [],
          created_by: user.email,
        }]);
      }

      // Check achievements
      const { data: allResults = [] } = await supabase.from('test_results').select('*').order('created_at', { ascending: false }).limit(100);
      const mergedProg = { ...progress, ...updatedProgress };
      const prevEarned = new Set((progress.achievements || []).map(a => a.id));
      const nowEarned = ACHIEVEMENTS.filter(a => { try { return a.check(mergedProg, allResults); } catch { return false; } });
      const brandNew = nowEarned.filter(a => !prevEarned.has(a.id));
      if (brandNew.length > 0) {
        setNewAchievements(brandNew);
        const newAchievList = [
          ...(progress.achievements || []),
          ...brandNew.map(a => ({ id: a.id, name: a.name, earned_date: today })),
        ];
        if (progressList.length > 0) {
          await supabase.from('user_progress').update({ achievements: newAchievList }).eq('id', progress.id);
        }
      }
    }
  };

  const currentQuestion = testQuestions[currentIndex];
  const answeredCount = Object.keys(answers).length;
  const correctCount = testQuestions.filter(q => answers[q.id] === q.correct_answer).length;
  const isAuthenticated = !!user;

  if (isLoading || (allQuestions.length > 0 && testQuestions.length === 0)) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
        <p className="text-muted-foreground text-sm">Підготовка питань...</p>
      </div>
    );
  }

  if (!isLoading && testQuestions.length === 0) {
    return (
      <div className="text-center py-20 space-y-4">
        <AlertTriangle className="w-12 h-12 text-muted-foreground mx-auto" />
        <h2 className="text-xl font-semibold">Недостатньо питань</h2>
        <p className="text-muted-foreground">Для обраних параметрів немає питань</p>
        <Button onClick={() => navigate('/tests')}>Назад до вибору</Button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <AnimatePresence>
        {newAchievements.map((ach) => (
          <motion.div
            key={ach.id}
            initial={{ opacity: 0, y: -60, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -40 }}
            className="fixed top-5 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-5 py-3.5 rounded-2xl bg-primary text-primary-foreground shadow-2xl cursor-pointer"
            onClick={() => setNewAchievements(prev => prev.filter(a => a.id !== ach.id))}
          >
            <div className="w-10 h-10 rounded-xl bg-primary-foreground/20 flex items-center justify-center shrink-0">
              <ach.icon className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-medium opacity-80">🏆 Нове досягнення!</p>
              <p className="text-sm font-bold">{ach.name}</p>
              <p className="text-xs opacity-80">{ach.desc}</p>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            {mode === 'srs' && <Brain className="w-5 h-5 text-primary" />}
            {config.label}
          </h1>
          <p className="text-sm text-muted-foreground">Категорія {category}</p>
        </div>
        <div className="flex items-center gap-2">
          {!showFinalResults && (
            <Badge variant="outline" className="text-base px-3 py-1.5 gap-1.5">
              <Clock className="w-4 h-4" />{formatTime(timeLeft)}
            </Badge>
          )}
          <Badge variant="secondary" className="text-sm px-3 py-1.5">
            {answeredCount}/{testQuestions.length}
          </Badge>
        </div>
      </div>

      {showFinalResults && (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
          className="p-6 rounded-2xl bg-card border border-border text-center space-y-4">
          <div className={`w-20 h-20 rounded-full mx-auto flex items-center justify-center ${correctCount / testQuestions.length >= 0.8 ? 'bg-success/10' : 'bg-destructive/10'}`}>
            <span className={`text-3xl font-black ${correctCount / testQuestions.length >= 0.8 ? 'text-success' : 'text-destructive'}`}>
              {Math.round((correctCount / testQuestions.length) * 100)}%
            </span>
          </div>
          <h2 className="text-2xl font-bold">
            {correctCount / testQuestions.length >= 0.8 ? '🎉 Тест складено!' : 'Потрібно більше практики'}
          </h2>
          <p className="text-muted-foreground">Правильних: {correctCount} з {testQuestions.length}</p>
          {!isAuthenticated && (
            <p className="text-sm text-muted-foreground bg-muted rounded-lg p-3">
              Зареєструйтесь щоб зберігати прогрес та бачити пояснення
            </p>
          )}
          <div className="flex justify-center gap-3 pt-2">
            <Button variant="outline" onClick={() => navigate('/tests')}>Новий тест</Button>
            {isAuthenticated && <Button onClick={() => navigate('/progress')}>Мій прогрес</Button>}
          </div>
        </motion.div>
      )}

      <QuestionNavigator
        questions={testQuestions}
        answers={answers}
        currentIndex={currentIndex}
        onNavigate={setCurrentIndex}
        showResults={showFinalResults}
      />

      {currentQuestion && (
        <AnimatePresence mode="wait">
          <motion.div
            key={currentIndex}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
            className="bg-card rounded-2xl border border-border p-6"
          >
            <QuestionCard
              question={currentQuestion}
              index={currentIndex}
              totalQuestions={testQuestions.length}
              selectedAnswer={answers[currentQuestion.id]}
              onSelectAnswer={handleSelectAnswer}
              isAuthenticated={isAuthenticated}
              onAnalyzeSituation={currentQuestion.image_url ? setAnalyzingQuestion : null}
              isFavorite={false}
              onToggleFavorite={null}
            />
          </motion.div>
        </AnimatePresence>
      )}

      <div className="flex items-center justify-between">
        <Button variant="outline" disabled={currentIndex === 0} onClick={() => setCurrentIndex(i => i - 1)} className="gap-2">
          <ChevronLeft className="w-4 h-4" /> Назад
        </Button>

        {currentIndex < testQuestions.length - 1 ? (
          <Button onClick={() => setCurrentIndex(i => i + 1)} disabled={!answers[currentQuestion?.id]} className="gap-2">
            Далі <ChevronRight className="w-4 h-4" />
          </Button>
        ) : !showFinalResults ? (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button className="gap-2 bg-success hover:bg-success/90 text-success-foreground">
                <CheckCircle className="w-4 h-4" /> Завершити тест
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Завершити тест?</AlertDialogTitle>
                <AlertDialogDescription>
                  Ви відповіли на {answeredCount} з {testQuestions.length} питань.
                  {answeredCount < testQuestions.length && ' Залишились невідповідані питання.'}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Повернутись</AlertDialogCancel>
                <AlertDialogAction onClick={handleFinish}>Завершити</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        ) : null}
      </div>

      {analyzingQuestion && (
        <SituationAnalysisModal question={analyzingQuestion} onClose={() => setAnalyzingQuestion(null)} />
      )}
    </div>
  );
}