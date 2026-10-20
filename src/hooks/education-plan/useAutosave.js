import { useEffect, useRef, useState } from 'react';

const AUTOSAVE_MS = 1200;
const hhmm = (d) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

/**
 * Tự lưu bản đang soạn như trang chủ đề nhánh: gom các lần sửa, lưu một lần sau AUTOSAVE_MS ngừng sửa; bỏ qua khi nội
 * dung không đổi; không gửi song song; rời trang thì lưu nốt, đóng tab khi chưa lưu thì trình duyệt hỏi.
 * markClean(doc) = bản vừa nạp từ dữ liệu đã lưu (không cần lưu). save(doc) trả kết quả khác null khi lưu được.
 */
export function useAutosave({ doc, enabled, save, onSaved }) {
  const [cleanKey, setCleanKey] = useState(null);
  const [state, setState] = useState({ phase: 'idle', at: null });
  const inFlight = useRef(false);
  const key = doc ? JSON.stringify(doc) : null;
  const unsaved = !!doc && cleanKey !== null && key !== cleanKey;
  const latest = useRef({});
  latest.current = { doc, key, unsaved, enabled, save, onSaved };

  const flush = async () => {
    const { doc: d, key: k, unsaved: u, enabled: ok, save: run } = latest.current;
    if (!ok || !u || inFlight.current) return;
    inFlight.current = true;
    setState((s) => ({ ...s, phase: 'saving' }));
    const res = await run(d);
    inFlight.current = false;
    if (res) {
      setCleanKey(k);
      setState({ phase: 'saved', at: new Date() });
      // Không sửa thêm trong lúc lưu thì báo trang nạp lại từ bản đã lưu được
      latest.current.onSaved?.(latest.current.key === k);
    } else setState((s) => ({ ...s, phase: 'error' }));
  };
  useEffect(() => {
    if (!enabled || !unsaved || state.phase === 'error') return undefined;
    const t = setTimeout(flush, AUTOSAVE_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, cleanKey, enabled, state.phase]);
  useEffect(() => {
    const warn = (e) => {
      if (latest.current.unsaved) e.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => {
      window.removeEventListener('beforeunload', warn);
      flush();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    unsaved,
    busy: unsaved || state.phase === 'saving',
    error: state.phase === 'error',
    retry: () => setState((s) => ({ ...s, phase: 'idle' })),
    markClean: (d) => setCleanKey(d ? JSON.stringify(d) : null),
    label: state.phase === 'saving' || unsaved ? 'Đang lưu…' : state.at ? `Đã tự lưu lúc ${hhmm(state.at)}` : 'Tự lưu khi bạn sửa',
  };
}
