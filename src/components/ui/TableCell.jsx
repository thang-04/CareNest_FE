import { useEffect, useLayoutEffect, useRef } from 'react';

/* Ô nhập trong bảng kiểu bảng mục tiêu năm / giáo án (lớp CSS ga-cell-input, ga-cell-text trong education-plan.css). */

// Ô nhập tự cao theo nội dung để đọc đủ đoạn dài, không cuộn trong ô: trình duyệt có `field-sizing: content`
// (education-plan.css) thì CSS tự lo, không đo bằng JS; trình duyệt cũ mới đo
export const NATIVE_FIT = typeof CSS !== 'undefined' && !!CSS.supports?.('field-sizing', 'content');
export const fitHeight = (el) => {
  if (!el || NATIVE_FIT) return;
  el.style.height = 'auto';
  el.style.height = `${el.scrollHeight}px`;
};

/** Ô chữ trong bảng: gõ thẳng khi sửa được, chữ thường (giữ xuống dòng) khi chỉ xem. */
export function Cell({ value, onChange, editable, label, placeholder, onKeyDown }) {
  const ref = useRef(null);
  // Đo lại chiều cao sau khi bảng có độ rộng thật (lần vẽ đầu cột còn hẹp nên ô bị cao) và khi đổi cỡ cửa sổ;
  // chỉ đo khi chữ đổi hoặc đổi chế độ sửa, vì trang dài có hàng trăm ô, đo mỗi lần vẽ lại sẽ giật
  useLayoutEffect(() => {
    if (NATIVE_FIT) return undefined;
    fitHeight(ref.current);
    const id = requestAnimationFrame(() => fitHeight(ref.current));
    return () => cancelAnimationFrame(id);
  }, [value, editable]);
  useEffect(() => {
    if (NATIVE_FIT) return undefined;
    const onResize = () => fitHeight(ref.current);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  if (!editable) return <div className="ga-goal-table__pad ga-cell-text">{value?.trim() ? value : <span className="muted">—</span>}</div>;
  return (
    <textarea
      className="ga-cell-input"
      rows={1}
      ref={ref}
      onInput={(e) => fitHeight(e.target)}
      aria-label={label}
      placeholder={placeholder}
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={onKeyDown}
    />
  );
}

/** Bấm vào phần trống của ô (dưới ô nhập khi hàng cao hơn) cũng đặt con trỏ vào ô nhập, như bảng tính. */
export const focusCell = (e) => {
  if (e.target.tagName !== 'TD') return;
  const input = e.target.querySelector('.ga-cell-input');
  if (!input) return;
  e.preventDefault();
  input.focus();
};
