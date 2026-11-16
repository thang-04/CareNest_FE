# Thông báo nhà trường — Web

Phạm vi theo PAR-05/07/08/09/10 và hợp đồng `specs/902-notification-client-readiness/contracts/backend-api-map.md`. HT/PHT mở quản trị thông báo và mẫu; chỉ HT mở quy tắc và lịch. Server xác định quyền, phạm vi, số người nhận, trạng thái và `canEdit`; UI không tự cấp quyền hoặc tính lịch nghiệp vụ.

- Danh sách gọi A01 phân trang từ server; soạn/sửa gọi A03..A05 với preview, part `data` JSON và `files` lặp, lưu tệp cũ bằng ID. Hủy lịch qua A06; 409 giữ bản nhập và tải trạng thái để đối chiếu.
- Mẫu dùng A09..A12; quy tắc A13/A14 gửi đủ ba field để không mất câu chữ khi bật/tắt; lịch A15..A18 gửi lại đầy đủ cấu hình, hiển thị `nextRunAt` từ BE.
- Thông báo nhận qua A19/A20, số chưa đọc dùng server; tin trường mở A07 để đọc toàn văn, tệp A08 tải qua request có xác thực. Link giáo dục hiện có vẫn mở đích cũ, quyền nội dung thực thi theo EDU-73/74 ở BE.
- `announcements` chọn mock hoặc API qua `sourceOf`; mock là dữ liệu giả trong phiên và không chứng minh quyền thật hay gửi push thật. Mọi lỗi API giữ nguyên, không tự chuyển sang mock.

Chưa xác minh trên môi trường thật, điện thoại hoặc e2e; xem `specs/902-notification-client-readiness/verification-readiness.md` để biết kết quả và phần còn thiếu.
