# Sửa phòng của lớp và khởi động local — 23/11/2026

- Phạm vi: form sửa lớp của cấu hình trường; không đổi nghiệp vụ/phân quyền BE.
- Nguyên nhân: ClassResponse dùng schoolYearId; form nạp cls nguyên trạng nhưng validateClass yêu cầu schoolYear. Đổi phòng rồi lưu bị chặn ở FE, trong khi trường năm học chỉ đọc không hiển thị lỗi đó.
- Sửa: nạp schoolYear từ trường UI, trường API hoặc năm đang chọn. Giữ nguyên phòng mới, nhóm tuổi, điểm trường và kiểm tra sĩ số hiện hành.
- Kiểm chứng: Node children suite 196/196 đạt, 0 skip; gồm hai ca thao tác form thật (nạp lớp, đổi phòng, bấm lưu) với shape API và mock. ESLint file source đạt. Chưa xác nhận luồng bằng trình duyệt: phiên CUA hết thời gian kết nối.
- Local BE: đã sao lưu DB carenest_test_20261121 trước thao tác; đối chiếu script/checksum chính xác, chuyển lịch sử own169/170 sang172/173 và chạy hai migration169/170 của dev. Đã thử trước trên DB kiểm thử. Không sửa checksum hoặc SQL đã commit, không tắt validation.
- BE khởi động native Maven profile dev thành công, Flyway validate188 migrations. Sau compile lại, bean AuthStateStoreImpl được tạo bình thường; không sửa mã tài khoản. Dừng đúng tiến trình BE vừa khởi động để trả cổng8080 cho IntelliJ.
- Số liệu trước/sau đồng bộ local:289 trẻ,11972 điểm danh,11340 đánh giá ngày, giữ nguyên.
- Đồng bộ dependency bằng npm ci --legacy-peer-deps như workflow deploy của repo; không đổi package/lockfile. Vite build và ESLint toàn bộ source đều đạt sau đồng bộ. Khôi phục Vite5173 và phiên kiểm thử5174.
- Gateway local qua /be-api: cookie CSRF/session do BE phát Path=/api/auth không được trình duyệt gửi đến /be-api/auth. Bổ sung cookiePathRewrite trong proxy Vite để giữ nguyên kiểm tra CSRF và quyền BE; không sửa mã tài khoản. Đã thử HTTP qua5175: cookie XSRF-TOKEN có Path=/be-api/auth, đăng nhập principal được chấp nhận và trả409/1017 yêu cầu chọn phiên đang dùng (không tự xác nhận takeover). ESLint và Prettier vite.config.js đạt. Lần thử ban đầu không rewrite trả403/1101.
