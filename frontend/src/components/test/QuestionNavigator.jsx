import { cn } from '@/lib/utils';

/** @param {import('@/types/questions').QuestionNavigatorProps} props */
export default function QuestionNavigator({ questions, answers, currentIndex, onNavigate, showResults = false }) {
  return (
    <div className="flex flex-wrap gap-2">
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
              'h-10 w-10 rounded-lg text-sm font-medium transition-all duration-200',
              isCurrent && 'ring-2 ring-primary-500 ring-offset-2 ring-offset-background',
              isCorrect
                ? 'bg-success-500 text-white'
                : isWrong
                  ? 'bg-error-500 text-white'
                  : hasAnswer
                    ? 'bg-primary-500 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
            )}
          >
            {index + 1}
          </button>
        );
      })}
    </div>
  );
}
