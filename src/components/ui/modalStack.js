/**
 * Stack các modal đang mở (module-level): chỉ modal trên cùng xử lý Esc và bẫy Tab,
 * để modal lồng nhau không đóng cùng lúc.
 */
const stack = [];

// Có lớp phủ đang mở thì khóa cuộn trang phía sau (chỉ cuộn trong modal); bù bề rộng thanh cuộn để trang không xô ngang.
let restoreScroll = null;
function syncPageScroll() {
  if (typeof document === 'undefined') return;
  if (stack.length > 0 && !restoreScroll) {
    const { documentElement: html, body } = document;
    const prev = { overflow: html.style.overflow, paddingRight: body.style.paddingRight };
    const gap = window.innerWidth - html.clientWidth;
    html.style.overflow = 'hidden';
    if (gap > 0) body.style.paddingRight = `${gap}px`;
    restoreScroll = () => {
      html.style.overflow = prev.overflow;
      body.style.paddingRight = prev.paddingRight;
    };
  } else if (stack.length === 0 && restoreScroll) {
    restoreScroll();
    restoreScroll = null;
  }
}

export const modalStack = {
  push: (token) => {
    stack.push(token);
    syncPageScroll();
  },
  remove: (token) => {
    const index = stack.lastIndexOf(token);
    if (index >= 0) stack.splice(index, 1);
    syncPageScroll();
  },
  isTop: (token) => stack.length > 0 && stack[stack.length - 1] === token,
  size: () => stack.length,
};

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Phần tử nhận được focus bằng Tab trong `root` (bỏ phần tử ẩn). */
export const focusableIn = (root) => (root ? [...root.querySelectorAll(FOCUSABLE)].filter((el) => el.getClientRects().length > 0) : []);

/**
 * Vị trí cần focus khi nhấn Tab trong vùng có `count` phần tử, đang ở `current` (-1 = ngoài vùng).
 * Trả về null khi để trình duyệt tự chuyển (không ở mép).
 */
export function trapTabIndex(count, current, shift) {
  if (count === 0) return -1;
  if (current < 0) return shift ? count - 1 : 0;
  if (shift && current === 0) return count - 1;
  if (!shift && current === count - 1) return 0;
  return null;
}
