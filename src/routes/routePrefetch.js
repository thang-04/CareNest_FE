import { lazy } from 'react';
import { createRoutesFromChildren, matchRoutes } from 'react-router-dom';

/*
 * Trang lazy có thể tải trước và báo "đang mở trang".
 * BrowserRouter chuyển trang trong transition: khi chunk trang chưa về, React giữ nguyên trang cũ, khung chờ Suspense không hiện
 * ⇒ trên mạng chậm người dùng tưởng chưa bấm. Đếm chunk đang tải để hiện thanh tiến trình, và tải trước chunk theo menu.
 */
let loading = 0;
const listeners = new Set();
// Báo sau microtask: lượt tải bắt đầu ngay trong lúc React render, không cập nhật component khác giữa chừng
const emit = () => queueMicrotask(() => listeners.forEach((listener) => listener()));

export const subscribePageLoading = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
export const isPageLoading = () => loading > 0;

/** React.lazy kèm `preload()`; chỉ lượt tải do mở trang mới tính là "đang mở trang", tải trước chạy ngầm. */
export function lazyPage(factory) {
  let pending = null;
  const preload = () => {
    if (!pending) {
      pending = factory();
      // Lỗi mạng: lần sau tải lại, không giữ promise hỏng
      pending.catch(() => {
        pending = null;
      });
    }
    return pending;
  };
  const Page = lazy(() => {
    loading += 1;
    emit();
    return preload().finally(() => {
      loading -= 1;
      emit();
    });
  });
  Page.preload = preload;
  return Page;
}

let readTree = null;
let routes = null;
const done = new Set();

/** AppRoutes đăng ký cây <Route> (đọc khi cần) để tìm trang theo đường dẫn. */
export const registerRouteTree = (read) => {
  readTree = read;
  routes = null;
};

// Tìm các trang lazyPage trong element của route (trang thường bọc trong RoleGuard, Suspense…)
const collectPreloads = (node, out = []) => {
  if (Array.isArray(node)) node.forEach((child) => collectPreloads(child, out));
  else if (node && typeof node === 'object' && node.type) {
    if (typeof node.type.preload === 'function') out.push(node.type.preload);
    collectPreloads(node.props?.children, out);
    collectPreloads(node.props?.element, out);
  }
  return out;
};

/** Tải trước chunk của trang ở `pathname` (mỗi đường dẫn một lần; lỗi bỏ qua vì chỉ là tải trước). */
export function prefetchPath(pathname) {
  if (!readTree || !pathname || done.has(pathname)) return;
  done.add(pathname);
  routes ||= createRoutesFromChildren(readTree());
  (matchRoutes(routes, pathname) || []).forEach(({ route }) =>
    collectPreloads(route.element).forEach((preload) =>
      preload().catch(() => {
        done.delete(pathname);
      }),
    ),
  );
}

/** Tải trước khi trình duyệt rảnh, để không tranh băng thông với trang đang mở. */
export function prefetchWhenIdle(paths) {
  const run = () => paths.forEach(prefetchPath);
  if (typeof window.requestIdleCallback === 'function') {
    const id = window.requestIdleCallback(run, { timeout: 3000 });
    return () => window.cancelIdleCallback(id);
  }
  const id = window.setTimeout(run, 1500);
  return () => window.clearTimeout(id);
}
