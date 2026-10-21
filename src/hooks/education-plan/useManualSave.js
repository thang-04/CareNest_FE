import { useEffect, useRef, useState } from 'react';

const hhmm = (d) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

/**
 * Lưu tay bản đang soạn (Tiền chốt 22/10: bỏ tự lưu): bấm Lưu hoặc Ctrl+S; đóng tab khi còn thay đổi chưa lưu thì
 * trình duyệt hỏi. Rời trang trong app do useLeaveGuard hỏi.
 * markClean(doc) = bản vừa nạp hoặc vừa lưu. save(doc) trả kết quả khác null khi lưu được ({ doc } nếu thay bản đang sửa).
 */
export function useManualSave({ doc, enabled, save, onSaved }) {
  const [cleanKey, setCleanKey] = useState(null);
  const [state, setState] = useState({ phase: 'idle', at: null });
  const inFlight = useRef(false);
  const key = doc ? JSON.stringify(doc) : null;
  const unsaved = !!doc && cleanKey !== null && key !== cleanKey;
  const latest = useRef({});
  latest.current = { doc, key, unsaved, enabled, save, onSaved };

  const run = async () => {
    const { doc: d, key: k, unsaved: u, enabled: ok, save: saveDoc } = latest.current;
    if (!ok || inFlight.current) return false;
    if (!u) return true;
    inFlight.current = true;
    setState((s) => ({ ...s, phase: 'saving' }));
    const res = await saveDoc(d);
    inFlight.current = false;
    if (!res) {
      setState((s) => ({ ...s, phase: 'error' }));
      return false;
    }
    // save trả { doc } khi trang thay bản đang sửa bằng bản đã lưu (vd. id do BE cấp)
    setCleanKey(res?.doc ? JSON.stringify(res.doc) : k);
    setState({ phase: 'saved', at: new Date() });
    // Không sửa thêm trong lúc lưu thì báo trang nạp lại từ bản đã lưu được
    latest.current.onSaved?.(latest.current.key === k);
    return true;
  };

  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === 's') {
        // Chặn hộp "Lưu trang" của trình duyệt kể cả khi chưa lưu được
        e.preventDefault();
        if (latest.current.enabled) run();
      }
    };
    const warn = (e) => {
      if (latest.current.unsaved) e.preventDefault();
    };
    document.addEventListener('keydown', onKey);
    window.addEventListener('beforeunload', warn);
    return () => {
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('beforeunload', warn);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    unsaved,
    saving: state.phase === 'saving',
    error: state.phase === 'error',
    save: run,
    markClean: (d) => setCleanKey(d ? JSON.stringify(d) : null),
    label:
      state.phase === 'saving'
        ? 'Đang lưu…'
        : state.phase === 'error'
          ? 'Chưa lưu được'
          : unsaved
            ? 'Có thay đổi chưa lưu'
            : state.at
              ? `Đã lưu lúc ${hhmm(state.at)}`
              : '',
  };
}
