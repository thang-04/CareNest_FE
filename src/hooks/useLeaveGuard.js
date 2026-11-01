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
 * - rời bằng nút trong màn: leave(to, options?) thay cho navigate(to, options?) (to nhận cả -1 hoặc hàm tự điều hướng);
 *   vừa lưu/gửi xong thì leaveNow(to, options?);
 * - màn nhiều bước trong cùng trang: đổi bước bằng step(to, options) (không hỏi); inPageBack() trả true khi Back còn lùi
 *   được về bước trước trong màn ⇒ Back gỡ mục phụ rồi lùi tiếp tới bước đó thay vì hỏi.
 * onSave() trả true khi lưu được.
 */
export function useLeaveGuard({ when, onSave, inPageBack }) {
  const navigate = useNavigate();
  const [pending, setPending] = useState(null);
  const [busy, setBusy] = useState(false);
  const latest = useRef({});
  latest.current = { when, onSave, navigate, inPageBack };
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
  // target: { to } (đường dẫn hoặc số như -1) | { back: true } | { run } (vd. đăng xuất, hàm tự điều hướng)
  const target = (to, options) => (typeof to === 'function' ? { run: to } : { to, options });
  const perform = (target) => withoutSentinel(() => (target.run ? target.run() : latest.current.navigate(target.to, target.options)));

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
      // Tới chính mục phụ từ mục phía sau: vẫn đang chặn, không làm gì
      if (window.history.state?.[MARK]) return;
      if (!sentinel.current) return;
      // Người dùng bấm quay lại: mục phụ vừa bị gỡ, URL vẫn là trang này
      sentinel.current = false;
      if (latest.current.inPageBack?.()) {
        // Còn bước trước trong màn: lùi tiếp tới bước đó (dữ liệu đang sửa giữ nguyên) rồi đặt lại mục phụ
        leaving.current = true;
        afterPop.current = () => latest.current.when && !sentinel.current && pushSentinel();
        window.history.back();
        return;
      }
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
    leaveNow: (to, options) => perform(target(to, options)),
    leave: (to, options) => {
      if (latest.current.when) setPending(target(to, options));
      else perform(target(to, options));
    },
    // Đổi bước trong cùng màn (không hỏi). Đang có mục phụ thì thay nó bằng bước mới rồi đặt lại phía trên,
    // để mục phụ luôn là mục cuối (đếm đúng số mục lịch sử khi rời màn)
    step: (to, options) => {
      if (sentinel.current && window.history.state?.[MARK]) {
        latest.current.navigate(to, { ...options, replace: true });
        sentinel.current = false;
        if (latest.current.when) pushSentinel();
      } else latest.current.navigate(to, options);
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
