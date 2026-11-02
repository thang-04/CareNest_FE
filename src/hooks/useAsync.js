import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DB_CHANGED_EVENT } from '@/mocks/dbEvents';
import { deriveAsyncState } from './asyncState';
import { createLatestRequest } from './latestRequest';
import { loadWithHold } from './loadingTiming';

/**
 * Runs an async loader and tracks loading / error / data.
 * `refreshOnDataChange` reloads silently when the mock backend changes
 * (e.g. another role acted in another tab of this demo).
 * Đổi deps ⇒ `data` = null (dữ liệu cũ ở `stale`) tới khi phạm vi mới tải xong; `initialLoading` / `refreshing` cho khung chờ.
 */
export function useAsync(loader, deps = [], { refreshOnDataChange = false, enabled = true } = {}) {
  const [data, setDataState] = useState(null);
  const [dataScope, setDataScope] = useState(null);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState(null);
  const [errorScope, setErrorScope] = useState(null);
  const loaderRef = useRef(loader);
  loaderRef.current = loader;
  // Token phạm vi: đổi khi một phần tử deps đổi (so Object.is như React), không phụ thuộc deps có tuần tự hóa được không
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const scope = useMemo(() => ({}), deps);
  const scopeRef = useRef(scope);
  scopeRef.current = scope;
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
        if (guard.isLatest(id)) {
          setDataState(result);
          setDataScope(scope);
        }
        return result;
      } catch (err) {
        if (guard.isLatest(id)) {
          setError(err);
          setErrorScope(scope);
        }
      } finally {
        // Lần tải im lặng có thể thay lần tải thường đang chạy ⇒ lần mới nhất luôn tắt loading.
        if (guard.isLatest(id)) setLoading(false);
      }
    },
    [enabled, scope],
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

  // Sửa tay dữ liệu (vd. sau khi lưu một dòng) luôn thuộc phạm vi đang hiển thị
  const setData = useCallback((next) => {
    setDataState(next);
    setDataScope(scopeRef.current);
  }, []);

  const view = deriveAsyncState({ scope, enabled, data, dataScope, error, errorScope, loading });
  return { ...view, setData, reload: run };
}
