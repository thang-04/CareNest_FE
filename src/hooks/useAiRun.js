import { useCallback, useEffect, useRef, useState } from 'react';
import { runWithAiHold } from './loadingTiming';

/**
 * Trạng thái chờ cho thao tác gọi AI: `run(task)` bật `running`, giữ tối thiểu theo runWithAiHold,
 * trả kết quả hoặc ném lỗi của task. Nhiều task chồng nhau ⇒ `running` tắt khi task cuối xong.
 */
export function useAiRun() {
  const [running, setRunning] = useState(false);
  const active = useRef(0);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const run = useCallback(async (task) => {
    active.current += 1;
    setRunning(true);
    try {
      return await runWithAiHold(task);
    } finally {
      active.current -= 1;
      if (mounted.current && active.current === 0) setRunning(false);
    }
  }, []);

  return { running, run };
}
