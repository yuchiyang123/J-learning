import { Suspense, lazy } from 'react';
import { Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar.jsx';

// Every page is loaded lazily so the initial bundle only ships the shell +
// whichever page the visitor actually landed on — before this, App.jsx
// eagerly imported all ~20 pages (games, write-practice, etc.) into one
// 765KB chunk, so e.g. the 121KB kana stroke-order data pulled in by
// Kana.jsx/Kanji.jsx (via WritingPractice/KanaWriteQuiz/KanjiWriteQuiz)
// downloaded even for someone just viewing the dashboard.
const Dashboard = lazy(() => import('./pages/Dashboard.jsx'));
const Kana = lazy(() => import('./pages/Kana.jsx'));
const Vocabulary = lazy(() => import('./pages/Vocabulary.jsx'));
const Kanji = lazy(() => import('./pages/Kanji.jsx'));
const Grammar = lazy(() => import('./pages/Grammar.jsx'));
const Listening = lazy(() => import('./pages/Listening.jsx'));
const Speaking = lazy(() => import('./pages/Speaking.jsx'));
const Quiz = lazy(() => import('./pages/Quiz.jsx'));
const JlptMock = lazy(() => import('./pages/JlptMock.jsx'));
const Progress = lazy(() => import('./pages/Progress.jsx'));
const Settings = lazy(() => import('./pages/Settings.jsx'));
const Login = lazy(() => import('./pages/Login.jsx'));
const Register = lazy(() => import('./pages/Register.jsx'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword.jsx'));
const ResetPasswordConfirm = lazy(() => import('./pages/ResetPasswordConfirm.jsx'));
const GameHub = lazy(() => import('./pages/games/GameHub.jsx'));
const MemoryMatch = lazy(() => import('./pages/games/MemoryMatch.jsx'));
const BlitzChallenge = lazy(() => import('./pages/games/BlitzChallenge.jsx'));
const FallingWords = lazy(() => import('./pages/games/FallingWords.jsx'));
const NotFound = lazy(() => import('./pages/NotFound.jsx'));

export default function App() {
  return (
    <div className="app-shell">
      <Navbar />
      <main className="app-main">
        <Suspense fallback={null}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/kana" element={<Kana />} />
            <Route path="/vocabulary" element={<Vocabulary />} />
            <Route path="/kanji" element={<Kanji />} />
            <Route path="/grammar" element={<Grammar />} />
            <Route path="/listening" element={<Listening />} />
            <Route path="/speaking" element={<Speaking />} />
            <Route path="/quiz" element={<Quiz />} />
            <Route path="/jlpt" element={<JlptMock />} />
            <Route path="/progress" element={<Progress />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPasswordConfirm />} />
            <Route path="/games" element={<GameHub />} />
            <Route path="/games/memory" element={<MemoryMatch />} />
            <Route path="/games/blitz" element={<BlitzChallenge />} />
            <Route path="/games/falling" element={<FallingWords />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </main>
    </div>
  );
}
