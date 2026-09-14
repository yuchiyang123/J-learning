import { useEffect } from 'react';

// Generic centered dialog: dimmed backdrop, click-outside and Escape to
// close, body scroll locked while open (same pattern as the mobile nav
// drawer) -- for anything that used to just get shoved inline into the
// page flow instead of appearing as an actual dialog (e.g. Vocabulary's
// "add custom word" form, which just pushed the flashcard down before).
export default function Modal({ open, onClose, label, children }) {
  useEffect(() => {
    if (!open) return;
    function onKey(e) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={label}>
        {children}
      </div>
    </div>
  );
}
