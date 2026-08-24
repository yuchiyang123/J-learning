import { useCallback, useEffect, useState } from 'react';
import { getCached, setCached } from '../lib/apiCache.js';

// Cache-first data fetching keyed by `key`. Serves a cached value
// immediately (no loading flash) when one exists, otherwise calls `fetcher`
// and caches the result. Pass `key: null` to skip fetching entirely (e.g.
// while logged out) — data stays undefined.
//
// This does NOT auto-revalidate stale data on its own: a component that
// mutates the underlying resource must call invalidateCache(key) and then
// the returned reload(true) to force a fresh fetch. That's intentional —
// silently refetching in the background would just trade "stale but
// predictable" for "changes underneath you mid-render".
export function useCachedApi(key, fetcher) {
  const [state, setState] = useState(() => {
    const cached = key ? getCached(key) : undefined;
    return { data: cached, loading: !!key && cached === undefined };
  });

  const load = useCallback((force = false) => {
    if (!key) return;
    if (!force) {
      const cached = getCached(key);
      if (cached !== undefined) {
        setState({ data: cached, loading: false });
        return;
      }
    }
    setState((s) => ({ ...s, loading: true }));
    fetcher().then((result) => {
      setCached(key, result);
      setState({ data: result, loading: false });
    });
    // fetcher is intentionally excluded: every value it closes over that
    // should trigger a refetch is expected to already be part of `key`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    if (!key) {
      setState({ data: undefined, loading: false });
      return;
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return [state.data, state.loading, load];
}
