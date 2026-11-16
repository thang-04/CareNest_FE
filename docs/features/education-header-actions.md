# Header kế hoạch giáo dục — EDU-92

Tiền chốt 17/11/2026 qua ảnh header kế hoạch năm học. Nguồn: `../CareNest_BE/docs/business/BUSINESS_RULES.md` EDU-92 và bản chuẩn `../nghiep_vu_chuan/ke_hoach_giao_duc.md`.

- Các nút header/thanh thao tác không xuống hàng; đủ chỗ thì giữ hàng ngang, thiếu chỗ thì dùng nút biểu tượng ba gạch mở bảng lựa chọn. Đo theo chiều rộng thực tế để xử lý sidebar, zoom, nhãn và quyền khác nhau, thay vì chỉ breakpoint điện thoại.
- Áp dụng toolbar ở năm/tổ xem và sửa, nhánh, gói học kỳ, chủ đề, tuần/ngày, quá hạn, cấu hình và dạy học; nhóm actions của PageHead giáo dục cũng dùng component này.
- Dùng ResponsiveToolbar chung, giữ nguyên component/action handlers, thứ tự, quyền EDU-54/90 và các trạng thái disabled. Đổi kích thước không tạo thêm bản form/hộp xác nhận và không làm mất state bên trong.
- Menu có tên truy cập, aria-expanded, focus vào control đầu khi mở, Escape trả focus, đóng khi click/focus ra ngoài. Các control gốc được giữ để menu con/hộp xác nhận tiếp tục hoạt động. Nội dung bị ẩn không nhận focus.
- Không thay nghiệp vụ, contract/API hay code BE. Không chạy e2e hoặc kiểm trực quan bằng browser trong lượt này. Xem plan để biết lệnh và giới hạn kiểm chứng.

## Điều chỉnh tiếp — Tiền 17/11/2026

Thanh thao tác nằm sát dưới header chung và trước mọi thẻ lọc/tab; bỏ khoảng trống của h1 ẩn. Nút Quay lại ở nhóm trái, chi tiết/lưu/gửi/duyệt/xuất ở phải; chip và nút phụ vẫn ở trái. Giữ một cây control, các điều kiện hiển thị/disabled, menu ba gạch và hộp xác nhận. Không dùng CSS order để đổi vị trí: thứ tự DOM và Tab phải đi qua thao tác trước bộ lọc. Thay bố cục bộ lọc/tab trước hàng nút của quyết định 12/11; căn cứ EDU-92 đã cập nhật trong bản chuẩn.

Ngoại lệ Tiền chốt tiếp 17/11/2026: trang Mở hạn/Kế hoạch quá hạn bỏ thanh header thao tác riêng; Mở hạn hàng loạt đặt sát bảng danh sách, giữ chọn nhiều dòng, mở từng dòng, quyền và hộp xác nhận.

Tiền điều chỉnh tiếp 17/11/2026 (ảnh tên Kế hoạch năm học khi cuộn): bỏ mọi tên ngắn của tài liệu/lớp/chủ đề/tuần tự hiện trong thanh thao tác khi cuộn. Tên trang vẫn ở breadcrumb/header chung; giữ nguyên trạng thái, nút, quyền và ghim thanh thao tác. Thay hành vi hiện tên ngắn lúc dính của quyết định 12/11.
