/**
 * Props cho hàng bảng bấm được (mở chi tiết): chuột và bàn phím (Enter/Space) cùng một hành động.
 * <tr {...clickableRowProps(() => navigate(`/x/${id}`))} className="row-click">
 */
export function clickableRowProps(onActivate) {
  return {
    tabIndex: 0,
    onClick: onActivate,
    onKeyDown: (event) => {
      // Phím trong ô nhập/nút con không kích hoạt cả hàng
      if (event.target !== event.currentTarget) return;
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        onActivate(event);
      }
    },
  };
}
