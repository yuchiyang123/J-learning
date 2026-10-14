import { useCallback, useEffect, useRef, useState } from 'react';
import { getCached, setCached, getPersisted, setPersisted } from '../lib/apiCache.js';

// Cache-first data fetching keyed by `key`. Serves a cached value
// immediately (no loading flash) when one exists, otherwise calls `fetcher`
// and caches the result. Pass `key: null` to skip fetching entirely (e.g.
// while logged out) — data stays undefined.
//
// { persist: true } also keeps a copy on the device (localStorage) for
// read-mostly content: on a later visit it's shown at once and refreshed in
// the background (stale-while-revalidate), updating only if it changed.
//
// Within a session the memory cache does NOT auto-revalidate: a component
// that mutates the underlying resource must call invalidateCache(key) and
// then the returned reload(true) to force a fresh fetch.
export function useCachedApi(key, fetcher, { persist = false } = {}) {
  const initial = () => {
    if (!key) return { data: undefined, loading: false, stale: false };
    const mem = getCached(key);
    if (mem !== undefined) return { data: mem, loading: false, stale: false };
    const saved = persist ? getPersisted(key) : undefined;
    if (saved !== undefined) return { data: saved, loading: false, stale: true };
    return { data: undefined, loading: true, stale: false };
  };
  const [state, setState] = useState(initial);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const fetchFresh = useCallback((background) => {
    if (!background) setState((s) => ({ ...s, loading: true }));
    return fetcherRef.current().then((result) => {
      setCached(key, result);
      if (persist) setPersisted(key, result);
      setState((s) => {
        // Background refresh that changed nothing: keep the same object so
        // nothing downstream re-renders or resets.
        if (background && JSON.stringify(s.data) === JSON.stringify(result)) return { ...s, loading: false, stale: false };
        return { data: result, loading: false, stale: false };
      });
    }).catch(() => {
      setState((s) => ({ ...s, loading: false }));
    });
  }, [key, persist]);

  const load = useCallback((force = false) => {
    if (!key) return;
    if (!force) {
      const mem = getCached(key);
      if (mem !== undefined) {
        setState({ data: mem, loading: false, stale: false });
        return;
      }
      const saved = persist ? getPersisted(key) : undefined;
      if (saved !== undefined) {
        setState({ data: saved, loading: false, stale: true });
        fetchFresh(true);
        return;
      }
    }
    fetchFresh(false);
  }, [key, persist, fetchFresh]);

  useEffect(() => {
    if (!key) {
      setState({ data: undefined, loading: false, stale: false });
      return;
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return [state.data, state.loading, load];
}
