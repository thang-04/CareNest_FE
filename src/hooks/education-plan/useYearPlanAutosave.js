import { useEffect, useRef, useState } from 'react';
import { createSaveQueue, reconcileYearPlanIds, recoveryKey, yearPlanContentKey } from '@/models/education-plan/yearPlanAutosave.mjs';
import { findYearPlanRecovery, storeYearPlanRecovery, removeYearPlanRecovery } from '@/services/education-plan/yearPlanRecovery';

const hhmm = (d) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

/**
 * Kế hoạch năm học: chỉ ghi lên hệ thống khi bấm Lưu/Ctrl+S hoặc gửi/ban hành (Tiền chốt 27/10).
 * Còn khác bản đã lưu thì giữ ẩn một bản trên máy (750ms + pagehide) để khôi phục khi mất điện/đóng tab.
 */
export function useYearPlanAutosave({ doc, setDoc, enabled, mayBackup, save, userId, planKey, onConflict }) {
  const latest = useRef({});
  latest.current = { doc, setDoc, enabled, mayBackup, save, onConflict };
  const [state, setState] = useState({ phase: 'idle', at: null });
  const [recovery, setRecovery] = useState(() => {
    try {
      return findYearPlanRecovery(userId, planKey, doc);
    } catch {
      return null;
    }
  });
  const mounted = useRef(true);
  const stopBackup = useRef(false);
  const hasOwnedLease = useRef(false);
  const slot = useRef(crypto.randomUUID());
  const restoredSource = useRef(null);
  if (mayBackup) hasOwnedLease.current = true;
  latest.current.recovery = recovery;
  const queue = useRef(null);
  if (!queue.current) {
    queue.current = createSaveQueue({
      read: () => latest.current.doc,
      enabled: () => latest.current.enabled && !latest.current.recovery && navigator.onLine,
      write: (snapshot, requestId) => latest.current.save(snapshot, requestId),
      accept: (saved, snapshot) => {
        const current = reconcileYearPlanIds(latest.current.doc, snapshot, saved);
        const baseline = reconcileYearPlanIds(snapshot, snapshot, saved);
        if (yearPlanContentKey(current) === yearPlanContentKey(baseline)) {
          try {
            removeYearPlanRecovery(userId, planKey, slot.current);
            removeYearPlanRecovery(userId, current.id, slot.current);
            if (restoredSource.current) {
              restoredSource.current.forEach((source) => removeYearPlanRecovery(userId, planKey, null, source));
              restoredSource.current = null;
            }
          } catch {
            /* Bản giữ trên máy chỉ để phòng mất điện; không ghi/xóa được thì vẫn dùng bản trên hệ thống. */
          }
        }
        latest.current.doc = current;
        if (mounted.current) latest.current.setDoc(current);
        else if (hasOwnedLease.current) {
          try {
            if (yearPlanContentKey(current) !== yearPlanContentKey(baseline)) {
              const entry = { doc: current, baseRevision: current.revision ?? 0, savedAt: Date.now() };
              storeYearPlanRecovery(userId, planKey, slot.current, entry);
              storeYearPlanRecovery(userId, current.id, slot.current, entry);
            } else {
              removeYearPlanRecovery(userId, planKey, slot.current);
              removeYearPlanRecovery(userId, current.id, slot.current);
            }
          } catch {
            /* Giữ bản cũ nếu thiết bị không cho ghi bản thay thế. */
          }
        }
        return baseline;
      },
      onState: (next, error) => {
        if (mounted.current) setState({ phase: next, at: next === 'saved' ? new Date() : null });
        if (next === 'conflict') latest.current.onConflict?.(error);
      },
    });
  }
  // Bản giữ được ghi cả theo planKey lẫn theo ID kế hoạch (cùng slot) ⇒ khôi phục/bỏ thì dọn cả hai
  const sourcesOf = (entry) => {
    const source = entry.sourceKey;
    const sibling = entry.doc?.id ? `${recoveryKey(userId, entry.doc.id)}:${source.split(':').pop()}` : null;
    return [source, sibling].filter(Boolean);
  };
  const saveNow = async () => {
    if (!navigator.onLine && queue.current.dirty()) {
      setState({ phase: 'error', at: null });
      return false;
    }
    return queue.current.flush();
  };
  // Bản giữ ẩn trên máy (không báo trên UI): phòng mất điện/đóng tab khi chưa bấm Lưu
  const backup = () => {
    if (recovery || stopBackup.current || !hasOwnedLease.current) return;
    try {
      const current = latest.current.doc;
      if (!queue.current.dirty()) {
        removeYearPlanRecovery(userId, planKey, slot.current);
        removeYearPlanRecovery(userId, current.id, slot.current);
        return;
      }
      const entry = { doc: current, baseRevision: current.revision ?? 0, savedAt: Date.now() };
      storeYearPlanRecovery(userId, planKey, slot.current, entry);
      if (current.id) storeYearPlanRecovery(userId, current.id, slot.current, entry);
      if (restoredSource.current) {
        restoredSource.current.forEach((source) => removeYearPlanRecovery(userId, planKey, null, source));
        restoredSource.current = null;
      }
    } catch {
      /* Thiết bị không cho ghi (đầy bộ nhớ, chế độ riêng tư): bỏ qua, người dùng vẫn lưu tay được. */
    }
  };
  useEffect(() => {
    mounted.current = true;
    queue.current.resume();
    const interval = setInterval(() => {
      if (!recovery) backup();
    }, 750);
    const warn = (event) => {
      if (queue.current.dirty()) event.preventDefault();
    };
    const hide = () => backup();
    const key = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        saveNow();
      }
    };
    window.addEventListener('beforeunload', warn);
    window.addEventListener('pagehide', hide);
    document.addEventListener('keydown', key);
    return () => {
      backup();
      mounted.current = false;
      queue.current.dispose();
      clearInterval(interval);
      window.removeEventListener('beforeunload', warn);
      window.removeEventListener('pagehide', hide);
      document.removeEventListener('keydown', key);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, planKey, !!recovery]);
  const dirty = queue.current.dirty();
  return {
    unsaved: dirty,
    saving: state.phase === 'saving',
    error: state.phase === 'error' || state.phase === 'conflict',
    recovery,
    markClean: (value) => queue.current.markClean(value),
    current: () => latest.current.doc,
    save: saveNow,
    settle: () => queue.current.settle(),
    restore() {
      if (!recovery) return;
      restoredSource.current = sourcesOf(recovery);
      latest.current.doc = recovery.doc;
      setDoc(recovery.doc);
      setRecovery(null);
    },
    dismissRecovery() {
      removeYearPlanRecovery(userId, planKey, slot.current);
      if (recovery) sourcesOf(recovery).forEach((source) => removeYearPlanRecovery(userId, planKey, null, source));
      setRecovery(null);
    },
    clearRecovery() {
      stopBackup.current = true;
      try {
        removeYearPlanRecovery(userId, planKey, slot.current);
        removeYearPlanRecovery(userId, latest.current.doc.id, slot.current);
      } catch {
        /* Không xóa được bản giữ trên máy thì lần mở sau còn hỏi khôi phục; không chặn thao tác. */
      }
    },
    // Giống các màn lưu tay (useManualSave): không nói gì về bản giữ trên máy
    label:
      state.phase === 'saving'
        ? 'Đang lưu…'
        : state.phase === 'error' || state.phase === 'conflict'
          ? 'Chưa lưu được'
          : dirty
            ? 'Có thay đổi chưa lưu'
            : state.at
              ? `Đã lưu lúc ${hhmm(state.at)}`
              : '',
  };
}
