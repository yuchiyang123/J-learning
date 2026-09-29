import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { switchSkin } from './registry.js';

const SkinContext = createContext(null);

// Holds the active skin (already loaded and applied by main.jsx before the
// first render) and swaps it on request. While the next skin's chunk is
// downloading, `switching` is its id so the picker can show progress; the
// current skin stays fully usable until the new one is ready.
export function SkinProvider({ initial, children }) {
  const [active, setActive] = useState(initial);
  const [switching, setSwitching] = useState(null);

  const setSkin = useCallback(async (id) => {
    if (id === active.meta.id) return;
    setSwitching(id);
    try {
      const loaded = await switchSkin(id);
      window.scrollTo(0, 0);
      setActive(loaded);
    } finally {
      setSwitching(null);
    }
  }, [active.meta.id]);

  const value = useMemo(() => ({
    skin: active.meta.id,
    Shell: active.mod.Shell,
    Home: active.mod.Home,
    setSkin,
    switching,
  }), [active, setSkin, switching]);

  return <SkinContext.Provider value={value}>{children}</SkinContext.Provider>;
}

export function useSkin() {
  return useContext(SkinContext);
}
