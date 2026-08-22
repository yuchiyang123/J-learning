// Official Taiwan JLPT (日本語能力試驗) schedule, per LTTC / jlpt.tw.
// Source: https://www.jlpt.tw/Info/RegInfo.aspx (checked 2026-08-22).
// JLPT runs twice a year (July + December) — update this list each year once
// LTTC publishes the new dates, since there's no public API to pull them from.
export const jlptSchedule = [
  {
    id: '2026-1',
    year: 2026,
    session: 1,
    regStart: '2026-03-16',
    regEnd: '2026-03-31',
    examDate: '2026-07-05',
  },
  {
    id: '2026-2',
    year: 2026,
    session: 2,
    regStart: '2026-08-17',
    regEnd: '2026-08-31',
    examDate: '2026-12-06',
  },
];
