import { useEffect, useRef, useState } from 'react';
import { planBaseOf, usablePlanBackup } from '@/models/education-plan/planBackup.mjs';
import { readPlanBackup, removePlanBackup, writePlanBackup } from '@/services/education-plan/planBackup';

const hhmm = (d) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

/**
 * Lưu tay bản đang soạn (Tiền chốt 22/10: bỏ tự lưu): bấm Lưu hoặc Ctrl+S; đóng tab khi còn thay đổi chưa lưu thì
 * trình duyệt hỏi. Rời trang trong app do useLeaveGuard hỏi.
 * markClean(doc) = bản vừa nạp hoặc vừa lưu; cleanDoc() trả lại bản đó (để bỏ thay đổi). save(doc) trả kết quả khác null khi lưu được ({ doc } nếu thay bản đang sửa).
 * backup { userId, key }: còn thay đổi chưa lưu thì giữ ẩn một bản trên máy (Tiền chốt 27/10, không hiện chữ nào về việc này);
 * mở lại mà bản đó còn dùng được ⇒ recovery, restoreBackup() gọi onRestore(doc). Lưu được hoặc "Không lưu" (discardBackup) thì xóa bản giữ.
 */
export function useManualSave({ doc, enabled, save, onSaved, backup, onRestore }) {
  const [cleanKey, setCleanKey] = useState(null);
  const [state, setState] = useState({ phase: 'idle', at: null });
  const [recovery, setRecovery] = useState(null);
  const inFlight = useRef(false);
  const key = doc ? JSON.stringify(doc) : null;
  const unsaved = !!doc && cleanKey !== null && key !== cleanKey;
  const latest = useRef({});
  latest.current = { doc, key, unsaved, enabled, save, onSaved, backup, recovery, onRestore };
  // Bản giữ gắn với tài liệu lúc markClean (không theo prop mới khi đã chuyển sang tài liệu khác)
  const slot = useRef(null);
  const base = useRef(null);
  const wrote = useRef(false);
  const paused = useRef(false);

  const dropBackup = () => {
    if (!slot.current) return;
    try {
      removePlanBackup(slot.current.userId, slot.current.key);
    } catch {
      /* Không xóa được thì lần mở sau tự bỏ vì khớp bản trên hệ thống hoặc lệch mốc phiên bản */
    }
    wrote.current = false;
  };
  const keepBackup = () => {
    const { doc: d, unsaved: u, enabled: ok, recovery: r } = latest.current;
    if (!slot.current || r || paused.current) return;
    if (!u || !ok) {
      if (wrote.current) dropBackup();
      return;
    }
    try {
      writePlanBackup(slot.current.userId, slot.current.key, { doc: d, base: base.current, savedAt: Date.now() });
      wrote.current = true;
    } catch {
      /* Thiết bị không cho ghi (đầy bộ nhớ, chế độ riêng tư): bỏ qua, vẫn lưu tay được */
    }
  };

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
    const savedDoc = res?.doc || (typeof res === 'object' ? res : null);
    if (savedDoc) base.current = planBaseOf(savedDoc);
    dropBackup();
    setRecovery(null);
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
    window.addEventListener('pagehide', keepBackup);
    const timer = setInterval(keepBackup, 750);
    return () => {
      keepBackup();
      clearInterval(timer);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('beforeunload', warn);
      window.removeEventListener('pagehide', keepBackup);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    unsaved,
    saving: state.phase === 'saving',
    error: state.phase === 'error',
    save: run,
    markClean: (d) => {
      setCleanKey(d ? JSON.stringify(d) : null);
      const b = latest.current.backup;
      slot.current = d && b?.userId && b?.key ? { userId: b.userId, key: b.key } : null;
      base.current = d ? planBaseOf(d) : null;
      wrote.current = false;
      paused.current = false;
      let found = null;
      if (slot.current) {
        try {
          const entry = readPlanBackup(slot.current.userId, slot.current.key);
          found = usablePlanBackup(entry, d);
          // Bản trên hệ thống đã đổi (gửi, trả lại, duyệt…) hoặc trùng nội dung ⇒ bản giữ cũ bỏ đi
          if (entry && !found) dropBackup();
        } catch {
          /* Không đọc được bộ nhớ máy: coi như không có bản giữ */
        }
      }
      setRecovery(found);
    },
    recovery,
    restoreBackup: () => {
      if (!latest.current.recovery) return;
      latest.current.onRestore?.(latest.current.recovery.doc);
      wrote.current = true;
      setRecovery(null);
    },
    dismissRecovery: () => {
      dropBackup();
      setRecovery(null);
    },
    // "Không lưu" khi rời màn: xóa bản giữ và thôi giữ cho tới lần nạp sau
    discardBackup: () => {
      paused.current = true;
      dropBackup();
    },
    cleanDoc: () => (cleanKey ? JSON.parse(cleanKey) : null),
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
