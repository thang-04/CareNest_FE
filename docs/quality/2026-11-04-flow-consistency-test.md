# Kiểm thử lại các bản sửa liên kết luồng — 04/11/2026

Chỉ dùng tài khoản và dữ liệu thử. BE chạy PostgreSQL; FE có thể nối API hiện tại, không cần thay contract. Không đổi công thức chất lượng tháng, bé chăm, bé ngoan hay bé ngoan toàn diện trong đợt sửa này.

## 1. Điểm danh và đơn nghỉ từ phụ huynh

Khi App chưa làm, dùng Swagger hoặc API client với token tài khoản phụ huynh để gửi/hủy đơn; không cần sửa App trong đợt này.

1. Mở cùng ngày/lớp ở giáo viên và một client phụ huynh. Giáo viên đánh dấu hai trẻ có mặt, chưa lưu; nhập thân nhiệt cho trẻ đang chọn.
2. Phụ huynh gửi đơn nghỉ cho trẻ đang chọn. Quay lại cửa sổ giáo viên hoặc chờ tối đa 30 giây khi không có thao tác lưu đang chạy.
3. Trẻ đó chuyển sang vắng có phép và không được sửa điểm danh. Bản nháp của trẻ còn lại phải giữ nguyên. Nội dung sức khỏe đang soạn phải còn thấy ở chế độ chỉ đọc, không được lưu cho trẻ đang vắng.
4. Thử nút bỏ nội dung sức khỏe: phải có xác nhận, không xóa lần ghi nhận đã lưu. Nếu không bỏ, hủy đơn nghỉ trước giờ chốt ở client phụ huynh rồi quay lại giáo viên; chọn có mặt phải nhập tiếp được nội dung cũ.
5. Thử phụ huynh gửi đơn ngay trước khi giáo viên bấm lưu: nếu server từ chối batch, màn phải tải lại trạng thái nghỉ, giữ các thay đổi chưa lưu của trẻ khác để cô lưu lại. Không được báo toàn bộ batch đã lưu khi server từ chối.
6. Trong lúc refresh đang chờ, bấm lưu hoặc đổi lớp/ngày: phản hồi cũ không được đè kết quả mới.

## 2. Suất ăn khi hai lớp cùng thay đổi

1. Cùng một campus/ngày, chuẩn bị hai lớp có điểm danh và số suất đã xác nhận. Ghi lại số đang cung cấp cho bếp.
2. Hai giáo viên ở hai cửa sổ cùng đổi điểm danh của hai lớp và lưu gần như đồng thời.
3. Cả hai thay đổi phải xuất hiện ở phần số suất chờ xác nhận lại; không lỗi trùng dòng, không mất thay đổi của lớp nào. Số đã xác nhận cho bếp giữ nguyên cho đến khi xác nhận lại.
4. PHT đúng campus hoặc HT xác nhận lại rồi kiểm tra số mới. Thử điều chỉnh suất thay thế và thay đổi điểm danh tiếp; giữ quy tắc thay thế hiện có.

## 3. Năm học và ngày nghỉ

1. Tạo năm học dự kiến, thêm ngày nghỉ trong năm. Thu hẹp ngày bắt đầu/kết thúc để loại ngày nghỉ đó: phải bị từ chối bằng lỗi ngày nghỉ ngoài năm; dữ liệu năm và ngày nghỉ giữ nguyên.
2. Đặt một ngày thứ Hai là ngày nghỉ, gọi màn có sử dụng lịch học rồi xóa năm dự kiến theo điều kiện được phép. Ngày đó không còn bị coi là nghỉ do dữ liệu của năm đã xóa.
3. Thay danh sách ngày nghỉ rồi đọc lại lịch: phải phản ánh dữ liệu đã commit, không giữ bản cache cũ.

## 4. Nhận xét chung tháng của lớp

1. Với lớp thuộc năm tháng 9 đến tháng 5, thử lấy, lưu và xác nhận nhận xét tháng 8 trước năm: server phải từ chối. Thử tương tự tháng sau khi năm kết thúc.
2. Nếu năm bắt đầu giữa tháng 9 hoặc kết thúc giữa tháng 5, hai tháng biên vẫn hợp lệ; dữ liệu tổng hợp chỉ lấy khoảng thực tế trong năm.
3. Giáo viên lớp lưu nhận xét, HT/PHT có phạm vi được phân công xem lại. Người ngoài phạm vi vẫn bị chặn như trước.

## 5. Gửi đồng thời và mở lại điểm danh

1. Gửi hai yêu cầu ghi sức khỏe cùng người thao tác và cùng request UUID: cả hai trả cùng mã lần ghi nhận, DB chỉ có một bản ghi.
2. HT/PHT hợp lệ đồng thời mở lại cùng lớp/ngày: chỉ có một quyền mở đang hiệu lực; yêu cầu còn lại nhận lỗi đã mở. Thu hồi quyền vừa tạo rồi kiểm tra không còn quyền mới nào cho phép sửa.
3. Các quyền trùng đã tồn tại từ trước không được tự xóa trong bản sửa này; kiểm tra và thu hồi qua luồng được cấp quyền nếu dữ liệu thử cũ có trường hợp đó.

## Bằng chứng tự động

- BE: `FlowConsistencyIntegrationTest`, `MealCountConcurrencyIntegrationTest`, `ConcurrentReceptionIntegrationTest` chạy với PostgreSQL; `node scripts/verify.mjs` đạt 1.001 test, không fail/error/skip, kiến trúc, API snapshot và Spotless đều đạt.
- FE: 6 test hòa giải điểm danh và 2 test giữ bản nháp sức khỏe; bộ kiểm tra đầy đủ đạt 797 test, không fail/skip, có build và lint.
- Chrome trên trang `/attendance` thật với mock adapter đã kiểm tra gửi/hủy đơn nghỉ, giữ bản nháp trẻ khác và giữ/khóa/mở lại bản nháp sức khỏe. Đây không phải kiểm thử trình duyệt xuyên suốt với API thật; cần thao tác các bước trên khi nghiệm thu môi trường tích hợp.

Kế hoạch và nhật ký hoàn tất: [BE](../../../CareNest_BE/docs/plans/completed/2026-11-04-flow-consistency-repairs.md), [FE](../plans/completed/2026-11-04-attendance-leave-reconciliation.md). Incident và ISSUE_INDEX tương ứng đã ghi nguyên nhân, các lần thử và bản sửa.
