// Maps a quiz_results.type value (server-side, plain string) to the i18n key
// for its Chinese/localized display label. Used wherever quiz history shows
// the raw type to the user (currently just the Progress page's history
// table) so a new quiz type only needs one line added here instead of an
// inline conditional chain at each call site.
export const QUIZ_TYPE_LABEL_KEYS = {
  vocab: 'type_vocab',
  kanji: 'type_kanji',
  grammar: 'type_grammar',
  listening: 'type_listening',
  kana: 'type_kana',
  kana_write: 'type_kana_write',
  jlpt_mock: 'type_jlpt_mock',
};

// Types whose quiz_results.level column isn't a real JLPT level: 'kana' is
// hardcoded to N5 server-side, and 'kana_write' repurposes the column to
// hold the script ('hira'/'kata') instead. History should show "-" for
// these rather than a misleading level value.
export const QUIZ_TYPES_WITHOUT_LEVEL = new Set(['kana', 'kana_write']);
