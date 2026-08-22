import { Link } from 'react-router-dom';
import { LayoutGrid, Zap, CloudRain } from 'lucide-react';
import { useLocale } from '../../i18n/LocaleContext.jsx';

const games = [
  { to: '/games/memory', icon: LayoutGrid, titleKey: 'game_memory_title', descKey: 'game_memory_desc' },
  { to: '/games/blitz', icon: Zap, titleKey: 'game_blitz_title', descKey: 'game_blitz_desc' },
  { to: '/games/falling', icon: CloudRain, titleKey: 'game_falling_title', descKey: 'game_falling_desc' },
];

export default function GameHub() {
  const { t } = useLocale();

  return (
    <div className="page">
      <h1>{t('games_hub_title')}</h1>
      <p className="subtitle">{t('games_hub_subtitle')}</p>

      <div className="game-hub-grid">
        {games.map((g) => (
          <Link className="game-card" to={g.to} key={g.to}>
            <div className="game-card-icon"><g.icon size={28} /></div>
            <div className="game-card-title">{t(g.titleKey)}</div>
            <p className="game-card-desc">{t(g.descKey)}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
