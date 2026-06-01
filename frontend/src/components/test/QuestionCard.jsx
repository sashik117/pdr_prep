import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { BookOpen, Bookmark, BookmarkCheck, ChevronDown, Lightbulb, ZoomIn } from 'lucide-react';
import { cn } from '@/lib/utils';

/** @param {import('@/types/questions').QuestionCardProps & { question: any; revealAnswer?: boolean }} props */
export default function QuestionCard({
  question,
  index = 0,
  totalQuestions = 1,
  selectedAnswer,
  onSelectAnswer,
  isFavorite = false,
  onToggleFavorite,
  onAnalyzeSituation = null,
  revealAnswer = false,
}) {
  const [showExplanation, setShowExplanation] = useState(false);
  const options = question.options || [];
  const hasAnswered = selectedAnswer !== undefined && selectedAnswer !== null;
  const isCorrect = selectedAnswer === question.correct_answer;
  const theoryLink = question.theory_section_id ? `/study/section/${question.theory_section_id}` : null;
  const hasImage = Boolean(question.image_url);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            {question.ticket_number ? (
              <span className="rounded-full bg-primary-100 px-3 py-1 text-sm font-medium text-primary-700 dark:bg-primary-500/10 dark:text-primary-200">
                Білет {question.ticket_number}
              </span>
            ) : null}
            <span className="rounded-full bg-gray-100 px-3 py-1 text-sm text-gray-600 dark:bg-slate-800 dark:text-slate-300">
              Питання {index + 1} з {totalQuestions}
            </span>
          </div>
          <span className="text-xs text-gray-500 dark:text-slate-400">
            {question.topic || question.category || question.exam_block_label || `Складність: ${question.difficulty || 'medium'}`}
          </span>
          <h2 className="mt-4 text-xl font-semibold leading-relaxed text-gray-900 dark:text-white">{question.text}</h2>
        </div>

        {onToggleFavorite ? (
          <button
            type="button"
            onClick={onToggleFavorite}
            className="shrink-0 rounded-lg p-2 text-gray-400 transition-all hover:bg-gray-100 hover:text-yellow-500 dark:hover:bg-slate-800"
            aria-label={isFavorite ? 'Прибрати зі збережених' : 'Зберегти питання'}
            title={isFavorite ? 'Прибрати зі збережених' : 'Зберегти питання'}
          >
            {isFavorite ? <BookmarkCheck className="h-5 w-5 text-primary" /> : <Bookmark className="h-5 w-5" />}
          </button>
        ) : null}
      </div>

      <div className={cn(hasImage && 'lg:grid lg:grid-cols-[minmax(0,0.88fr)_minmax(0,1.12fr)] lg:items-start lg:gap-6')}>
        {hasImage ? (
          <div className="group relative mb-6 overflow-hidden rounded-xl bg-gray-100 dark:bg-slate-900 lg:mb-0">
            <img src={question.image_url} alt="Ілюстрація до питання" className="max-h-72 w-full object-contain sm:max-h-80" />
            {onAnalyzeSituation ? (
              <button
                type="button"
                onClick={() => onAnalyzeSituation(question)}
                className="absolute bottom-3 right-3 flex items-center gap-1.5 rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-medium text-white opacity-90 shadow transition-opacity hover:opacity-100"
              >
                <ZoomIn className="h-3.5 w-3.5" />
                Аналіз ситуації
              </button>
            ) : null}
          </div>
        ) : null}

        <div className="space-y-3">
          {options.map((option) => {
            const isSelected = selectedAnswer === option.label;
            const isOptionCorrect = option.label === question.correct_answer;
            const isWrong = revealAnswer && hasAnswered && isSelected && !isOptionCorrect;
            const showGreen = revealAnswer && hasAnswered && isOptionCorrect;
            const disabled = hasAnswered;

            return (
              <motion.button
                key={option.label}
                type="button"
                onClick={() => !disabled && onSelectAnswer?.(option.label)}
                disabled={disabled}
                whileTap={!disabled ? { scale: 0.98 } : {}}
                className={cn(
                  'flex w-full items-start gap-4 rounded-xl border-2 p-4 text-left transition-all duration-200',
                  !revealAnswer && 'hover:border-primary-300 hover:bg-primary-50 dark:hover:border-primary-500/40 dark:hover:bg-primary-500/10',
                  isSelected && !revealAnswer && 'border-primary-500 bg-primary-50 dark:bg-primary-500/10',
                  !isSelected && !revealAnswer && 'border-gray-200 bg-white dark:border-slate-700 dark:bg-slate-950',
                  showGreen && 'border-success-500 bg-success-50 dark:bg-success-500/10',
                  isWrong && 'border-error-500 bg-error-50 dark:bg-error-500/10',
                  revealAnswer && !isSelected && !isOptionCorrect && 'border-gray-200 bg-white opacity-55 dark:border-slate-700 dark:bg-slate-950',
                )}
              >
                <div
                  className={cn(
                    'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold transition-colors',
                    showGreen && 'bg-success-500 text-white',
                    isWrong && 'bg-error-500 text-white',
                    isSelected && !revealAnswer && 'bg-primary-500 text-white',
                    !isSelected && !revealAnswer && 'bg-gray-100 text-gray-600 dark:bg-slate-800 dark:text-slate-300',
                    revealAnswer && !isSelected && !isOptionCorrect && 'bg-gray-100 text-gray-400 dark:bg-slate-800',
                  )}
                >
                  {option.label}
                </div>
                <span
                  className={cn(
                    'flex-1 pt-1 text-base leading-relaxed text-gray-900 dark:text-slate-100',
                    showGreen && 'font-medium text-success-700 dark:text-success-300',
                    isWrong && 'text-error-700 dark:text-error-300',
                    revealAnswer && !isSelected && !isOptionCorrect && 'text-gray-400 dark:text-slate-500',
                  )}
                >
                  {option.text}
                </span>
                {showGreen ? <span className="ml-auto shrink-0 text-lg text-success-600 dark:text-success-300">✓</span> : null}
                {isWrong ? <span className="ml-auto shrink-0 text-lg text-error-600 dark:text-error-300">×</span> : null}
              </motion.button>
            );
          })}
        </div>
      </div>

      <AnimatePresence>
        {hasAnswered && revealAnswer ? (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
            <div className={cn('rounded-xl px-4 py-3 text-sm font-medium', isCorrect ? 'bg-success-50 text-success-700 dark:bg-success-500/10 dark:text-success-300' : 'bg-error-50 text-error-700 dark:bg-error-500/10 dark:text-error-300')}>
              {isCorrect ? '✓ Правильно!' : `× Неправильно. Правильна відповідь: ${question.correct_answer}`}
            </div>

            {question.explanation || question.explanation_html ? (
              <div>
                <button
                  type="button"
                  onClick={() => setShowExplanation((value) => !value)}
                  className="flex w-full items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-medium text-blue-800 transition-colors hover:bg-blue-100 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-200"
                >
                  <Lightbulb className="h-4 w-4 shrink-0" />
                  <span className="flex-1 text-left">Пояснення відповіді</span>
                  <ChevronDown className={cn('h-4 w-4 transition-transform', showExplanation && 'rotate-180')} />
                </button>

                <AnimatePresence>
                  {showExplanation ? (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                      <div className="mt-3 rounded-xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-500/20 dark:bg-blue-500/10">
                        {question.explanation_html ? (
                          <div className="prose prose-sm max-w-none dark:prose-invert" dangerouslySetInnerHTML={{ __html: question.explanation_html }} />
                        ) : (
                          <p className="text-sm leading-relaxed text-foreground">{question.explanation}</p>
                        )}
                      </div>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </div>
            ) : null}

            {theoryLink ? (
              <Link
                to={theoryLink}
                className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-4 py-3 text-sm font-medium text-slate-700 transition-colors hover:border-primary/30 hover:text-primary dark:text-slate-100"
              >
                <BookOpen className="h-4 w-4" />
                Читати правило
              </Link>
            ) : null}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
