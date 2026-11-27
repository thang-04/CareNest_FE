import { useSyncExternalStore } from 'react';

// Trang chi tiết kế hoạch chủ đề / tuần / ngày mở ở chế độ xem; bấm Chỉnh sửa một lần là sửa được mọi tab cùng phạm vi
// (Tiền 28/11/2026). Giữ ngoài component để đổi tab (đổi đường dẫn) không mất; về trang danh sách thì xóa.
const editing = new Set();
const listeners = new Set();
const notify = () => listeners.forEach((fn) => fn());
const subscribe = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

export function setDocEditing(key, on) {
  if (editing.has(key) === !!on) return;
  if (on) editing.add(key);
  else editing.delete(key);
  notify();
}
export const isDocEditing = (key) => editing.has(key);
export function clearDocEditing() {
  if (!editing.size) return;
  editing.clear();
  notify();
}

/** Khóa gồm tài khoản để đổi người dùng không thừa chế độ sửa. */
export function useDocEditMode(key) {
  const on = useSyncExternalStore(
    subscribe,
    () => editing.has(key),
    () => false,
  );
  return [on, (value) => setDocEditing(key, value)];
}
