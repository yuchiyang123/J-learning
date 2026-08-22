import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, RotateCcw, Trophy, PartyPopper } from 'lucide-react';
import { api, getUserId } from '../../api.js';
import { speak } from '../../speech.js';
import { seion, dakuon, handakuon } from '../../data/kana.js';
import { useLocale } from '../../i18n/LocaleContext.jsx';

const LEVELS = ['N5', 'N4', 'N3', 'N2', 'N1'];
const CATEGORIES = [
  { value: 'kana', key: 'cat_kana' },
  { value: 'vocab', key: 'cat_vocab' },
  { value: 'kanji', key: 'cat_kanji' },
];
const PAIR_COUNTS = [6, 8, 10];

const allKana = [...seion, ...dakuon, ...handakuon].flatMap((row) => row.cells.filter(Boolean));

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function bestKey(category, level, pairCount) {
  return `jp_memory_best_${category}_${level}_${pairCount}`;
}

// Higher-is-better ranking score derived from moves/time, since game_scores is
// ordered by MAX(score) across all games.
function scoreFor({ moves, time }) {
  return Math.max(1, 10000 - moves * 50 - time * 10);
}

export default function MemoryMatch() {
  const [category, setCategory] = useState('kana');
  const [level, setLevel] = useState('N5');
  const [pairCount, setPairCount] = useState(8);
  const [cards, setCards] = useState([]);
  const [selected, setSelected] = useState([]);
  const [busy, setBusy] = useState(false);
  const [moves, setMoves] = useState(0);
  const [startTime, setStartTime] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const [won, setWon] = useState(false);
  const [best, setBest] = useState(null);
  const [loading, setLoading] = useState(false);
  const { t, locale } = useLocale();

  async function newGame() {
    setLoading(true);
    setWon(false);
    setSelected([]);
    setMoves(0);
    setStartTime(null);
    setElapsed(0);

    let items = [];
    if (category === 'kana') {
      items = shuffle(allKana).slice(0, pairCount).map(([hira, , romaji]) => ({ front: hira, back: romaji }));
    } else if (category === 'vocab') {
      const words = await api.getWords(level);
      items = shuffle(words.filter((w) => w.meaning)).slice(0, pairCount).map((w) => ({
        front: w.kanji || w.kana,
        back: w.meaning,
      }));
    } else {
      const kanjiList = await api.getKanji(level);
      items = shuffle(kanjiList).slice(0, pairCount).map((k) => ({ front: k.character, back: k.meaning }));
    }

    const pairs = items.flatMap((item, i) => [
      { id: `${i}-front`, pairId: i, label: item.front, matched: false },
      { id: `${i}-back`, pairId: i, label: item.back, matched: false },
    ]);
    setCards(shuffle(pairs));

    const localBest = JSON.parse(localStorage.getItem(bestKey(category, level, pairCount)) || 'null');
    setBest(localBest);
    const mode = `${category}_${pairCount}`;
    api
      .getGameBest({ userId: getUserId(), game: 'memory', mode, level: category === 'kana' ? 'N5' : level })
      .then((remote) => {
        if (remote?.detail && (!localBest || remote.score > scoreFor(localBest))) {
          setBest(remote.detail);
          localStorage.setItem(bestKey(category, level, pairCount), JSON.stringify(remote.detail));
        }
      })
      .catch(() => {});

    setLoading(false);
  }

  useEffect(() => { newGame(); }, [category, level, pairCount, locale]);

  useEffect(() => {
    if (!startTime || won) return;
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - startTime) / 1000)), 1000);
    return () => clearInterval(id);
  }, [startTime, won]);

  const matchedCount = cards.filter((c) => c.matched).length;

  function flip(card) {
    if (busy || card.matched || selected.some((s) => s.id === card.id) || selected.length >= 2) return;
    if (!startTime) setStartTime(Date.now());
    if (category === 'kana' && !card.id.endsWith('-back')) speak(card.label);

    const next = [...selected, card];
    setSelected(next);

    if (next.length === 2) {
      setBusy(true);
      setMoves((m) => m + 1);
      const [a, b] = next;
      if (a.pairId === b.pairId) {
        setTimeout(() => {
          setCards((cs) => cs.map((c) => (c.pairId === a.pairId ? { ...c, matched: true } : c)));
          setSelected([]);
          setBusy(false);
        }, 350);
      } else {
        setTimeout(() => {
          setSelected([]);
          setBusy(false);
        }, 800);
      }
    }
  }

  useEffect(() => {
    if (cards.length > 0 && matchedCount === cards.length && !won) {
      setWon(true);
      const key = bestKey(category, level, pairCount);
      const prev = JSON.parse(localStorage.getItem(key) || 'null');
      const time = Math.floor((Date.now() - startTime) / 1000);
      const record = { moves, time };

      if (!prev || moves < prev.moves || (moves === prev.moves && time < prev.time)) {
        localStorage.setItem(key, JSON.stringify(record));
        setBest(record);
      }

      api
        .saveGameScore({
          userId: getUserId(),
          game: 'memory',
          mode: `${category}_${pairCount}`,
          level: category === 'kana' ? 'N5' : level,
          score: scoreFor(record),
          detail: record,
        })
        .catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchedCount, cards.length]);

  const gridCols = useMemo(() => (pairCount <= 6 ? 4 : pairCount <= 8 ? 4 : 5), [pairCount]);

  return (
    <div className="page">
      <Link to="/games" className="back-link"><ArrowLeft size={15} /> {t('btn_back_to_games')}</Link>
      <h1>{t('game_memory_title')}</h1>
      <p className="subtitle">{t('mm_subtitle')}</p>

      <div className="filter-row">
        <div className="filter-group">
          <span className="filter-label">{t('category_label')}</span>
          {CATEGORIES.map((c) => (
            <button key={c.value} className={c.value === category ? 'active' : ''} onClick={() => setCategory(c.value)}>
              {t(c.key)}
            </button>
          ))}
        </div>
        {category !== 'kana' && (
          <div className="filter-group">
            <span className="filter-label">{t('level_label')}</span>
            {LEVELS.map((l) => (
              <button key={l} className={l === level ? 'active' : ''} onClick={() => setLevel(l)}>{l}</button>
            ))}
          </div>
        )}
        <div className="filter-group">
          <span className="filter-label">{t('pair_count_label')}</span>
          {PAIR_COUNTS.map((n) => (
            <button key={n} className={n === pairCount ? 'active' : ''} onClick={() => setPairCount(n)}>{n}</button>
          ))}
        </div>
      </div>

      <div className="game-stat-row">
        <span>{t('moves_label')}：{moves}</span>
        <span>{t('time_label')}：{elapsed}s</span>
        {best && <span className="icon-row"><Trophy size={14} /> {t('best_label')}：{best.moves} {t('steps_unit')} / {best.time}s</span>}
        <button className="secondary-btn icon-btn" onClick={newGame}><RotateCcw size={14} /> {t('btn_restart')}</button>
      </div>

      {loading ? (
        <p>{t('loading')}</p>
      ) : (
        <div className="memory-grid" style={{ gridTemplateColumns: `repeat(${gridCols}, 1fr)` }}>
          {cards.map((card) => {
            const isFlipped = card.matched || selected.some((s) => s.id === card.id);
            return (
              <button
                key={card.id}
                className={`memory-card${isFlipped ? ' is-flipped' : ''}${card.matched ? ' is-matched' : ''}`}
                onClick={() => flip(card)}
              >
                <div className="memory-card-inner">
                  <div className="memory-card-face memory-card-back">?</div>
                  <div className="memory-card-face memory-card-front">{card.label}</div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {won && (
        <div className="game-win-banner icon-row">
          <PartyPopper size={18} />
          <span>
            {t('mm_complete', { moves, time: elapsed })}
            {best && best.moves === moves && best.time === elapsed && t('mm_new_record')}
          </span>
        </div>
      )}
    </div>
  );
}
