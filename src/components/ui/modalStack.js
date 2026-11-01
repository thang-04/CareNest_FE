/**
 * Stack các modal đang mở (module-level): chỉ modal trên cùng xử lý Esc và bẫy Tab,
 * để modal lồng nhau không đóng cùng lúc.
 */
const stack = [];

export const modalStack = {
  push: (token) => {
    stack.push(token);
  },
  remove: (token) => {
    const index = stack.lastIndexOf(token);
    if (index >= 0) stack.splice(index, 1);
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
