import { cn } from '@/lib/utils';

/** @param {import('@/types/questions').QuestionNavigatorProps} props */
export default function QuestionNavigator({ questions, answers, currentIndex, onNavigate, showResults = false }) {
  return (
    <div className="flex flex-wrap gap-2">
      {questions.map((question, index) => {
        const hasAnswer = answers[question.id] !== undefined;
        const isCurrent = index === currentIndex;
        const isCorrect = showResults && answers[question.id] === question.correct_answer;
        const isWrong = showResults && hasAnswer && answers[question.id] !== question.correct_answer;

        return (
          <button
            key={question.id}
            onClick={() => onNavigate(index)}
            className={cn(
              'w-10 h-10 rounded-lg text-sm font-semibold transition-all',
              isCurrent && 'ring-2 ring-primary ring-offset-2 ring-offset-background',
              showResults
                ? isCorrect
                  ? 'bg-success text-success-foreground'
                  : isWrong
                    ? 'bg-destructive text-destructive-foreground'
                    : 'bg-muted text-muted-foreground'
                : hasAnswer
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
            )}
          >
            {index + 1}
          </button>
        );
      })}
    </div>
  );
}
