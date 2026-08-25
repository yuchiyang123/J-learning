import { useEffect, useRef, useState } from 'react';

// Shared open/close-on-outside-click + Escape behavior for popover-style
// menus (Dropdown, AccountMenu, ...) so each one doesn't reimplement its own
// document click/keydown listeners.
export function useDismissableMenu() {
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

  return { open, setOpen, rootRef };
}
