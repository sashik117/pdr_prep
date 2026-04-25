export type UserProfile = {
  id?: number | string;
  name?: string | null;
  surname?: string | null;
  username?: string | null;
  nickname?: string | null;
  full_name?: string | null;
  email?: string | null;
  avatar_url?: string | null;
  avatar_version?: number | null;
  bio?: string | null;
  active_frame?: string | null;
  streak_days?: number;
  marathon_best?: number;
  total_tests?: number;
  total_correct?: number;
  total_answers?: number;
};

export type AuthError = {
  type: string;
  message: string;
} | null;

export type AuthContextValue = {
  user: UserProfile | null;
  isAuthenticated: boolean;
  isLoadingAuth: boolean;
  authChecked: boolean;
  authError: AuthError;
  login: (token: string, currentUser: UserProfile, rememberMe?: boolean) => void;
  logout: () => void;
  navigateToLogin: (redirectTo?: string) => void;
  navigateToRegister: (redirectTo?: string) => void;
  checkUserAuth: () => Promise<UserProfile | null>;
};

export type TestResult = {
  id?: number | string;
  mode?: string | null;
  correct?: number;
  total?: number;
  created_at?: string;
  score_percent?: number;
};

export type SectionStats = {
  section?: string | number | null;
  section_name?: string | null;
  correct?: number;
  total?: number;
};

export type StatsResponse = {
  total_tests?: number;
  total_correct?: number;
  total_answers?: number;
  total_questions_answered?: number;
  streak_days?: number;
  marathon_best?: number;
  difficult_question_ids?: Array<number | string>;
  recent_tests?: TestResult[];
  by_section?: SectionStats[];
  achievements?: Array<{ achievement_id: string }>;
};

export type AchievementTier = 1 | 2 | 3 | 4;

export type AchievementDefinition = {
  id: string;
  tier: AchievementTier;
  category: string;
  name: string;
  desc: string;
  frame?: string | null;
  check: (progress: StatsResponse, results?: TestResult[]) => boolean;
};

export type AchievementStatus = {
  id: string;
  name: string;
  description: string;
  category: string;
  tier: AchievementTier;
  earned: boolean;
};

export type LeaderboardRow = {
  id: number | string;
  name?: string | null;
  surname?: string | null;
  username?: string | null;
  nickname?: string | null;
  full_name?: string | null;
  email?: string | null;
  avatar_url?: string | null;
  streak_days?: number;
  total_answers?: number;
  total_correct?: number;
  total_tests?: number;
  marathon_best?: number;
};
