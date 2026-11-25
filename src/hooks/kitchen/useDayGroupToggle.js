import { useCallback, useState } from 'react';

/** Mở/đóng từng nhóm ngày: mặc định mở nhóm đầu (đang lọc thì mở hết); người dùng bấm thì đảo so với mặc định. */
export function useDayGroupToggle(openAll) {
  const [toggled, setToggled] = useState(() => new Set());
  const isOpen = (key, index) => (openAll || index === 0) !== toggled.has(key);
  const toggle = useCallback(
    (key) =>
      setToggled((set) => {
        const next = new Set(set);
        if (!next.delete(key)) next.add(key);
        return next;
      }),
    [],
  );
  return { isOpen, toggle };
}
