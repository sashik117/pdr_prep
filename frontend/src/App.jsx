import { lazy, Suspense } from 'react';
import { Toaster } from '@/components/ui/toaster';
import { QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter as Router, Navigate, Route, Routes } from 'react-router-dom';
import { queryClientInstance } from '@/lib/query-client';
import { AuthProvider } from '@/lib/AuthContext';
import PageNotFound from '@/lib/PageNotFound';
import AppLayout from '@/components/layout/AppLayout';
import LoginPrompt from '@/components/auth/LoginPrompt';
import ProtectedScreenFallback from '@/components/auth/ProtectedScreenFallback';
import { useProtectedScreen } from '@/lib/useProtectedScreen';

const Home = lazy(() => import('@/pages/Home'));
const TestSelection = lazy(() => import('@/pages/TestSelection'));
const SectionTests = lazy(() => import('@/pages/SectionTests'));
const SectionQuestionReview = lazy(() => import('@/pages/SectionQuestionReview'));
const TakeTest = lazy(() => import('@/pages/TakeTest'));
const Progress = lazy(() => import('@/pages/Progress'));
const Achievements = lazy(() => import('@/pages/Achievements'));
const Leaderboard = lazy(() => import('@/pages/Leaderboard'));
const Marathon = lazy(() => import('@/pages/Marathon'));
const SignTrainer = lazy(() => import('@/pages/SignTrainer'));
const MistakesReview = lazy(() => import('@/pages/MistakesReview'));
const Auth = lazy(() => import('@/pages/Auth'));
const DailyChallenge = lazy(() => import('@/pages/DailyChallenge'));
const Friends = lazy(() => import('@/pages/Friends'));
const Battle = lazy(() => import('@/pages/Battle'));
const Study = lazy(() => import('@/pages/Study'));
const StudyChapter = lazy(() => import('@/pages/StudyChapter'));
const ImportQuestions = lazy(() => import('@/pages/ImportQuestions'));
const Settings = lazy(() => import('@/pages/Settings'));
const UserProfile = lazy(() => import('@/pages/UserProfile'));
const Privacy = lazy(() => import('@/pages/Privacy'));
const Terms = lazy(() => import('@/pages/Terms'));
const Analytics = lazy(() => import('@/pages/Analytics'));
const Support = lazy(() => import('@/pages/Support'));
const Pricing = lazy(() => import('@/pages/Pricing'));
const Tickets = lazy(() => import('@/pages/Tickets'));
const TicketDetail = lazy(() => import('@/pages/TicketDetail'));
const SavedQuestions = lazy(() => import('@/pages/SavedQuestions'));
const TheoryTopicPage = lazy(() => import('@/features/theory/TheoryTopicPage'));
const AdminApp = lazy(() => import('@admin/AdminApp'));

function RouteFallback() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4 text-sm text-slate-500 dark:text-slate-400">
      Завантажуємо сторінку...
    </div>
  );
}

function AuthOnlyRoute({ children, title = 'Потрібен профіль', description = 'Увійдіть або зареєструйтеся, щоб користуватися цією можливістю.' }) {
  const { isCheckingAccess, isTemporaryAuthFailure, canAccess, checkUserAuth } = useProtectedScreen();

  if (isCheckingAccess) return <ProtectedScreenFallback loading />;
  if (isTemporaryAuthFailure) return <ProtectedScreenFallback temporary onRetry={checkUserAuth} />;
  if (!canAccess) return <LoginPrompt title={title} description={description} />;

  return children;
}

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <Suspense fallback={<RouteFallback />}>
            <Routes>
              <Route path="/auth" element={<Auth />} />
              <Route path="/login" element={<Navigate to="/auth" replace />} />
              <Route path="/admin/*" element={<AdminApp />} />

              <Route element={<AppLayout />}>
                <Route path="/" element={<Home />} />
                <Route path="/tests" element={<TestSelection />} />
                <Route path="/section-tests" element={<SectionTests />} />
                <Route path="/section-tests/:sectionId/questions" element={<SectionQuestionReview />} />
                <Route path="/test" element={<TakeTest />} />
                <Route path="/daily" element={<AuthOnlyRoute title="Виклик дня доступний після входу"><DailyChallenge /></AuthOnlyRoute>} />
                <Route path="/mistakes" element={<AuthOnlyRoute title="Робота над помилками доступна після входу" description="Увійдіть, щоб ми могли знати Ваші помилки й підбирати питання саме для повторення."><MistakesReview /></AuthOnlyRoute>} />
                <Route path="/signs" element={<SignTrainer />} />
                <Route path="/marathon" element={<AuthOnlyRoute title="Марафон доступний після входу" description="Марафон зберігає результат, серію та місце в рейтингу, тому потрібен профіль."><Marathon /></AuthOnlyRoute>} />
                <Route path="/leaderboard" element={<AuthOnlyRoute title="Рейтинг доступний після входу" description="Рейтинг пов’язаний із результатами користувачів, тому відкривається після авторизації."><Leaderboard /></AuthOnlyRoute>} />
                <Route path="/tickets" element={<Tickets />} />
                <Route path="/tickets/:ticketNumber" element={<TicketDetail />} />
                <Route path="/saved-questions" element={<AuthOnlyRoute title="Збережені запитання доступні після входу" description="Увійдіть, щоб відкладати питання й повертатися до них у будь-який момент."><SavedQuestions /></AuthOnlyRoute>} />
                <Route path="/pricing" element={<Pricing />} />
                <Route path="/friends" element={<AuthOnlyRoute title="Друзі доступні після входу" description="Список друзів, заявки й повідомлення працюють тільки для профілю."><Friends /></AuthOnlyRoute>} />
                <Route path="/battle" element={<AuthOnlyRoute title="Батли доступні після входу" description="Батли потребують профілю, друзів і збереження результатів у базі."><Battle /></AuthOnlyRoute>} />
                <Route path="/study" element={<Study />} />
                <Route path="/academy" element={<Navigate to="/study" replace />} />
                <Route path="/lectures" element={<Navigate to="/study/video-lectures" replace />} />
                <Route path="/study/academy" element={<Navigate to="/study" replace />} />
                <Route path="/study/difficult-questions" element={<Navigate to="/tests?mode=top" replace />} />
                <Route path="/study/:topicKey" element={<TheoryTopicPage />} />
                <Route path="/study/:topicKey/:entryId" element={<StudyChapter />} />
                <Route path="/study/section/:entryId" element={<StudyChapter />} />
                <Route path="/library" element={<Navigate to="/study/library" replace />} />
                <Route path="/cabinet" element={<AuthOnlyRoute title="Кабінет доступний після входу"><Progress view="dashboard" /></AuthOnlyRoute>} />
                <Route path="/progress" element={<Navigate to="/cabinet" replace />} />
                <Route path="/analytics" element={<AuthOnlyRoute title="Аналітика доступна після входу" description="Аналітика будується з Ваших результатів, тому потрібен профіль."><Analytics /></AuthOnlyRoute>} />
                <Route path="/profile" element={<AuthOnlyRoute title="Профіль доступний після входу"><Progress view="profile" /></AuthOnlyRoute>} />
                <Route path="/u/:username" element={<AuthOnlyRoute title="Профіль користувача доступний після входу" description="Увійдіть, щоб переглядати профілі, рейтинг і статистику інших користувачів."><UserProfile /></AuthOnlyRoute>} />
                <Route path="/users/:userId" element={<AuthOnlyRoute title="Профіль користувача доступний після входу" description="Увійдіть, щоб переглядати профілі, рейтинг і статистику інших користувачів."><UserProfile /></AuthOnlyRoute>} />
                <Route path="/privacy" element={<Privacy />} />
                <Route path="/terms" element={<Terms />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/support" element={<AuthOnlyRoute title="Підтримка доступна після входу" description="Чат підтримки прив’язаний до профілю, щоб ми могли відповідати саме Вам."><Support /></AuthOnlyRoute>} />
                <Route path="/achievements" element={<AuthOnlyRoute title="Досягнення доступні після входу" description="Досягнення рахуються за Вашим прогресом, тому потрібен профіль."><Achievements /></AuthOnlyRoute>} />
                <Route path="/import" element={<AuthOnlyRoute title="Імпорт доступний тільки після входу"><ImportQuestions /></AuthOnlyRoute>} />
              </Route>

              <Route path="*" element={<PageNotFound />} />
            </Routes>
          </Suspense>
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  );
}

export default App;
