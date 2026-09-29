import { useEffect, useState } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { isSoundEnabled, onSoundChange, setSoundEnabled, chime } from '../../lib/sound.js';

export default function SoundToggle() {
  const [on, setOn] = useState(isSoundEnabled);
  useEffect(() => onSoundChange(setOn), []);
  return (
    <button
      type="button"
      className={`tool-btn sound-toggle${on ? ' is-on' : ''}`}
      onClick={() => { const next = !on; setSoundEnabled(next); if (next) chime(2); }}
      aria-label={on ? '音 ON' : '音 OFF'}
      title={on ? '音 ON' : '音 OFF'}
    >
      {on ? <Volume2 size={16} /> : <VolumeX size={16} />}
    </button>
  );
}
