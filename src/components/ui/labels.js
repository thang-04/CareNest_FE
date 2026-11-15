/*
 * Nhãn chuẩn cho hành động lặp lại ở mọi màn (DESIGN.md §10). Dùng hằng số này thay vì gõ lại chữ để không lệch
 * giữa các màn ("Hủy"/"Đóng"/"Quay lại", "..." so với "…").
 */
export const LABELS = {
  save: 'Lưu',
  saving: 'Đang lưu…',
  cancel: 'Hủy', // bỏ thao tác đang nhập trong form/modal
  close: 'Đóng', // đóng màn chỉ xem
  back: 'Quay lại', // rời hộp xác nhận mà không thực hiện
  confirm: 'Xác nhận',
  add: 'Thêm',
  edit: 'Sửa',
  delete: 'Xóa',
  retry: 'Thử lại',
  resetFilters: 'Đặt lại bộ lọc',
  loading: 'Đang tải…',
  noResults: 'Không có kết quả phù hợp',
};
