import { useCallback, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { activeFilterKeys, readFilters, writeFilters } from '@/utils/filterParams';

/**
 * Bộ lọc danh sách lưu trên URL: mở chi tiết rồi Back vẫn giữ bộ lọc.
 * defaults: { key: 'giá trị mặc định (chuỗi)' } — có thể khác theo vai trò.
 * Trả về [filters, setFilters(patch), reset, activeKeys].
 */
export function useFilterParams(defaults) {
  const [params, setParams] = useSearchParams();
  const defaultsKey = JSON.stringify(defaults);
  const defaultsRef = useRef(defaults);
  defaultsRef.current = defaults;

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const filters = useMemo(() => readFilters(params, defaultsRef.current), [params, defaultsKey]);

  // replace: đổi bộ lọc không tạo thêm bước trong lịch sử, Back quay về trang trước đó
  const setFilters = useCallback(
    (patch) =>
      setParams(
        (prev) => {
          const base = readFilters(prev, defaultsRef.current);
          return writeFilters(prev, { ...base, ...patch }, defaultsRef.current);
        },
        { replace: true },
      ),
    [setParams],
  );
  const reset = useCallback(() => setFilters(defaultsRef.current), [setFilters]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const activeKeys = useMemo(() => activeFilterKeys(filters, defaultsRef.current), [filters, defaultsKey]);

  return [filters, setFilters, reset, activeKeys];
}
