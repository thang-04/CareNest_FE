import { useCallback, useEffect, useRef, useState } from 'react';
import { DB_CHANGED_EVENT } from '@/mocks/dbEvents';
import { createLatestRequest } from './latestRequest';
import { loadWithHold } from './loadingTiming';

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
  const requests = useRef(null);
  if (!requests.current) requests.current = createLatestRequest();

  useEffect(() => {
    const guard = requests.current;
    guard.mount();
    return () => guard.unmount();
  }, []);

  const run = useCallback(
    async ({ silent = false } = {}) => {
      const guard = requests.current;
      if (!enabled) {
        guard.cancel();
        setLoading(false);
        return;
      }
      const id = guard.begin();
      if (!silent) setLoading(true);
      setError(null);
      try {
        const result = silent ? await loaderRef.current() : await loadWithHold(() => loaderRef.current());
        if (guard.isLatest(id)) setData(result);
        return result;
      } catch (err) {
        if (guard.isLatest(id)) setError(err);
      } finally {
        // Lần tải im lặng có thể thay lần tải thường đang chạy ⇒ lần mới nhất luôn tắt loading.
        if (guard.isLatest(id)) setLoading(false);
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
