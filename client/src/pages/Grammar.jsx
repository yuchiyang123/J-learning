import { useEffect, useState } from 'react';
import { Volume2 } from 'lucide-react';
import { api } from '../api.js';
import { speak } from '../speech.js';
import { LevelPicker } from './Vocabulary.jsx';
import { useLocale } from '../i18n/LocaleContext.jsx';
import { GrammarListSkeleton } from '../components/Skeleton.jsx';

export default function Grammar() {
  const [level, setLevel] = useState('N5');
  const [list, setList] = useState(null);
  const { t, locale } = useLocale();

  useEffect(() => {
    setList(null);
    api.getGrammar(level).then(setList);
  }, [level, locale]);

  return (
    <div className="page">
      <h1>{t('grammar_title')}</h1>
      <LevelPicker level={level} onChange={setLevel} />

      {list === null && <GrammarListSkeleton />}

      {list !== null && (
      <div className="grammar-list">
        {list.map((g) => (
          <div className="grammar-card" key={g.id}>
            <div className="grammar-pattern">{g.pattern}</div>
            <div className="grammar-meaning">{g.meaning}</div>
            <p className="grammar-explanation">{g.explanation}</p>
            {g.example_jp && (
              <div className="example">
                <div>
                  {g.example_jp}{' '}
                  <button className="tiny-btn" onClick={() => speak(g.example_jp)}><Volume2 size={14} /></button>
                </div>
                <div className="reading">{g.example_reading}</div>
                <div className="zh">{g.example_zh}</div>
              </div>
            )}
          </div>
        ))}
        {list.length === 0 && <p>{t('no_data_level')}</p>}
      </div>
      )}
    </div>
  );
}
