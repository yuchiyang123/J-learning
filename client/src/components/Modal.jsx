import { useEffect } from 'react';

// Generic centered dialog: dimmed backdrop, body scroll locked while open
// (same pattern as the mobile nav drawer) -- for anything that used to just
// get shoved inline into the page flow instead of appearing as an actual
// dialog (e.g. Vocabulary's "add custom word" form, which just pushed the
// flashcard down before).
//
// `dismissible` (default true) controls whether clicking the backdrop or
// pressing Escape closes it. Set it false for a form where an accidental
// click-away shouldn't silently discard what's typed — the content is then
// responsible for its own close affordance (e.g. an X button) that can
// confirm before calling onClose itself.
export default function Modal({ open, onClose, label, dismissible = true, children }) {
  useEffect(() => {
    if (!open || !dismissible) return;
    function onKey(e) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, dismissible, onClose]);

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  if (!open) return null;

  return (
    <div className="modal-backdrop" onClick={dismissible ? onClose : undefined}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={label}>
        {children}
      </div>
    </div>
  );
}
