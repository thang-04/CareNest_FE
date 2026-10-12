# Điểm danh và sức khỏe trong ngày

Status: triển khai demo theo yêu cầu người dùng ngày 2026-10-12.

## Phạm vi đã chốt

- Web `/attendance`: hai cột, danh sách lớp bên trái và sức khỏe của trẻ đang chọn bên phải.
- Điểm danh có hai lựa chọn Có mặt/Vắng; báo ăn dùng một công tắc Tham gia ăn.
- Bổ sung theo yêu cầu người dùng 2026-10-12: nút Có mặt tất cả chọn các trẻ chưa điểm danh trong toàn bộ lớp, không ghi đè lựa chọn Vắng/Có mặt và công tắc ăn đã có. Xác nhận trước khi áp dụng; bật ăn theo đăng ký cho trẻ vừa chọn, chỉ đổi bản nháp, vẫn cần Lưu điểm danh. Nút không khả dụng sau khóa; không tạo ghi nhận sức khỏe tự động.
- Cập nhật theo yêu cầu người dùng 2026-10-12: tích Có mặt mở form sức khỏe ngay bằng bản nháp, không cần bấm lưu trước. Nút Lưu điểm danh & sức khỏe kiểm tra form, gọi service điểm danh nếu có thay đổi rồi mới gọi service sức khỏe. Hai request vẫn độc lập, không đảm bảo transaction chung.
- Nếu điểm danh thành công nhưng sức khỏe lỗi: giữ form và mã lần ghi nhận, báo rõ phần đã lưu, thử lại chỉ lưu sức khỏe khi điểm danh không thay đổi. Lỗi tải lại danh sách không unmount form. Không ghi nhận tự động cho cả lớp.
- Sau lần ghi nhận đầu có nút Thêm lần ghi nhận để mở form mới, kể cả sau khóa điểm danh. Chỉ cho nhập bản nháp khi điểm danh còn mở; sau khóa phải Có mặt đã lưu.
- Giáo viên chọn bất kỳ trẻ nào theo thứ tự đến lớp; sau khi lưu có thể chuyển đến trẻ tiếp theo.
- Khóa điểm danh không khóa ghi nhận sức khỏe; mỗi lần lưu sức khỏe thêm bản ghi mới và giữ lịch sử.
- Người dùng đã yêu cầu triển khai FE bằng dữ liệu demo trước ngày 2026-10-12. Chỉ sửa FE; không sửa BE/APP hay tạo endpoint thật chưa được chốt.

## Tương thích dữ liệu demo

Các trạng thái vắng cũ được giữ nguyên khi không đổi điểm danh. Chọn Vắng mới sử dụng trạng thái UNEXCUSED của repository hiện tại; giao diện màn tiếp nhận chỉ hiển thị Vắng. Cần BE chốt mã vắng chung trước khi tích hợp thật.

Công tắc ăn bật các bữa theo đăng ký hiện có: trẻ một bữa dùng bữa mặc định; trẻ nhiều bữa dùng các bữa hiện có. Tắt công tắc hủy các bữa trong bản nháp. Không sửa số suất đã xác nhận ở client.

## Liên hệ và thông báo phụ huynh — demo 2026-10-12

Người dùng xác nhận “Chỉ FE demo trước” và yêu cầu thu gọn UI: khi chọn NOTED, form chỉ hiện nút Liên hệ phụ huynh. Nhấn nút mở modal nhỏ gồm tên, quan hệ, số điện thoại, nút `tel:` và Đóng. Bỏ kết quả trao đổi, ghi chú nội bộ và nội dung preview khỏi form; dữ liệu cũ đã lưu không bị xóa. Bấm Gọi không tự đánh dấu đã trao đổi. Khi lưu NOTED, vẫn điều phối attendance (nếu cần) → health → notification demo; ghi nhận bình thường không tạo cảnh báo.

Outbox `parentHealthNotifications` tham chiếu `healthEntryId`, `childId`, người nhận, nội dung, thời gian và trạng thái DEMO_QUEUED. Chỉ dùng guardian ACTIVE có email làm khóa demo; không giả lập userId App. Retry dedup theo lần ghi nhận/người nhận. Thông báo lỗi không rollback health; UI hiện Gửi lại thông báo trên bản ghi cũ. Không gửi request mạng hoặc push thật, không cho rằng phụ huynh đã đọc.

Nội dung thông báo demo vẫn được tạo từ quan sát, thân nhiệt, biểu hiện, ghi chú sức khỏe, nhưng không hiển thị preview dài trên Web. Lịch sử chỉ hiện nhãn thông báo và Gửi lại khi cần. Ghi chú trao đổi nội bộ cũ không gửi. Push payload chỉ có thông báo chung, không tên trẻ/số đo/triệu chứng. Đây là nội dung demo, không quyết định policy công bố thật. Theo `BE:docs/decisions/ADR-0010-parent-visibility-policy.md`, field công bố thật còn P-13b: phải có policy/DTO phụ huynh riêng, GuardianChildLink, quyền chỉ xem con mình và deep link do BE/APP chốt. Chỉ sửa FE; không tạo endpoint thật.

## API cần thống nhất

BE `docs/modules/attendance.md` và `docs/modules/health.md` chưa có API; sức khỏe nhiều lần/ngày là yêu cầu bổ sung, không phải số đo định kỳ. Service mới chỉ dùng mock; ở chế độ API thật trả lỗi chưa hỗ trợ, không phát request tới endpoint tự đặt.

Đề xuất BE thống nhất hai nhóm: điểm danh/báo ăn lớp-ngày và danh sách/thêm ghi nhận sức khỏe trẻ-ngày. Ghi nhận cần thời gian, thân nhiệt tùy chọn, quan sát, biểu hiện, ghi chú, người ghi, khóa chống gửi trùng và quyền ghi trả từ backend. Cần chốt quyền xem trên APP phụ huynh riêng trước khi công bố dữ liệu.

## Trạng thái và lưu

Chọn lại trẻ qua dòng danh sách hoặc ô Có mặt/Vắng đã tích vẫn chuyển panel: radio đã checked không phát `change`, nên chọn trẻ không được chỉ dựa vào thay đổi điểm danh. Form đang nhập dở vẫn yêu cầu xác nhận bỏ trước khi đổi trẻ.

Loading/empty/error/403/404 dùng component chung. Form lỗi giữ dữ liệu; khóa double-submit; không đổi trẻ/lớp/ngày khi form đang có thay đổi mà chưa xác nhận bỏ. Nhập sức khỏe được phép ngay khi chọn Có mặt; repository chỉ nhận lưu khi Có mặt đã được lưu cho ngày hôm nay và giáo viên được phân công, không kiểm giờ khóa điểm danh. Bản ghi không chẩn đoán hay tự gán nhãn dinh dưỡng.

## Kiểm chứng

Liên hệ/thông báo: smoke repository PASS cho recipient/entry linkage, idempotency, generic push, 403/422/409 và giữ health sau lỗi thông báo; test điều phối PASS thứ tự attendance → health → notification và lỗi notification trả healthSaved. Browser demo PASS hiện contact khi NOTED, lưu và xem trạng thái DEMO_QUEUED, xem nội dung gửi không có ghi chú nội bộ. Chưa gửi thật/kiểm App native. `node scripts/verify.mjs` PASS; AI layer 0 lỗi, 17 cảnh báo có sẵn.

Lint, format, build: `VERIFY PASS full` sau chỉnh code cuối. Smoke repository PASS: lưu hai lần sau khóa, chống gửi trùng, chưa Có mặt/ngày quá khứ/format sai/403/404 bị từ chối, ghi nhận sức khỏe không sửa điểm danh, tổng đếm nhất quán.

Browser mock: lưu Có mặt mở form sức khỏe, lưu hai lần giữ lịch sử, đổi trẻ hỏi bỏ thay đổi và Quay lại giữ dữ liệu; 1366px hai cột, 390px một cột không tràn trang. Backend thật/APP native và luồng chuyển trẻ kế tiếp chưa được kiểm browser. Chi tiết tại `docs/plans/active/2026-10-12-daily-reception.md`.
