import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, XCircle, ChevronRight, RefreshCcw, Image as ImageIcon } from 'lucide-react';
import { fetchQuestions, normalizeQuestion } from '@/api/questionsApi';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export default function Quiz() {
  const [questions, setQuestions] = useState(/** @type {import('@/types/questions').QuestionViewModel[]} */ ([]));
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState(/** @type {string | null} */ (null));
  const [isAnswered, setIsAnswered] = useState(false);
  const [loading, setLoading] = useState(true);
  const [score, setScore] = useState(0);

  useEffect(() => {
    async function loadQuiz() {
      try {
        setLoading(true);
        const data = await fetchQuestions({ limit: 20, section: '1', category: 'B' });
        const normalized = /** @type {import('@/types/questions').QuestionViewModel[]} */ (
          data.items.map(normalizeQuestion).filter(
            /** @param {import('@/types/questions').QuestionViewModel | null} question */
            (question) => question !== null
          )
        );
        setQuestions(normalized);
      } catch (err) {
        console.error('Помилка:', err);
      } finally {
        setLoading(false);
      }
    }

    loadQuiz();
  }, []);

  const currentQuestion = questions[currentIndex];

  /** @param {string} label */
  const handleAnswer = (label) => {
    if (isAnswered || !currentQuestion) return;

    setSelectedOption(label);
    setIsAnswered(true);

    if (label === currentQuestion.correct_answer) {
      setScore((prev) => prev + 1);
    }
  };

  const nextQuestion = () => {
    setSelectedOption(null);
    setIsAnswered(false);
    setCurrentIndex((prev) => prev + 1);
  };

  if (loading) {
    return <div className="flex justify-center p-12 text-sm text-muted-foreground">Завантаження тестів...</div>;
  }

  if (!questions.length) {
    return <div className="p-12 text-center text-sm text-muted-foreground">Питання не знайдені. Перевір бекенд.</div>;
  }

  if (currentIndex >= questions.length) {
    return (
      <div className="mx-auto max-w-md rounded-xl border border-slate-200 bg-card p-8 text-center shadow-sm dark:border-slate-800">
        <h2 className="mb-4 text-3xl font-semibold">Тест завершено!</h2>
        <p className="text-xl mb-6">Твій результат: {score} з {questions.length}</p>
        <Button onClick={() => window.location.reload()} className="gap-2">
          <RefreshCcw className="w-4 h-4" /> Почати заново
        </Button>
      </div>
    );
  }

  if (!currentQuestion) {
    return null;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5 p-4 sm:p-6">
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <motion.div
          className="bg-blue-600 h-full"
          initial={{ width: 0 }}
          animate={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
        />
      </div>

      <div className="flex justify-between items-center text-sm font-medium text-muted-foreground">
        <span>Питання {currentIndex + 1} з {questions.length}</span>
        <span className="text-blue-600">Розділ {currentQuestion.section}</span>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={currentIndex}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.3 }}
        >
          <Card className="overflow-hidden rounded-xl border-slate-200 shadow-sm dark:border-slate-800">
            {currentQuestion.image_url ? (
              <div className="flex aspect-video w-full items-center justify-center overflow-hidden bg-slate-50 dark:bg-slate-900">
                <img
                  src={currentQuestion.image_url}
                  alt="Ситуація на дорозі"
                  className="w-full h-full object-contain"
                  onError={(e) => {
                    /** @type {HTMLImageElement} */
                    const image = e.currentTarget;
                    image.src = 'https://placehold.co/600x400?text=Зображення+відсутнє';
                  }}
                />
              </div>
            ) : (
              <div className="flex items-center gap-2 bg-blue-50/50 p-4 text-blue-500 dark:bg-blue-950/20 dark:text-blue-300">
                <ImageIcon className="w-4 h-4" />
                <span className="text-xs italic">Питання без ілюстрації</span>
              </div>
            )}

            <CardContent className="p-6 sm:p-8">
              <h2 className="mb-8 text-lg font-medium leading-snug text-foreground sm:text-xl">
                {currentQuestion.text || currentQuestion.question_text}
              </h2>

              <div className="space-y-3">
                {currentQuestion.options.map((option) => {
                  const isCorrect = option.label === currentQuestion.correct_answer;
                  const isSelected = option.label === selectedOption;

                  let variant = 'border-slate-200 bg-background hover:border-blue-200 hover:bg-blue-50/30 dark:border-slate-800 dark:hover:bg-blue-950/20';
                  if (isAnswered) {
                    if (isCorrect) variant = 'border-green-500 bg-green-50 text-green-700 dark:bg-green-950/25 dark:text-green-200';
                    else if (isSelected) variant = 'border-red-500 bg-red-50 text-red-700 dark:bg-red-950/25 dark:text-red-200';
                    else variant = 'border-slate-200 opacity-50 dark:border-slate-800';
                  }

                  return (
                    <button
                      key={option.label}
                      disabled={isAnswered}
                      onClick={() => handleAnswer(option.label)}
                      className={`flex w-full items-center rounded-lg border p-4 text-left transition-colors duration-200 ${variant}`}
                    >
                      <span
                        className={`mr-4 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
                          isSelected || (isAnswered && isCorrect)
                            ? 'bg-current text-white'
                            : 'border bg-background text-slate-400'
                        }`}
                      >
                        {option.label}
                      </span>
                      <span className="flex-grow">{option.text}</span>
                      {isAnswered && isCorrect && <CheckCircle2 className="w-5 h-5 text-green-500 ml-2" />}
                      {isAnswered && isSelected && !isCorrect && <XCircle className="w-5 h-5 text-red-500 ml-2" />}
                    </button>
                  );
                })}
              </div>

              {isAnswered && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-8 flex flex-col gap-4"
                >
                  <div className="rounded-lg border border-blue-100 bg-blue-50 p-4 text-sm italic text-blue-800 dark:border-blue-900/50 dark:bg-blue-950/25 dark:text-blue-100">
                    <strong>Пояснення:</strong>{' '}
                    {currentQuestion.explanation || 'Правила дорожнього руху вимагають саме такої поведінки в цій ситуації.'}
                  </div>
                  <Button onClick={nextQuestion} className="h-12 w-full gap-2 rounded-lg text-lg font-medium">
                    Наступне питання <ChevronRight className="w-5 h-5" />
                  </Button>
                </motion.div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
