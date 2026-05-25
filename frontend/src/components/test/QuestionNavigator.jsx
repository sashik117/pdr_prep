import { cn } from '@/lib/utils';

/** @param {import('@/types/questions').QuestionNavigatorProps} props */
export default function QuestionNavigator({ questions, answers, currentIndex, onNavigate, showResults = false }) {
  return (
    <div className="grid grid-cols-5 gap-2 min-[420px]:grid-cols-7 sm:flex sm:flex-wrap">
      {questions.map((question, index) => {
        const hasAnswer = answers[question.id] !== undefined;
        const isCurrent = index === currentIndex;
        const isCorrect = showResults && hasAnswer && answers[question.id] === question.correct_answer;
        const isWrong = showResults && hasAnswer && answers[question.id] !== question.correct_answer;

        return (
          <button
            key={question.id}
            onClick={() => onNavigate(index)}
            className={cn(
              'h-10 w-full rounded-lg text-sm font-medium transition-colors sm:w-10',
              isCurrent && 'ring-2 ring-primary ring-offset-2 ring-offset-background',
              isCorrect
                ? 'bg-success text-success-foreground'
                : isWrong
                  ? 'bg-destructive text-destructive-foreground'
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
