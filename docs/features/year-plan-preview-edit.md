# Kế hoạch năm học — chỉnh sửa trên một trang

Nguồn mới nhất: user chốt bố cục trong chat ngày 02/11/2026 và cho phép sửa CareNest_FE · CONFIRMED. Thay quyết định giữ ba bước ngày 28/10 và điều hướng bước ngày 01/11.

- Lập/sửa ở `/education/goals/new` và `/education/goals/:id/edit`: nhập/lấy dữ liệu ở đầu → 1. Thông tin chung → 2. Chủ đề, sự kiện trong năm → 3. Mục tiêu, nội dung giáo dục.
- Bỏ stepper, tab, phần Duyệt lại nội dung và thanh nút Đóng/Tiếp theo ở đáy. URL cũ có `?buoc=` vẫn mở toàn bộ form; không tạo lịch sử bước.
- Nhập file, lấy mục tiêu từ kế hoạch có sẵn/Chương trình của Bộ ở đầu trang; điện thoại dùng menu Lấy mục tiêu hiện có. Lấy chủ đề từ kế hoạch có sẵn ở phần Chủ đề. Xuất ở đầu trang, vẫn mở bản xem trước trước khi tải/in.
- Giữ cơ chế lưu tay/Ctrl+S, gửi/ban hành, phiên sửa, khôi phục và cảnh báo rời màn theo [module BE](../../../CareNest_BE/docs/modules/education-plan.md), EDU-03/10/22/23/24/28/43/46; chỉ đổi UX Web.
