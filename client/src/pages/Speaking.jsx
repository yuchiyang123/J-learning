import { useEffect, useRef, useState, useCallback } from 'react';
import { Volume2, Mic, ArrowRight, Info } from 'lucide-react';
import { api, getUserId } from '../api.js';
import { speak, isRecognitionSupported, createRecognizer, similarityScore } from '../speech.js';
import { isVisualizerSupported, startVisualizer } from '../audioVisualizer.js';
import { LevelPicker } from './Vocabulary.jsx';
import { useLocale } from '../i18n/LocaleContext.jsx';
import { SpeakingSkeleton } from '../components/Skeleton.jsx';

export default function Speaking() {
  const [level, setLevel] = useState('N5');
  const [sentences, setSentences] = useState([]);
  const [loading, setLoading] = useState(true);
  const [index, setIndex] = useState(0);
  const [listening, setListening] = useState(false);
  const [recognized, setRecognized] = useState('');
  const [score, setScore] = useState(null);
  const [error, setError] = useState('');
  const [history, setHistory] = useState([]);
  const supported = isRecognitionSupported();
  const visualizerSupported = isVisualizerSupported();
  const canvasRef = useRef(null);
  const stopVisualizerRef = useRef(null);
  const { t, locale } = useLocale();

  useEffect(() => () => { stopVisualizerRef.current?.(); }, []);

  useEffect(() => {
    setLoading(true);
    api.getWords(level).then((words) => {
      const withExamples = words.filter((w) => w.example_jp);
      setSentences(withExamples);
      setIndex(0);
      setRecognized('');
      setScore(null);
    }).finally(() => setLoading(false));
  }, [level, locale]);

  useEffect(() => {
    api.getSpeakingHistory(getUserId()).then(setHistory);
  }, []);

  const current = sentences[index];

  const handleRecord = useCallback(async () => {
    if (!supported || !current) return;
    setError('');
    setRecognized('');
    setScore(null);

    if (visualizerSupported && canvasRef.current) {
      try {
        stopVisualizerRef.current = await startVisualizer(canvasRef.current);
      } catch {
        // mic access for the visualizer was denied/unavailable; recognition can still proceed
      }
    }

    const stopViz = async () => {
      if (stopVisualizerRef.current) {
        const stop = stopVisualizerRef.current;
        stopVisualizerRef.current = null;
        await stop();
      }
    };

    const recognizer = createRecognizer({ lang: 'ja-JP' });
    if (!recognizer) {
      stopViz();
      return;
    }

    recognizer.onstart = () => setListening(true);
    recognizer.onend = () => { setListening(false); stopViz(); };
    recognizer.onerror = (e) => {
      setListening(false);
      stopViz();
      setError(`${t('speaking_recognition_failed')}：${e.error || t('speaking_unknown_error')}`);
    };
    recognizer.onresult = async (e) => {
      const text = e.results[0][0].transcript;
      setRecognized(text);
      const s = similarityScore(current.example_jp, text);
      setScore(s);
      await api.logSpeaking({ userId: getUserId(), targetText: current.example_jp, recognizedText: text, score: s });
      api.getSpeakingHistory(getUserId()).then(setHistory);
    };
    recognizer.start();
  }, [supported, current, visualizerSupported, t]);

  return (
    <div className="page">
      <h1>{t('speaking_title')}</h1>
      <p className="subtitle">{t('speaking_subtitle')}</p>
      <LevelPicker level={level} onChange={setLevel} />

      {!supported && (
        <p className="warning">{t('speaking_no_recognition')}</p>
      )}

      {loading && <SpeakingSkeleton />}

      {!loading && (current ? (
        <div className="speaking-card">
          <div className="speaking-target">{current.example_jp}</div>
          <div className="speaking-reading">{current.example_reading}</div>
          <div className="speaking-zh">{current.example_zh}</div>

          <div className="speaking-controls">
            <button className="icon-btn" onClick={() => speak(current.example_jp)}>
              <Volume2 size={16} /> {t('btn_play_example')}
            </button>
            <button className="icon-btn" disabled={!supported || listening} onClick={handleRecord}>
              <Mic size={16} className={listening ? 'pulse' : ''} /> {listening ? t('btn_recording') : t('btn_start_recording')}
            </button>
            <button className="icon-btn" onClick={() => setIndex((i) => (i + 1) % sentences.length)}>
              {t('btn_next_word')} <ArrowRight size={16} />
            </button>
          </div>

          <div className={`voice-visualizer${listening ? ' is-live' : ''}`}>
            <canvas ref={canvasRef} width={640} height={72} />
            {!listening && <span className="voice-visualizer-placeholder">{t('speaking_visualizer_placeholder')}</span>}
          </div>

          <p className="accuracy-note icon-row">
            <Info size={14} />
            <span>{t('speaking_accuracy_note')}</span>
          </p>

          {error && <p className="warning">{error}</p>}

          {recognized && (
            <div className="speaking-result">
              <div>{t('speaking_recognized_result')}：{recognized}</div>
              <div className={`score-badge ${scoreClass(score)}`}>{t('speaking_score_label')}：{score} {t('speaking_score_unit')}</div>
            </div>
          )}
        </div>
      ) : (
        <p>{t('speaking_no_data')}</p>
      ))}

      {history.length > 0 && (
        <div className="speaking-history">
          <h2>{t('speaking_recent_history')}</h2>
          <table>
            <thead>
              <tr><th>{t('speaking_target_col')}</th><th>{t('speaking_result_col')}</th><th>{t('score')}</th></tr>
            </thead>
            <tbody>
              {history.slice(0, 10).map((h) => (
                <tr key={h.id}>
                  <td>{h.target_text}</td>
                  <td>{h.recognized_text}</td>
                  <td>{h.score}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function scoreClass(score) {
  if (score == null) return '';
  if (score >= 80) return 'good';
  if (score >= 50) return 'mid';
  return 'bad';
}
