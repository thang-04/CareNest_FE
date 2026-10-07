import { useCallback, useEffect, useRef, useState } from 'react';
import { DB_CHANGED_EVENT } from '@/mocks/mockDatabase';

/**
 * Runs an async loader and tracks loading / error / data.
 * `refreshOnDataChange` reloads silently when the mock backend changes
 * (e.g. another role acted in another tab of this demo).
 */
export function useAsync(loader, deps = [], { refreshOnDataChange = false, enabled = true } = {}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState(null);
  const loaderRef = useRef(loader);
  loaderRef.current = loader;

  const run = useCallback(
    async ({ silent = false } = {}) => {
      if (!enabled) return;
      if (!silent) setLoading(true);
      setError(null);
      try {
        const result = await loaderRef.current();
        setData(result);
        return result;
      } catch (err) {
        setError(err);
      } finally {
        if (!silent) setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [enabled, ...deps],
  );

  useEffect(() => {
    run();
  }, [run]);

  useEffect(() => {
    if (!refreshOnDataChange) return undefined;
    const handler = () => run({ silent: true });
    window.addEventListener(DB_CHANGED_EVENT, handler);
    window.addEventListener('storage', handler);
    return () => {
      window.removeEventListener(DB_CHANGED_EVENT, handler);
      window.removeEventListener('storage', handler);
    };
  }, [refreshOnDataChange, run]);

  return { data, setData, loading, error, reload: run };
}
