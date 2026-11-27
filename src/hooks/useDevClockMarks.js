import { useEffect, useId } from 'react';
import { DEV_TOOLS_ENABLED, setDevMarks } from '@/utils/devClock';

/**
 * Khai báo mốc thời gian của màn cho Dev Mode: [{ label, at }] với at là ISO có múi giờ.
 * Build không bật VITE_DEV_TOOLS thì không làm gì.
 */
export function useDevClockMarks(marks) {
  const owner = useId();
  const key = DEV_TOOLS_ENABLED ? JSON.stringify(marks || []) : '';
  useEffect(() => {
    if (!DEV_TOOLS_ENABLED) return undefined;
    setDevMarks(owner, JSON.parse(key));
    return () => setDevMarks(owner, []);
  }, [owner, key]);
}
