import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Check } from 'lucide-react';

// Generic custom-styled dropdown — replaces native <select> (which can't be
// themed consistently across browsers/OS) with a themeable popover menu that
// follows the site's design tokens in both light and dark mode.
export default function Dropdown({ options, value, onChange, icon, ariaLabel, align = 'right' }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e) {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    }
    function onKey(e) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const current = options.find((o) => o.value === value) ?? options[0];

  return (
    <div className="dropdown" ref={rootRef}>
      <button
        type="button"
        className="dropdown-trigger"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
      >
        {icon}
        <span className="dropdown-trigger-label">{current?.label}</span>
        <ChevronDown size={14} className={`dropdown-chevron${open ? ' is-open' : ''}`} />
      </button>

      {open && (
        <ul className={`dropdown-menu align-${align}`} role="listbox">
          {options.map((opt) => (
            <li key={opt.value} role="option" aria-selected={opt.value === value}>
              <button
                type="button"
                className={`dropdown-option${opt.value === value ? ' is-selected' : ''}`}
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
              >
                <span>{opt.label}</span>
                {opt.value === value && <Check size={14} />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
