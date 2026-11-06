# Test theo luồng: lịch sử đánh giá và phiếu bé ngoan

Phạm vi: bản sửa BE/FE ngày 03/11/2026. Không triển khai chức năng chuyển lớp/thôi học; không đổi công thức Chất lượng tháng. Test bằng DB dev/test và trẻ giả, không chạy fixture trên production.

## 1. Chuẩn bị một lần

1. Khởi động BE, Keycloak/gateway và FE như môi trường đang dùng. Dùng chế độ nối BE (`VITE_SCHOOL_CONFIG_API=true` ở dev, hoặc đăng nhập gateway); không dùng trang ghi nhãn “Dữ liệu demo” để kết luận DB đã lưu.
2. Chọn năm học 2026–2027 đang ACTIVE, hai lớp A/B, GV-A đang dạy A và GV-B đang dạy B. Có tài khoản HT, PHT được phân công campus chứa lớp và một GV không liên quan. Dùng hai GV khác nhau, không đồng thời phân công cả hai lớp cho cùng người khi test quyền.
3. Vì màn chuyển lớp chưa làm, dùng fixture `CareNest_BE/docs/quality/fixtures/assessment-continuity.sql`. Người quản lý DB chạy bằng psql trên DB thử nghiệm với bốn tham số ID lớp/tài khoản BE. Ví dụ cú pháp (thay toàn bộ dấu ... bằng giá trị thật của môi trường test):

```powershell
psql <kết-nối-DB-test> -v class_a=... -v class_b=... -v teacher_a=... -v teacher_b=... -f D:/FULearning/Fall2026/CareNest_BE/docs/quality/fixtures/assessment-continuity.sql
```

Script chỉ thêm một trẻ `TEST Lịch sử ...`; không sửa trẻ có sẵn, tài khoản, phân công, số suất đã xác nhận hoặc cấu hình năm. Điều kiện không đúng sẽ hủy transaction. Script tạo điểm danh giả trực tiếp nên không phát event suất ăn; không dùng fixture này để kết luận báo bếp/số suất đã được cập nhật.

4. Ghi lại `child_id`, `old_confirmed_evaluation_id` và tên trẻ do script in ra. Dữ liệu: trẻ học A đến 28/10, sang B từ 29/10; tuần 26–30/10 có mặt 5 ngày, cờ tại A ngày 26/27 (2 cờ), tại B ngày 29 (1 cờ). Lớp A có nhận xét tháng đã xác nhận.
5. Mốc test là sau 30/10/2026, năm chứa tháng 10 vẫn ACTIVE. Tuần/tháng kết thúc mới phát phiếu. Mỗi lần cần test phát lại từ đầu, chạy fixture tạo trẻ TEST mới; không xóa phiếu cũ để làm lại.

## 2. GV-A: lớp cũ

| Màn / thao tác                                      | Kết quả mong đợi                                                                                                                |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Điểm danh → Tổng hợp lớp A, lọc 26–30/10            | Trẻ TEST vẫn có trong tổng hợp; 3 ngày có mặt tại A, không tính 29/30 là thiếu điểm danh ở A                                    |
| Đánh giá trẻ → Đánh giá tháng, lớp A, tháng 10      | Có nhận xét đã xác nhận của trẻ; nguồn ngày/cờ riêng A, không lấy 2 ngày hoặc cờ của B                                          |
| Phiếu bé ngoan → phát phiếu → lớp A → tuần 26–30/10 | Vẫn thấy trẻ trong lịch sử; căn cứ tuần có mặt 5, cờ 3; ô chọn bị khóa vì trẻ không thuộc A cuối kỳ, hiển thị “Chỉ xem lịch sử” |
| Tổng hợp phiếu lớp A, tháng 10                      | Cờ lớp A là 2; phiếu do B phát không cộng thành phiếu A                                                                         |

## 3. GV-B: cô đang nhận trẻ

| Màn / thao tác                                                                                 | Kết quả mong đợi                                                                                                              |
| ---------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Hồ sơ phát triển `/assessment/children` → trẻ TEST → lọc 01–31/10                              | Thấy cả dữ liệu A và B; 5 ngày có mặt, 3 cờ từ fixture                                                                        |
| Bảng đánh giá ngày trong hồ sơ                                                                 | Dòng 26–28/10 ghi lớp A, 29–30/10 ghi lớp B; nhận xét cũ không thay đổi; ngày A không có link mở nhầm vào bảng đánh giá của B |
| Mở nhận xét tháng cũ của A từ hồ sơ, hoặc `/assessment/periodic/<old_confirmed_evaluation_id>` | Mở được, đúng nội dung A; hiện chỉ xem; không có ô sửa/lưu/xác nhận/tạo lại bản nháp riêng của A                              |
| Thử sửa qua API cũ bằng phiên GV-B (người test API)                                            | Server từ chối; không chỉ ẩn nút trên FE. Nội dung A và lịch sử không đổi                                                     |
| Phiếu bé ngoan → lớp B → tuần 26–30/10                                                         | Thấy đủ 5 ngày, 3 cờ, bao gồm A. Có thể chọn trẻ chưa nhận phiếu; không phải tự nhập lại cờ A                                 |
| Chọn trẻ → phát phiếu → tải lại trang                                                          | Có đúng một phiếu; checkbox bị khóa, trạng thái đã phát; phát lần nữa bị server chặn                                          |
| Quay lại bảng phiếu A, cùng tuần                                                               | Phiếu vẫn được nhìn thấy với nhãn “Đã phát tại lớp khác”, không cho phát thêm; tổng hợp A không nhận phiếu của B              |
| Tổng hợp phiếu B, tháng 10                                                                     | Cờ riêng B là 1, phiếu B vừa phát là 1                                                                                        |

Kiểm tra thêm quyền bằng tài khoản GV không liên quan: mở URL nhận xét cũ phải bị từ chối. Nếu kết thúc phân công GV-B bằng luồng phân công hợp lệ, phiên GV-B cũng không còn được mở lịch sử theo quyền nhận trẻ; HT vẫn xem theo quyền của HT. Không thử bằng tài khoản đồng thời mang vai trò HT/PHT.

## 4. PHT: theo dõi trong phạm vi

1. Vào Hồ sơ phát triển → chọn trẻ → Tiến độ (`/assessment/children/<child_id>/progress`): xem được dữ liệu đã ghi của A/B và nhận xét đã xác nhận; không thấy bản nháp riêng, không có nút sửa của GV.
2. Vào Tổng quan đánh giá lớp → lọc tháng 10, xem A rồi B: ngày/cờ và nhận xét chung lớp nằm đúng lớp, không trộn.
3. Phiếu bé ngoan → Tổng quan → “Xem từng trẻ” ở từng lớp → lọc tháng 10: A có 2 cờ nguồn, B có 1 cờ nguồn; phiếu vừa phát thuộc B. PHT không có thao tác phát thay GV.
4. Với lớp ngoài phạm vi mà BE không cấp quyền: từ chối theo ma trận BE; không tự suy ra quyền chỉ từ menu hoặc lựa chọn campus trên FE. Kiểm tra bằng tài khoản chỉ mang vai trò PHT.

## 5. HT: kiểm tra toàn trường

1. Xem Tổng quan đánh giá, lịch sử trẻ và phiếu của cả A/B; cùng bộ lọc phải khớp kết quả nguồn của GV/PHT.
2. Mở chi tiết nhận xét đã xác nhận A: chỉ đọc nội dung, không hiện bản nháp riêng và thao tác sửa của GV.
3. Xem Chất lượng tháng 10: công thức hiện tại giữ nguyên. Không dùng kết quả này làm bằng chứng mẫu số chuyên cần giữa tháng đã được đổi hoặc số “đủ điều kiện” bằng số phiếu đã phát.
4. Đóng năm trên một DB thử nghiệm riêng (không dùng năm thật đang vận hành): mở lại báo cáo lịch sử; nguồn cũ vẫn xem được và các thao tác ghi của năm đóng bị khóa. Đây là ca hồi quy vòng đời năm, không phải yêu cầu đóng năm đang dùng để test.

## 6. Mục tiêu giáo án cũ và bản nháp

Fixture SQL tối thiểu không tạo giáo án. Để test phần mục tiêu bằng UI, cần sẵn một giáo án đã duyệt của A ngày 26/10 và của B ngày 29/10, có hai mục tiêu khác nhau; dữ liệu đánh giá giả tương ứng phải tham chiếu đúng class_doc/goal đã tồn tại. Dùng fixture tích hợp tự động `EvaluationTimelineSourcesTest` cho ca xác định: cùng ngày, giáo án B có mục tiêu khác nhưng hồ sơ vẫn giữ mục tiêu/tên mô tả A. Không tự chèn ID giáo án ngẫu nhiên vào DB.

Test tự động `AssessmentContinuityIntegrationTest` bao phủ thêm: cô nhận trẻ không đọc được bản nháp A, không sửa kết quả cũ, hết phân công bị từ chối, GV không liên quan bị từ chối, cờ A/B không trộn, bảng phiếu giữ lịch sử, căn cứ tuần xuyên lớp và chống phát trùng. `EvaluationTimelineSourcesTest` kiểm mục tiêu gốc và nhãn lớp theo từng ngày.

## 7. Cách kiểm tra lưu thật

- Sau lưu qua UI, tải lại trang/đăng xuất đăng nhập lại; kiểm tra đúng trẻ và kỳ, không chỉ toast thành công.
- Đối chiếu bằng API GET thật; với người có quyền DB, kiểm `attendance_records`, `daily_observations`, `child_evaluations`, `behaviour_tickets` theo `child_id` TEST. Phiếu phải đúng 1 bản ghi cho trẻ/loại/kỳ; bản nhận xét A không bị đổi sau GV-B xem.
- Các test PostgreSQL dùng transaction rollback của test không thay thế kiểm chứng sau commit/restart. Không chạy fixture này để thử trên DB production.
- Chưa triển khai nút chuyển lớp/thôi học; không đánh dấu PASS luồng đó chỉ từ fixture. Không đưa App vào kết quả test đợt này.

## Bằng chứng tự động của bản sửa

- BE full verify: 750 test đạt, 0 lỗi, 0 bỏ qua; ArchUnit/OpenAPI snapshot/Spotless đạt.
- FE full verify: 499 test đạt; lint/format/design/API/build đạt.
- Chrome đã kiểm actual DailyDaysTable: lớp nguồn, mục tiêu cũ và link đúng lớp; không lỗi trang. Đây không phải test trình duyệt đầy đủ qua API thật cho cả ba vai trò.
- Fixture SQL đã được chạy bằng psql trong PostgreSQL Testcontainers; dữ liệu sau commit đọc lại được từ kết nối JDBC khác. Cặp lớp sai bị chặn, không thêm trẻ.
- Hướng dẫn trên là các bước test tay để người dùng tiếp tục kiểm tra trên môi trường của mình; không tuyên bố mọi bước đã được thao tác thủ công trong lượt này.
