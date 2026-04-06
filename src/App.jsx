import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import AppLayout from '@/components/layout/AppLayout';
import Home from '@/pages/Home';
import TestSelection from '@/pages/TestSelection';
import TakeTest from '@/pages/TakeTest';
import Progress from '@/pages/Progress';
import Achievements from '@/pages/Achievements';
import Profile from '@/pages/Profile';
import ImportQuestions from '@/pages/ImportQuestions';
import Leaderboard from '@/pages/Leaderboard';
import Marathon from '@/pages/Marathon';
import SignTrainer from '@/pages/SignTrainer';
import MistakesReview from '@/pages/MistakesReview';
import Login from '@/pages/Login';

function App() {
  return (
    <QueryClientProvider client={queryClientInstance}>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<AppLayout />}>
            <Route path="/" element={<Home />} />
            <Route path="/tests" element={<TestSelection />} />
            <Route path="/test" element={<TakeTest />} />
            <Route path="/progress" element={<Progress />} />
            <Route path="/achievements" element={<Achievements />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/import" element={<ImportQuestions />} />
            <Route path="/leaderboard" element={<Leaderboard />} />
            <Route path="/marathon" element={<Marathon />} />
            <Route path="/signs" element={<SignTrainer />} />
            <Route path="/mistakes" element={<MistakesReview />} />
          </Route>
          <Route path="*" element={<PageNotFound />} />
        </Routes>
      </Router>
      <Toaster />
    </QueryClientProvider>
  )
}

export default App