import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { BadgeAlert, BookOpen, Bookmark, BookmarkCheck, ChevronDown, Lightbulb, ZoomIn } from 'lucide-react';
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
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <span className="text-sm font-medium text-muted-foreground">
            Питання {index + 1} з {totalQuestions}
          </span>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full border border-primary/15 bg-primary/5 px-3 py-1 text-xs font-medium uppercase tracking-[0.16em] text-primary">
              <BadgeAlert className="h-3.5 w-3.5" />
              Складність: {question.difficulty || 'medium'}
            </span>
            {question.topic ? (
              <span className="rounded-full border border-border bg-transparent px-3 py-1 text-xs font-medium text-slate-500 dark:text-slate-300">
                {question.topic}
              </span>
            ) : null}
            {question.ticket_number ? (
              <span className="rounded-full border border-border bg-transparent px-3 py-1 text-xs font-medium text-slate-500 dark:text-slate-300">
                Білет {question.ticket_number}
              </span>
            ) : null}
          </div>
          <h2 className="mt-3 text-lg font-medium leading-relaxed text-foreground sm:text-xl">{question.text}</h2>
        </div>

        {onToggleFavorite ? (
          <button
            type="button"
            onClick={onToggleFavorite}
            className="shrink-0 rounded-md p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-primary"
            aria-label={isFavorite ? 'Прибрати зі збережених' : 'Зберегти питання'}
            title={isFavorite ? 'Прибрати зі збережених' : 'Зберегти питання'}
          >
            {isFavorite ? <BookmarkCheck className="h-5 w-5 text-primary" /> : <Bookmark className="h-5 w-5" />}
          </button>
        ) : null}
      </div>

      <div className={cn(hasImage && 'lg:grid lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:items-start lg:gap-6')}>
        {hasImage ? (
          <div className="group relative mb-4 overflow-hidden rounded-xl border border-border bg-slate-50/70 dark:bg-slate-900/50 lg:mb-0">
            <img src={question.image_url} alt="Ілюстрація до питання" className="max-h-[300px] w-full object-contain sm:max-h-[360px]" />
            {onAnalyzeSituation ? (
              <button
                type="button"
                onClick={() => onAnalyzeSituation(question)}
                className="absolute bottom-3 right-3 flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground opacity-90 shadow transition-opacity hover:opacity-100"
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
                  'flex w-full items-start gap-3 rounded-lg border p-4 text-left transition-colors duration-200',
                  showGreen
                    ? 'border-success/60 bg-success/10'
                    : isWrong
                      ? 'border-destructive/60 bg-destructive/10'
                      : isSelected
                        ? 'border-primary/60 bg-primary/10'
                        : disabled
                          ? 'cursor-default border-border bg-transparent opacity-70'
                          : 'cursor-pointer border-border bg-transparent hover:border-primary/40 hover:bg-primary/5',
                )}
              >
                <div
                  className={cn(
                    'flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-sm font-semibold transition-colors',
                    showGreen
                      ? 'bg-success text-success-foreground'
                      : isWrong
                        ? 'bg-destructive text-destructive-foreground'
                        : isSelected
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted/70 text-muted-foreground',
                  )}
                >
                  {option.label}
                </div>
                <span className="pt-1 text-sm leading-relaxed text-foreground sm:text-base">{option.text}</span>
                {showGreen ? <span className="ml-auto shrink-0 text-lg text-success">✓</span> : null}
                {isWrong ? <span className="ml-auto shrink-0 text-lg text-destructive">×</span> : null}
              </motion.button>
            );
          })}
        </div>
      </div>

      <AnimatePresence>
        {hasAnswered && revealAnswer ? (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
            <div className={cn('rounded-lg px-4 py-3 text-sm font-medium', isCorrect ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive')}>
              {isCorrect ? '✓ Правильно!' : `× Неправильно. Правильна відповідь: ${question.correct_answer}`}
            </div>

            {question.explanation || question.explanation_html ? (
              <div>
                <button
                  type="button"
                  onClick={() => setShowExplanation((value) => !value)}
                  className="flex w-full items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-sm font-medium text-primary transition-colors hover:bg-primary/10"
                >
                  <Lightbulb className="h-4 w-4 shrink-0" />
                  <span className="flex-1 text-left">Пояснення відповіді</span>
                  <ChevronDown className={cn('h-4 w-4 transition-transform', showExplanation && 'rotate-180')} />
                </button>

                <AnimatePresence>
                  {showExplanation ? (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                      <div className="mt-3 rounded-lg border border-primary/20 bg-primary/5 p-4">
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
