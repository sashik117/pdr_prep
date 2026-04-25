import { Toaster } from '@/components/ui/toaster';
import { QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter as Router, Navigate, Route, Routes } from 'react-router-dom';
import { queryClientInstance } from '@/lib/query-client';
import { AuthProvider } from '@/lib/AuthContext';
import PageNotFound from '@/lib/PageNotFound';
import AppLayout from '@/components/layout/AppLayout';
import Home from '@/pages/Home';
import TestSelection from '@/pages/TestSelection';
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
import ImportQuestions from '@/pages/ImportQuestions';
import Settings from '@/pages/Settings';
import UserProfile from '@/pages/UserProfile';
import Privacy from '@/pages/Privacy';
import Analytics from '@/pages/Analytics';
import Support from '@/pages/Support';

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/login" element={<Navigate to="/auth" replace />} />

            <Route element={<AppLayout />}>
              <Route path="/" element={<Home />} />
              <Route path="/tests" element={<TestSelection />} />
              <Route path="/test" element={<TakeTest />} />
              <Route path="/daily" element={<DailyChallenge />} />
              <Route path="/mistakes" element={<MistakesReview />} />
              <Route path="/signs" element={<SignTrainer />} />
              <Route path="/marathon" element={<Marathon />} />
              <Route path="/leaderboard" element={<Leaderboard />} />
              <Route path="/friends" element={<Friends />} />
              <Route path="/battle" element={<Battle />} />
              <Route path="/study" element={<Study />} />
              <Route path="/library" element={<Navigate to="/study" replace />} />
              <Route path="/cabinet" element={<Progress />} />
              <Route path="/progress" element={<Navigate to="/cabinet" replace />} />
              <Route path="/analytics" element={<Analytics />} />
              <Route path="/profile" element={<Navigate to="/cabinet" replace />} />
              <Route path="/u/:username" element={<UserProfile />} />
              <Route path="/users/:userId" element={<UserProfile />} />
              <Route path="/privacy" element={<Privacy />} />
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
