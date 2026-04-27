export type QuestionOption = {
  label: string;
  text: string;
};

export type QuestionViewModel = {
  id: number | string;
  text?: string;
  question_text?: string;
  options: QuestionOption[];
  correct_answer: string;
  explanation?: string;
  image_url?: string | null;
  category?: string;
  topic?: string;
  section?: string | number;
  difficulty?: string;
};

export type FetchQuestionsParams = {
  section?: string | number;
  category?: string;
  topic?: string;
  ids?: Array<string | number>;
  limit?: number;
  offset?: number;
  search?: string;
};

export type FetchQuestionsResponse = {
  total?: number;
  items: unknown[];
};

export type QuestionCardProps = {
  question: QuestionViewModel;
  index?: number;
  totalQuestions?: number;
  selectedAnswer?: string | null;
  onSelectAnswer: (label: string) => void;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
  isAuthenticated?: boolean;
  onAnalyzeSituation?: ((question: QuestionViewModel) => void) | null;
};

export type QuestionNavigatorProps = {
  questions: QuestionViewModel[];
  answers: Record<string | number, string | undefined>;
  currentIndex: number;
  onNavigate: (index: number) => void;
  showResults?: boolean;
};

export type SituationAnalysisModalProps = {
  question?: QuestionViewModel | null;
  onClose: () => void;
  revealAnswer?: boolean;
};
