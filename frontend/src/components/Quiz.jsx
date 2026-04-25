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
    return <div className="flex justify-center p-20">Завантаження тестів...</div>;
  }

  if (!questions.length) {
    return <div className="text-center p-20">Питання не знайдені. Перевір бекенд!</div>;
  }

  if (currentIndex >= questions.length) {
    return (
      <div className="max-w-md mx-auto text-center p-10 bg-white rounded-3xl shadow-xl">
        <h2 className="text-3xl font-bold mb-4">Тест завершено!</h2>
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
    <div className="max-w-2xl mx-auto p-4 sm:p-6 space-y-6">
      <div className="w-full bg-gray-200 h-2 rounded-full overflow-hidden">
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
          <Card className="overflow-hidden border-none shadow-2xl rounded-3xl">
            {currentQuestion.image_url ? (
              <div className="w-full aspect-video bg-gray-100 flex items-center justify-center overflow-hidden">
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
              <div className="p-4 bg-blue-50/50 flex items-center gap-2 text-blue-400">
                <ImageIcon className="w-4 h-4" />
                <span className="text-xs italic">Питання без ілюстрації</span>
              </div>
            )}

            <CardContent className="p-6 sm:p-8">
              <h2 className="text-lg sm:text-xl font-bold text-gray-800 leading-snug mb-8">
                {currentQuestion.text || currentQuestion.question_text}
              </h2>

              <div className="space-y-3">
                {currentQuestion.options.map((option) => {
                  const isCorrect = option.label === currentQuestion.correct_answer;
                  const isSelected = option.label === selectedOption;

                  let variant = 'border-gray-100 bg-gray-50/50 hover:border-blue-200 hover:bg-blue-50/30';
                  if (isAnswered) {
                    if (isCorrect) variant = 'border-green-500 bg-green-50 text-green-700';
                    else if (isSelected) variant = 'border-red-500 bg-red-50 text-red-700';
                    else variant = 'opacity-50 border-gray-100';
                  }

                  return (
                    <button
                      key={option.label}
                      disabled={isAnswered}
                      onClick={() => handleAnswer(option.label)}
                      className={`w-full flex items-center p-4 rounded-2xl border-2 transition-all duration-200 text-left ${variant}`}
                    >
                      <span
                        className={`w-8 h-8 shrink-0 flex items-center justify-center rounded-full mr-4 font-bold text-sm ${
                          isSelected || (isAnswered && isCorrect)
                            ? 'bg-current text-white'
                            : 'bg-white border text-gray-400'
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
                  <div className="p-4 rounded-2xl bg-blue-50 text-blue-800 text-sm italic border border-blue-100">
                    <strong>Пояснення:</strong>{' '}
                    {currentQuestion.explanation || 'Правила дорожнього руху вимагають саме такої поведінки в цій ситуації.'}
                  </div>
                  <Button onClick={nextQuestion} className="w-full h-12 rounded-2xl text-lg font-bold gap-2">
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
