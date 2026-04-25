import { useState } from 'react';
import { cn } from '@/lib/utils';
import { BadgeAlert, Bookmark, BookmarkCheck, ChevronDown, Lightbulb, ZoomIn } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

/** @param {import('@/types/questions').QuestionCardProps} props */
export default function QuestionCard({
  question,
  index = 0,
  totalQuestions = 1,
  selectedAnswer,
  onSelectAnswer,
  isFavorite = false,
  onToggleFavorite,
  onAnalyzeSituation = null,
}) {
  const [showExplanation, setShowExplanation] = useState(false);
  const options = question.options || [];
  const hasAnswered = selectedAnswer !== undefined && selectedAnswer !== null;
  const isCorrect = selectedAnswer === question.correct_answer;

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <span className="text-sm font-medium text-muted-foreground">Питання {index + 1} з {totalQuestions}</span>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full border border-primary/15 bg-primary/5 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-primary">
              <BadgeAlert className="h-3.5 w-3.5" />
              Складність: {question.difficulty || 'medium'}
            </span>
            {question.topic ? (
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                {question.topic}
              </span>
            ) : null}
          </div>
          <h2 className="mt-2 text-lg font-semibold leading-relaxed text-foreground sm:text-xl">{question.text}</h2>
        </div>
        {onToggleFavorite && (
          <button onClick={onToggleFavorite} className="shrink-0 rounded-lg p-2 transition-colors hover:bg-muted">
            {isFavorite ? <BookmarkCheck className="h-5 w-5 text-accent" /> : <Bookmark className="h-5 w-5 text-muted-foreground" />}
          </button>
        )}
      </div>

      {question.image_url && (
        <div className="group relative overflow-hidden rounded-xl border border-border bg-muted/50">
          <img src={question.image_url} alt="Ілюстрація до питання" className="max-h-72 w-full object-contain" />
          {onAnalyzeSituation && (
            <button
              onClick={() => onAnalyzeSituation(question)}
              className="absolute bottom-3 right-3 flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground opacity-90 shadow transition-opacity hover:opacity-100"
            >
              <ZoomIn className="h-3.5 w-3.5" />
              Аналіз ситуації
            </button>
          )}
        </div>
      )}

      <div className="space-y-2.5">
        {options.map((option) => {
          const isSelected = selectedAnswer === option.label;
          const isOptionCorrect = option.label === question.correct_answer;
          const isWrong = hasAnswered && isSelected && !isOptionCorrect;
          const showGreen = hasAnswered && isOptionCorrect;
          const disabled = hasAnswered;

          return (
            <motion.button
              key={option.label}
              onClick={() => !disabled && onSelectAnswer(option.label)}
              disabled={disabled}
              whileTap={!disabled ? { scale: 0.98 } : {}}
              className={cn(
                'flex w-full items-start gap-3 rounded-xl border-2 p-4 text-left transition-all duration-200',
                showGreen
                  ? 'border-success bg-success/8'
                  : isWrong
                    ? 'border-destructive bg-destructive/8'
                    : isSelected
                      ? 'border-primary bg-primary/5'
                      : disabled
                        ? 'cursor-default border-border bg-card opacity-50'
                        : 'cursor-pointer border-border bg-card hover:border-primary/40 hover:bg-primary/3',
              )}
            >
              <div
                className={cn(
                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm font-bold transition-colors',
                  showGreen
                    ? 'bg-success text-success-foreground'
                    : isWrong
                      ? 'bg-destructive text-destructive-foreground'
                      : isSelected
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground',
                )}
              >
                {option.label}
              </div>
              <span className="pt-1 text-sm leading-relaxed text-foreground sm:text-base">{option.text}</span>
              {showGreen && <span className="ml-auto shrink-0 text-lg text-success">✓</span>}
              {isWrong && <span className="ml-auto shrink-0 text-lg text-destructive">✕</span>}
            </motion.button>
          );
        })}
      </div>

      <AnimatePresence>
        {hasAnswered && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-2">
            <div
              className={cn(
                'rounded-xl px-4 py-2.5 text-sm font-semibold',
                isCorrect ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive',
              )}
            >
              {isCorrect ? '✓ Правильно!' : `✕ Неправильно. Правильна відповідь: ${question.correct_answer}`}
            </div>

            {question.explanation ? (
              <div>
                <button
                  onClick={() => setShowExplanation((value) => !value)}
                  className="flex w-full items-center gap-2 rounded-xl border border-primary/20 bg-primary/5 px-4 py-2.5 text-sm font-medium text-primary transition-colors hover:bg-primary/10"
                >
                  <Lightbulb className="h-4 w-4 shrink-0" />
                  <span className="flex-1 text-left">Пояснення відповіді</span>
                  <ChevronDown className={cn('h-4 w-4 transition-transform', showExplanation && 'rotate-180')} />
                </button>

                <AnimatePresence>
                  {showExplanation && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                      <div className="mt-2 rounded-xl border border-primary/20 bg-primary/5 p-4">
                        <p className="text-sm leading-relaxed text-foreground">{question.explanation}</p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ) : null}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
