import { CalendarClock, Hourglass, CheckCircle2 } from 'lucide-react';
import { jlptSchedule } from '../data/jlptSchedule.js';
import { useLocale } from '../i18n/LocaleContext.jsx';

function toDate(str) {
  return new Date(`${str}T00:00:00`);
}

function daysBetween(from, to) {
  const ms = toDate(to).getTime() - from.getTime();
  return Math.round(ms / 86400000);
}

function formatDate(str) {
  const d = toDate(str);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export default function JlptCountdown() {
  const { t } = useLocale();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const upcoming = jlptSchedule.find((s) => daysBetween(today, s.examDate) >= 0);
  const current = upcoming || jlptSchedule[jlptSchedule.length - 1];
  const isPast = !upcoming;

  const daysToRegStart = daysBetween(today, current.regStart);
  const daysToRegEnd = daysBetween(today, current.regEnd);
  const daysToExam = daysBetween(today, current.examDate);

  let regStatus;
  if (isPast) regStatus = { text: t('jlpt_reg_ended'), tone: 'muted' };
  else if (daysToRegStart > 0) regStatus = { text: t('jlpt_reg_not_open', { days: daysToRegStart }), tone: 'upcoming' };
  else if (daysToRegEnd >= 0) regStatus = { text: t('jlpt_reg_open', { days: daysToRegEnd }), tone: 'open' };
  else regStatus = { text: t('jlpt_reg_closed'), tone: 'closed' };

  const others = jlptSchedule.filter((s) => s.id !== current.id);
  const sessionLabel = (s) => t('jlpt_session_label', { year: s.year, session: s.session });

  return (
    <div className="jlpt-card">
      <div className="jlpt-card-head">
        <CalendarClock size={20} />
        <span>{sessionLabel(current)} {t('jlpt_info_suffix')}</span>
      </div>

      <div className="jlpt-rows">
        <div className="jlpt-row">
          <span className="jlpt-row-label">{t('jlpt_reg_period')}</span>
          <span className="jlpt-row-value">{formatDate(current.regStart)} － {formatDate(current.regEnd)}</span>
          <span className={`jlpt-badge tone-${regStatus.tone}`}>{regStatus.text}</span>
        </div>
        <div className="jlpt-row">
          <span className="jlpt-row-label">{t('jlpt_exam_date')}</span>
          <span className="jlpt-row-value">{formatDate(current.examDate)}</span>
          <span className={`jlpt-badge tone-${isPast ? 'muted' : 'open'}`}>
            {isPast ? <><CheckCircle2 size={13} /> {t('jlpt_exam_ended')}</> : <><Hourglass size={13} /> {t('jlpt_exam_days_left', { days: daysToExam })}</>}
          </span>
        </div>
      </div>

      {others.length > 0 && (
        <p className="jlpt-note">
          {others
            .map((s) =>
              t('jlpt_other_session', {
                label: sessionLabel(s),
                date: formatDate(s.examDate),
                status: daysBetween(today, s.examDate) >= 0 ? t('jlpt_not_started') : t('jlpt_exam_ended'),
              })
            )
            .join('　')}
        </p>
      )}
      <p className="jlpt-source">{t('jlpt_source')}</p>
    </div>
  );
}
