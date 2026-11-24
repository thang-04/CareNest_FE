import { forwardRef } from 'react';

/** Ô chọn một chuẩn, dùng thay cho <input type="radio"> viết tay. Nhãn bọc ngoài do nơi dùng quyết định. */
export const Radio = forwardRef(function Radio(props, ref) {
  return <input type="radio" ref={ref} {...props} />;
});
