import { useCallback, useEffect, useRef, useState } from 'react';
import { makeUtterance } from '../../speech.js';

// Follow-along reading for the reading page: the passage is spoken one
// sentence at a time and the phrase being read is highlighted, so the eye
// can follow the voice.
//
// A passage is split into sentences, and sentences into phrases (the
// paper's 分かち書き spaces; a table row is one sentence, its cells the
// phrases). Each sentence is its own utterance, which keeps the intonation
// natural and also dodges Chrome cutting long utterances off. Inside a
// sentence the highlight follows the voice's word-boundary events when the
// voice sends them; voices that don't (most network voices) get an
// estimate from the elapsed time instead.

// Splits on spaces that aren't inside an underlined 〈…〉 part, and after
// sentence-ending punctuation (the paper puts no space there:
// 「くれます。〈その とき〉」), keeping a closing quote with its sentence.
export function splitPhrases(str) {
  const out = [];
  let cur = '';
  let depth = 0;
  const chars = [...str];
  chars.forEach((ch, i) => {
    if (ch === '〈') depth++;
    if (ch === '〉') depth = Math.max(0, depth - 1);
    if (ch === ' ' && depth === 0) {
      if (cur) out.push(cur);
      cur = '';
      return;
    }
    cur += ch;
    const ends = /[。！？」』]/.test(ch) && !/[」』）)]/.test(chars[i + 1] || '');
    if (ends && depth === 0 && /[。！？]/.test(cur.replace(/[」』]+$/, '').slice(-1)) && chars[i + 1] && chars[i + 1] !== ' ') {
      out.push(cur);
      cur = '';
    }
  });
  if (cur) out.push(cur);
  return out;
}

// What the voice says for a phrase: no markup, no spaces.
const spokenOf = (text) => text.replace(/[〈〉\s]/g, '');

const SENTENCE_END = /[。！？]$/;

// text -> { blocks, sentences }
//   blocks: [{ type: 'line', sentences: [sentenceId] } | { type: 'table', rows: [sentenceId] }]
//   sentences: [{ id, phrases: [{ id, text }], spoken, header? }]
export function buildModel(text) {
  const sentences = [];
  const blocks = [];
  let phraseId = 0;
  const addSentence = (phraseTexts, extra = {}) => {
    const phrases = phraseTexts.map((t) => ({ id: phraseId++, text: t }));
    const id = sentences.length;
    const spoken = phrases.map((p) => spokenOf(p.text)).join(extra.table ? '、' : '');
    sentences.push({ id, phrases, spoken, ...extra });
    return id;
  };
  for (const line of text.split('\n')) {
    if (line.startsWith('|')) {
      const cells = line.split('|').slice(1, -1).map((c) => c.trim());
      let table = blocks[blocks.length - 1];
      if (table?.type !== 'table') {
        table = { type: 'table', rows: [] };
        blocks.push(table);
      }
      table.rows.push(addSentence(cells, { table: true, header: table.rows.length === 0 }));
      continue;
    }
    const block = { type: 'line', sentences: [] };
    let pending = [];
    for (const phrase of splitPhrases(line)) {
      pending.push(phrase);
      if (SENTENCE_END.test(phrase.replace(/[」』〉]+$/, ''))) {
        block.sentences.push(addSentence(pending));
        pending = [];
      }
    }
    if (pending.length) block.sentences.push(addSentence(pending));
    blocks.push(block);
  }
  return { blocks, sentences };
}

// Rough speaking time of a stretch of text: kanji carry about two morae.
const weight = (s) => [...s.replace(/[〈〉、。！？「」（）()\s]/g, '')].reduce((n, c) => n + (/[㐀-鿿]/.test(c) ? 1.8 : 1), 0);
const MORAE_PER_SECOND = 7;

export const RATES = [0.6, 0.8, 1];

// -> { playing, active: { sentence, phrase } | null, failed, start(fromSentence), stop() }
// `failed`: the browser's voice ended a sentence without ever starting it
// (no voice available, or it stopped responding) — reading stops there.
// `pause`: after each sentence, wait about as long as it took to say it,
// so the learner can repeat it (shadowing).
export function useReadAloud(sentences, { rate = 0.8, pause = false } = {}) {
  const [playing, setPlaying] = useState(false);
  const [active, setActive] = useState(null);
  const [failed, setFailed] = useState(false);
  const run = useRef(0); // bumping it abandons whatever is in flight
  const timers = useRef([]);

  const clearTimers = () => {
    // clearTimeout also clears intervals (they share one id pool).
    for (const t of timers.current) clearTimeout(t);
    timers.current = [];
  };

  const stop = useCallback(() => {
    run.current++;
    clearTimers();
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    setPlaying(false);
    setActive(null);
  }, []);

  const start = useCallback((from = 0) => {
    if (!('speechSynthesis' in window)) return;
    stop();
    const myRun = ++run.current;
    setFailed(false);
    setPlaying(true);

    const sayFrom = (si) => {
      if (run.current !== myRun) return;
      const s = sentences[si];
      if (!s) { setPlaying(false); setActive(null); return; }
      // Character offset of each phrase in the spoken string.
      const offsets = [];
      let at = 0;
      for (const p of s.phrases) {
        offsets.push(at);
        at += spokenOf(p.text).length + (s.table ? 1 : 0);
      }
      const total = s.phrases.reduce((n, p) => n + weight(p.text), 0) || 1;
      let gotBoundary = false;
      let startedAt = null;
      setActive({ sentence: s.id, phrase: s.phrases[0]?.id ?? null });

      const utter = makeUtterance(s.spoken, { rate });
      utter.onstart = () => {
        startedAt = performance.now();
        const tick = setInterval(() => {
          if (gotBoundary || run.current !== myRun) return;
          // No boundary events from this voice: place the highlight by time.
          const spokenUnits = ((performance.now() - startedAt) / 1000) * MORAE_PER_SECOND * rate;
          let acc = 0;
          let idx = 0;
          for (; idx < s.phrases.length - 1; idx++) {
            acc += weight(s.phrases[idx].text);
            if (acc > spokenUnits) break;
          }
          setActive({ sentence: s.id, phrase: s.phrases[Math.min(idx, s.phrases.length - 1)].id });
        }, 120);
        timers.current.push(tick);
      };
      utter.onboundary = (e) => {
        if (run.current !== myRun || typeof e.charIndex !== 'number') return;
        gotBoundary = true;
        let idx = 0;
        while (idx + 1 < offsets.length && offsets[idx + 1] <= e.charIndex) idx++;
        setActive({ sentence: s.id, phrase: s.phrases[idx].id });
      };
      const next = () => {
        if (run.current !== myRun) return;
        clearTimers();
        if (startedAt === null) {
          // Never started speaking: don't silently race through the rest.
          run.current++;
          setPlaying(false);
          setActive(null);
          setFailed(true);
          return;
        }
        const took = startedAt ? performance.now() - startedAt : (total / (MORAE_PER_SECOND * rate)) * 1000;
        if (pause && sentences[si + 1]) {
          setActive({ sentence: s.id, phrase: null, waiting: true });
          timers.current.push(setTimeout(() => sayFrom(si + 1), Math.min(took + 400, 12000)));
        } else {
          sayFrom(si + 1);
        }
      };
      utter.onend = next;
      utter.onerror = (e) => { if (e.error !== 'interrupted' && e.error !== 'canceled') next(); };
      window.speechSynthesis.speak(utter);
    };
    sayFrom(from);
  }, [sentences, rate, pause, stop]);

  // Stop speaking when the passage, the text shown or the settings change,
  // and when the page goes away.
  useEffect(() => stop, [sentences, rate, pause, stop]);

  return { playing, active, failed, start, stop };
}
