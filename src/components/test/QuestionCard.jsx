import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Bookmark, BookmarkCheck, ChevronDown, Lock, Lightbulb, ZoomIn } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function QuestionCard({
  question,
  index,
  totalQuestions,
  selectedAnswer,
  onSelectAnswer,
  isFavorite,
  onToggleFavorite,
  isAuthenticated = false,
  onAnalyzeSituation,
}) {
const [showExplanation, setShowExplanation] = useState(/** @type {boolean | 'locked'} */(false));
  const options = question.options || [];

  // Answer was selected — show result immediately
  const hasAnswered = selectedAnswer !== undefined && selectedAnswer !== null;
  const isCorrect = selectedAnswer === question.correct_answer;

  return (
    <div className="space-y-5">
      {/* Question header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <span className="text-sm font-medium text-muted-foreground">
            Питання {index + 1} з {totalQuestions}
          </span>
          <h2 className="text-lg sm:text-xl font-semibold text-foreground mt-1 leading-relaxed">
            {question.text}
          </h2>
        </div>
        {onToggleFavorite && (
          <button
            onClick={onToggleFavorite}
            className="p-2 rounded-lg hover:bg-muted transition-colors shrink-0"
          >
            {isFavorite
              ? <BookmarkCheck className="w-5 h-5 text-accent" />
              : <Bookmark className="w-5 h-5 text-muted-foreground" />}
          </button>
        )}
      </div>

      {/* Image */}
      {question.image_url && (
        <div className="relative rounded-xl overflow-hidden border border-border bg-muted/50 group">
          <img
            src={question.image_url}
            alt="Ілюстрація до питання"
            className="w-full max-h-72 object-contain"
          />
          {onAnalyzeSituation && (
            <button
              onClick={() => onAnalyzeSituation(question)}
              className="absolute bottom-3 right-3 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium opacity-90 hover:opacity-100 transition-opacity shadow"
            >
              <ZoomIn className="w-3.5 h-3.5" />
              Аналіз ситуації
            </button>
          )}
        </div>
      )}

      {/* Options */}
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
                "w-full flex items-start gap-3 p-4 rounded-xl border-2 text-left transition-all duration-200",
                showGreen
                  ? "border-success bg-success/8"
                  : isWrong
                  ? "border-destructive bg-destructive/8"
                  : isSelected
                  ? "border-primary bg-primary/5"
                  : disabled
                  ? "border-border bg-card opacity-50 cursor-default"
                  : "border-border bg-card hover:border-primary/40 hover:bg-primary/3 cursor-pointer"
              )}
            >
              <div className={cn(
                "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-sm font-bold transition-colors",
                showGreen
                  ? "bg-success text-success-foreground"
                  : isWrong
                  ? "bg-destructive text-destructive-foreground"
                  : isSelected
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              )}>
                {option.label}
              </div>
              <span className="text-sm sm:text-base pt-1 text-foreground leading-relaxed">
                {option.text}
              </span>
              {showGreen && (
                <span className="ml-auto shrink-0 text-success text-lg">✓</span>
              )}
              {isWrong && (
                <span className="ml-auto shrink-0 text-destructive text-lg">✗</span>
              )}
            </motion.button>
          );
        })}
      </div>

      {/* Explanation button — shown after answering */}
      <AnimatePresence>
        {hasAnswered && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-2"
          >
            {/* Inline correct/wrong feedback */}
            <div className={cn(
              "flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold",
              isCorrect
                ? "bg-success/10 text-success"
                : "bg-destructive/10 text-destructive"
            )}>
              {isCorrect ? '✓ Правильно!' : `✗ Неправильно! Правильна відповідь: ${question.correct_answer}`}
            </div>

            {/* Explanation toggle */}
            {question.explanation && (
              <div>
                <button
                  onClick={() => {
                    if (isAuthenticated) {
                      setShowExplanation(v => !v);
                    } else {
                      setShowExplanation('locked');
                    }
                  }}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-primary/20 bg-primary/5 text-primary text-sm font-medium hover:bg-primary/10 transition-colors w-full"
                >
                  <Lightbulb className="w-4 h-4 shrink-0" />
                  <span className="flex-1 text-left">Пояснення відповіді</span>
                  {isAuthenticated
                    ? <ChevronDown className={cn("w-4 h-4 transition-transform", showExplanation === true && "rotate-180")} />
                    : <Lock className="w-4 h-4" />}
                </button>

                <AnimatePresence>
                  {showExplanation === true && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="mt-2 p-4 rounded-xl bg-primary/5 border border-primary/20">
                        <p className="text-sm text-foreground leading-relaxed">{question.explanation}</p>
                      </div>
                    </motion.div>
                  )}
                  {showExplanation === 'locked' && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="mt-2 p-4 rounded-xl bg-muted border border-border flex items-center gap-3">
                        <Lock className="w-5 h-5 text-muted-foreground shrink-0" />
                        <div>
                          <p className="text-sm font-medium text-foreground">Пояснення доступне лише зареєстрованим</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            <a href="#" onClick={(e) => { e.preventDefault(); }} className="text-primary underline">Зареєструйтесь</a> щоб побачити пояснення
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}