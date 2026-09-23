// The stops along the 参道 — each one a practice area, named by one kanji
// (the character the fireflies gather into, the one on the lantern, the one
// on the gate's plaque) plus a short line in Japanese. `to: null` marks the
// entrance, which is the home world itself.
export const stops = [
  { id: 'intro', kanji: '道', to: null, key: 'brand', line: '参道をあるく', lantern: '首' },
  { id: 'kana', kanji: '音', to: '/kana', key: 'quick_kana', line: '音から始まる' },
  { id: 'vocab', kanji: '語', to: '/vocabulary', key: 'quick_vocab', line: '言葉を集める' },
  { id: 'kanji', kanji: '字', to: '/kanji', key: 'quick_kanji', line: '一画ずつ、丁寧に' },
  { id: 'grammar', kanji: '文', to: '/grammar', key: 'quick_grammar', line: '文を組み立てる' },
  { id: 'listening', kanji: '聴', to: '/listening', key: 'quick_listening', line: '耳を澄ます' },
  { id: 'speaking', kanji: '話', to: '/speaking', key: 'quick_speaking', line: '声に出してみる' },
  { id: 'quiz', kanji: '問', to: '/quiz', key: 'quick_quiz', line: '力を試す' },
  { id: 'jlpt', kanji: '験', to: '/jlpt', key: 'quick_jlpt', line: '本番のように' },
  { id: 'games', kanji: '遊', to: '/games', key: 'quick_games', line: '遊びながら覚える' },
  { id: 'progress', kanji: '進', to: '/progress', key: 'quick_progress', line: 'ここまでの道のり' },
];

// Lantern rope order (home first). "學習進度" lives in the account menu
// once logged in, so it isn't a lantern.
export const lanterns = [
  { to: '/', key: 'nav_home', kanji: '首', end: true },
  { to: '/kana', key: 'nav_kana', kanji: '音' },
  { to: '/vocabulary', key: 'nav_vocab', kanji: '語' },
  { to: '/kanji', key: 'nav_kanji', kanji: '字' },
  { to: '/grammar', key: 'nav_grammar', kanji: '文' },
  { to: '/listening', key: 'nav_listening', kanji: '聴' },
  { to: '/speaking', key: 'nav_speaking', kanji: '話' },
  { to: '/quiz', key: 'nav_quiz', kanji: '問' },
  { to: '/jlpt', key: 'nav_jlpt', kanji: '験' },
  { to: '/games', key: 'nav_games', kanji: '遊' },
];
