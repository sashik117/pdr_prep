import { Toaster } from '@/components/ui/toaster';
import { QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter as Router, Navigate, Route, Routes } from 'react-router-dom';
import { queryClientInstance } from '@/lib/query-client';
import { AuthProvider } from '@/lib/AuthContext';
import PageNotFound from '@/lib/PageNotFound';
import AppLayout from '@/components/layout/AppLayout';
import Home from '@/pages/Home';
import TestSelection from '@/pages/TestSelection';
import SectionTests from '@/pages/SectionTests';
import TakeTest from '@/pages/TakeTest';
import Progress from '@/pages/Progress';
import Achievements from '@/pages/Achievements';
import Leaderboard from '@/pages/Leaderboard';
import Marathon from '@/pages/Marathon';
import SignTrainer from '@/pages/SignTrainer';
import MistakesReview from '@/pages/MistakesReview';
import Auth from '@/pages/Auth';
import DailyChallenge from '@/pages/DailyChallenge';
import Friends from '@/pages/Friends';
import Battle from '@/pages/Battle';
import Study from '@/pages/Study';
import StudyChapter from '@/pages/StudyChapter';
import ImportQuestions from '@/pages/ImportQuestions';
import Settings from '@/pages/Settings';
import UserProfile from '@/pages/UserProfile';
import Privacy from '@/pages/Privacy';
import Terms from '@/pages/Terms';
import Analytics from '@/pages/Analytics';
import Support from '@/pages/Support';
import Pricing from '@/pages/Pricing';
import Tickets from '@/pages/Tickets';
import TicketDetail from '@/pages/TicketDetail';
import SavedQuestions from '@/pages/SavedQuestions';
import TheoryTopicPage from '@/features/theory/TheoryTopicPage';
import AdminApp from '@/features/admin/AdminApp';

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/login" element={<Navigate to="/auth" replace />} />
            <Route path="/admin/*" element={<AdminApp />} />

            <Route element={<AppLayout />}>
              <Route path="/" element={<Home />} />
              <Route path="/tests" element={<TestSelection />} />
              <Route path="/section-tests" element={<SectionTests />} />
              <Route path="/test" element={<TakeTest />} />
              <Route path="/daily" element={<DailyChallenge />} />
              <Route path="/mistakes" element={<MistakesReview />} />
              <Route path="/signs" element={<SignTrainer />} />
              <Route path="/marathon" element={<Marathon />} />
              <Route path="/leaderboard" element={<Leaderboard />} />
              <Route path="/tickets" element={<Tickets />} />
              <Route path="/tickets/:ticketNumber" element={<TicketDetail />} />
              <Route path="/saved-questions" element={<SavedQuestions />} />
              <Route path="/pricing" element={<Pricing />} />
              <Route path="/friends" element={<Friends />} />
              <Route path="/battle" element={<Battle />} />
              <Route path="/study" element={<Study />} />
              <Route path="/academy" element={<Navigate to="/study" replace />} />
              <Route path="/lectures" element={<Navigate to="/study/video-lectures" replace />} />
              <Route path="/study/academy" element={<Navigate to="/study" replace />} />
              <Route path="/study/difficult-questions" element={<Navigate to="/tests?mode=top" replace />} />
              <Route path="/study/:topicKey" element={<TheoryTopicPage />} />
              <Route path="/study/:topicKey/:entryId" element={<StudyChapter />} />
              <Route path="/study/section/:entryId" element={<StudyChapter />} />
              <Route path="/library" element={<Navigate to="/study/library" replace />} />
              <Route path="/cabinet" element={<Progress view="dashboard" />} />
              <Route path="/progress" element={<Navigate to="/cabinet" replace />} />
              <Route path="/analytics" element={<Analytics />} />
              <Route path="/profile" element={<Progress view="profile" />} />
              <Route path="/u/:username" element={<UserProfile />} />
              <Route path="/users/:userId" element={<UserProfile />} />
              <Route path="/privacy" element={<Privacy />} />
              <Route path="/terms" element={<Terms />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/support" element={<Support />} />
              <Route path="/achievements" element={<Achievements />} />
              <Route path="/import" element={<ImportQuestions />} />
            </Route>

            <Route path="*" element={<PageNotFound />} />
          </Routes>
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  );
}

export default App;
