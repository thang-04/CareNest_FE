import { useEffect, useRef, useState } from 'react';
import { upsertDraft } from '@/models/draftHistory.mjs';
import { readDrafts, writeDrafts } from '@/services/assessment/draftStore';

/**
 * Bản giữ ẩn trên máy cho màn tự lo việc Lưu (cách của kế hoạch giáo dục, Tiền 27/10 và 03/11): khi `doc` khác `saved`
 * thì cứ 750ms và lúc đóng tab ghi một mốc cho lần soạn này, giữ 2 mốc mới nhất mỗi tài liệu. `base` là mốc phiên bản
 * bản trên hệ thống (đổi trạng thái, lưu bởi người khác…): mở lại mà base đã đổi thì bỏ mốc cũ.
 * Lưu được hoặc chọn "Không lưu" ⇒ gọi clear(). Không hiện chữ nào về tự lưu trên máy.
 */
export function useDraftBackup({ userId, docKey, doc, saved, base, enabled = true }) {
  const [drafts, setDrafts] = useState([]);
  const slot = userId && docKey ? `${userId}|${docKey}` : null;
  const session = useRef(null);
  const startedAt = useRef(null);
  const paused = useRef(false);
  const latest = useRef({});
  latest.current = { userId, docKey, doc, saved, base, enabled, slot };

  const edit = (fn) => {
    const { userId: u, docKey: k } = latest.current;
    writeDrafts(u, k, fn(readDrafts(u, k)));
  };

  // Nạp tài liệu (hoặc bản trên hệ thống đổi mốc): lần soạn mới, đọc lại các mốc còn dùng được
  useEffect(() => {
    session.current = crypto.randomUUID();
    startedAt.current = null;
    paused.current = false;
    if (!slot || saved == null) {
      setDrafts([]);
      return;
    }
    try {
      const list = readDrafts(userId, docKey);
      const usable = list.filter((x) => x.base === base && JSON.stringify(x.doc) !== JSON.stringify(saved));
      if (usable.length !== list.length) writeDrafts(userId, docKey, usable);
      setDrafts(usable);
    } catch {
      setDrafts([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slot, base]);

  useEffect(() => {
    const keep = () => {
      const { doc: d, saved: s, base: b, enabled: ok, slot: sl } = latest.current;
      if (!sl || paused.current || !ok || d == null || s == null) return;
      if (JSON.stringify(d) === JSON.stringify(s)) return;
      try {
        startedAt.current ??= Date.now();
        const entry = { session: session.current, doc: d, base: b, startedAt: startedAt.current, savedAt: Date.now() };
        edit((list) => upsertDraft(list, entry));
      } catch {
        /* Thiết bị không cho ghi (đầy bộ nhớ, chế độ riêng tư): bỏ qua, vẫn lưu tay được */
      }
    };
    const timer = setInterval(keep, 750);
    window.addEventListener('pagehide', keep);
    return () => {
      keep();
      clearInterval(timer);
      window.removeEventListener('pagehide', keep);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    drafts,
    // Lưu được / "Không lưu": xóa mốc của lần soạn này; sửa tiếp là lần soạn mới
    clear: ({ pause = false } = {}) => {
      paused.current = pause;
      if (!latest.current.slot) return;
      try {
        const current = session.current;
        edit((list) => list.filter((x) => x.session !== current));
      } catch {
        /* Không xóa được thì lần mở sau tự bỏ vì trùng bản đã lưu hoặc lệch mốc */
      }
      session.current = crypto.randomUUID();
      startedAt.current = null;
    },
    // "Dùng bản này": mốc đó thành lần soạn hiện tại, bỏ khỏi danh sách
    used: (entry) => {
      setDrafts((list) => list.filter((x) => x !== entry));
      if (!latest.current.slot) return;
      try {
        edit((list) => list.filter((x) => x.session !== entry.session));
      } catch {
        /* Mốc gốc còn lại thì lần mở sau vẫn thấy */
      }
    },
  };
}
