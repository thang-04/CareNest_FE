import { useSearchParams } from 'react-router-dom';

/**
 * Tab của màn chia tab (DESIGN §6.3 "Chia tab màn dài"): giữ trên URL `?tab=` để tải lại, gửi link hay bấm Quay lại
 * vẫn mở đúng tab. keys: các key hợp lệ, phần tử đầu là tab mặc định (không ghi lên URL).
 */
export function useTabParam(keys, param = 'tab') {
  const [params, setParams] = useSearchParams();
  const raw = params.get(param);
  const tab = keys.includes(raw) ? raw : keys[0];
  const setTab = (key) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (key === keys[0]) next.delete(param);
        else next.set(param, key);
        return next;
      },
      { replace: true },
    );
  return [tab, setTab];
}
