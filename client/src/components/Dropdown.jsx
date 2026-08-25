import { ChevronDown, Check } from 'lucide-react';
import { useDismissableMenu } from '../hooks/useDismissableMenu.js';

// Generic custom-styled dropdown — replaces native <select> (which can't be
// themed consistently across browsers/OS) with a themeable popover menu that
// follows the site's design tokens in both light and dark mode.
export default function Dropdown({ options, value, onChange, icon, ariaLabel, align = 'right' }) {
  const { open, setOpen, rootRef } = useDismissableMenu();

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
        <span className="dropdown-trigger-label">
          <span className="dropdown-label-full">{current?.label}</span>
          <span className="dropdown-label-short">{current?.short ?? current?.label}</span>
        </span>
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
