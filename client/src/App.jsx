import { Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Kana from './pages/Kana.jsx';
import Vocabulary from './pages/Vocabulary.jsx';
import Kanji from './pages/Kanji.jsx';
import Grammar from './pages/Grammar.jsx';
import Listening from './pages/Listening.jsx';
import Speaking from './pages/Speaking.jsx';
import Quiz from './pages/Quiz.jsx';
import JlptMock from './pages/JlptMock.jsx';
import Progress from './pages/Progress.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import GameHub from './pages/games/GameHub.jsx';
import MemoryMatch from './pages/games/MemoryMatch.jsx';
import BlitzChallenge from './pages/games/BlitzChallenge.jsx';
import FallingWords from './pages/games/FallingWords.jsx';

export default function App() {
  return (
    <div className="app-shell">
      <Navbar />
      <main className="app-main">
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
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/games" element={<GameHub />} />
          <Route path="/games/memory" element={<MemoryMatch />} />
          <Route path="/games/blitz" element={<BlitzChallenge />} />
          <Route path="/games/falling" element={<FallingWords />} />
        </Routes>
      </main>
    </div>
  );
}
