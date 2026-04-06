import { cn } from '@/lib/utils';

export default function QuestionNavigator({ questions, answers, currentIndex, onNavigate, showResults = false }) {
  return (
    <div className="flex flex-wrap gap-2">
      {questions.map((q, i) => {
        const hasAnswer = answers[q.id] !== undefined;
        const isCurrent = i === currentIndex;
        const isCorrect = showResults && answers[q.id] === q.correct_answer;
        const isWrong = showResults && hasAnswer && answers[q.id] !== q.correct_answer;

        return (
          <button
            key={q.id}
            onClick={() => onNavigate(i)}
            className={cn(
              "w-10 h-10 rounded-lg text-sm font-semibold transition-all",
              isCurrent && "ring-2 ring-primary ring-offset-2 ring-offset-background",
              showResults
                ? isCorrect
                  ? "bg-success text-success-foreground"
                  : isWrong
                  ? "bg-destructive text-destructive-foreground"
                  : "bg-muted text-muted-foreground"
                : hasAnswer
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            )}
          >
            {i + 1}
          </button>
        );
      })}
    </div>
  );
}