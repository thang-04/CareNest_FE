import { forwardRef } from 'react';

/**
 * Ô tích chuẩn, dùng thay cho <input type="checkbox"> viết tay. Nhãn bọc ngoài do nơi dùng quyết định (giữ bố cục danh sách).
 *
 * <label className="row gap-2"><Checkbox checked={on} onChange={toggle} /><span>Mục tiêu</span></label>
 */
export const Checkbox = forwardRef(function Checkbox(props, ref) {
  return <input type="checkbox" ref={ref} {...props} />;
});
