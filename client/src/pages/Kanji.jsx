import { useEffect, useState } from 'react';
import { X, Check } from 'lucide-react';
import { api } from '../api.js';
import { speak } from '../speech.js';
import { LevelPicker } from './Vocabulary.jsx';
import { useLocale } from '../i18n/LocaleContext.jsx';
import { KanjiGridSkeleton } from '../components/Skeleton.jsx';

export default function Kanji() {
  const [level, setLevel] = useState('N5');
  const [list, setList] = useState(null);
  const [marked, setMarked] = useState({});
  const { t, locale } = useLocale();

  useEffect(() => {
    setList(null);
    api.getKanji(level).then(setList);
    setMarked({});
  }, [level, locale]);

  async function mark(k, correct) {
    setMarked((m) => ({ ...m, [k.id]: correct ? 'good' : 'bad' }));
    // Silently no-op when logged out — marking still works locally in the UI,
    // it just isn't persisted without an account.
    await api.reviewProgress({ itemType: 'kanji', itemId: k.id, correct }).catch(() => {});
  }

  return (
    <div className="page">
      <h1>{t('kanji_title')}</h1>
      <LevelPicker level={level} onChange={setLevel} />

      {list === null && <KanjiGridSkeleton />}

      {list !== null && (
      <div className="kanji-grid">
        {list.map((k) => (
          <div className="kanji-card" key={k.id}>
            <div className="kanji-char" onClick={() => speak(k.kunyomi?.split('、')[0] || k.character)}>
              {k.character}
            </div>
            <div className="kanji-readings">
              <div><strong>{t('onyomi')}</strong> {k.onyomi || '—'}</div>
              <div><strong>{t('kunyomi')}</strong> {k.kunyomi || '—'}</div>
              <div><strong>{t('meaning')}</strong> {k.meaning}</div>
              <div className="muted">{t('stroke_count')} {k.stroke_count}</div>
            </div>
            <div className="kanji-mark">
              <button
                className={`kanji-mark-btn bad${marked[k.id] === 'bad' ? ' is-active' : ''}`}
                title={t('btn_dont_know')}
                onClick={() => mark(k, false)}
              >
                <X size={15} />
              </button>
              <button
                className={`kanji-mark-btn good${marked[k.id] === 'good' ? ' is-active' : ''}`}
                title={t('btn_remember')}
                onClick={() => mark(k, true)}
              >
                <Check size={15} />
              </button>
            </div>
          </div>
        ))}
        {list.length === 0 && <p>{t('no_data_level')}</p>}
      </div>
      )}
    </div>
  );
}
