import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const MARK = 'cnLeaveGuard';
// Guard đang bật (màn đang có thay đổi chưa lưu); useGuardedNavigate hỏi qua guard này
let active = null;

/**
 * Hỏi trước khi rời màn hình khi còn thay đổi chưa lưu (quy tắc kế hoạch năm học: `.claude/rules/year-plan-unsaved.md`).
 * App dùng BrowserRouter (không có useBlocker) nên:
 * - bấm link/menu: chặn click trên thẻ <a> nội bộ rồi hỏi;
 * - nút quay lại: khi có thay đổi thì đặt thêm 1 mục lịch sử cùng URL; bấm quay lại chỉ gỡ mục đó rồi hỏi;
 * - navigate() ở header/thông báo/menu user: đi qua useGuardedNavigate();
 * - rời bằng nút trong màn: leave(to) thay cho navigate(to) (to nhận cả -1); vừa lưu/gửi xong thì leaveNow(to).
 * onSave() trả true khi lưu được.
 */
export function useLeaveGuard({ when, onSave }) {
  const navigate = useNavigate();
  const [pending, setPending] = useState(null);
  const [busy, setBusy] = useState(false);
  const latest = useRef({});
  latest.current = { when, onSave, navigate };
  const sentinel = useRef(false);
  const leaving = useRef(false);
  const afterPop = useRef(null);
  const self = useRef({ request: (target) => setPending(target), isOn: () => !!latest.current.when });

  const pushSentinel = () => {
    window.history.pushState({ ...window.history.state, [MARK]: true }, '', window.location.href);
    sentinel.current = true;
  };
  // Gỡ mục lịch sử phụ (nếu còn) rồi mới làm tiếp, để lịch sử không có 2 mục trùng URL
  const withoutSentinel = (next) => {
    if (sentinel.current && window.history.state?.[MARK]) {
      sentinel.current = false;
      leaving.current = true;
      afterPop.current = next;
      window.history.back();
    } else {
      sentinel.current = false;
      next?.();
    }
  };
  // target: { to } (đường dẫn hoặc số như -1) | { back: true } | { run } (vd. đăng xuất)
  const perform = (target) => withoutSentinel(() => (target.run ? target.run() : latest.current.navigate(target.to)));

  useEffect(() => {
    if (when && !sentinel.current) pushSentinel();
    else if (!when && sentinel.current) withoutSentinel(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [when]);

  useEffect(() => {
    const me = self.current;
    active = me;
    const onPop = () => {
      if (leaving.current) {
        leaving.current = false;
        const next = afterPop.current;
        afterPop.current = null;
        next?.();
        return;
      }
      if (!sentinel.current) return;
      // Người dùng bấm quay lại: mục phụ vừa bị gỡ, URL vẫn là trang này
      sentinel.current = false;
      if (latest.current.when) setPending({ back: true });
    };
    const onClick = (e) => {
      if (!latest.current.when || e.defaultPrevented || e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = e.target.closest?.('a[href]');
      if (!a || a.target === '_blank' || a.hasAttribute('download')) return;
      const url = new URL(a.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      const to = url.pathname + url.search + url.hash;
      if (to === window.location.pathname + window.location.search + window.location.hash) return;
      e.preventDefault();
      e.stopPropagation();
      setPending({ to });
    };
    // Đóng/tải lại tab trình duyệt: hộp hỏi mặc định của trình duyệt
    const onUnload = (e) => {
      if (latest.current.when) e.preventDefault();
    };
    window.addEventListener('popstate', onPop);
    window.addEventListener('beforeunload', onUnload);
    document.addEventListener('click', onClick, true);
    return () => {
      if (active === me) active = null;
      window.removeEventListener('popstate', onPop);
      window.removeEventListener('beforeunload', onUnload);
      document.removeEventListener('click', onClick, true);
    };
  }, []);

  const go = (target) => {
    setPending(null);
    if (target.back) {
      leaving.current = true;
      afterPop.current = null;
      window.history.back();
    } else perform(target);
  };

  return {
    // Rời sau khi đã lưu/gửi xong (không hỏi)
    leaveNow: (to) => perform({ to }),
    leave: (to) => {
      if (latest.current.when) setPending({ to });
      else perform({ to });
    },
    modal: {
      open: !!pending,
      busy,
      onStay: () => {
        if (pending?.back && latest.current.when) pushSentinel();
        setPending(null);
      },
      onDiscard: () => go(pending),
      onSaveAndLeave: async () => {
        const target = pending;
        setBusy(true);
        const ok = await latest.current.onSave?.();
        setBusy(false);
        if (ok) go(target);
      },
    },
  };
}

/** navigate() cho phần dùng chung ngoài màn (header, thông báo, menu user): màn đang có thay đổi chưa lưu thì hỏi trước. */
export function useGuardedNavigate() {
  const navigate = useNavigate();
  const go = (to) => (active?.isOn() ? active.request({ to }) : navigate(to));
  // Việc khác cần rời màn (vd. đăng xuất)
  go.run = (fn) => (active?.isOn() ? active.request({ run: fn }) : fn());
  return go;
}
