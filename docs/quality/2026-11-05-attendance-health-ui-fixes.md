# Kiểm chứng sửa UI điểm danh, sức khỏe và đánh giá — 05/11/2026

## Phạm vi
User duyệt các mục sửa và khóa sức khỏe sau trả. Không sửa vai trò/quyền, App, số liệu/tính suất ăn, dữ liệu lịch sử. Nhãn quan hệ chuyển sang model dùng chung; account giữ re-export, không đổi chức năng tài khoản.

## Kết quả hiện có
- FE `node scripts/verify.mjs`: `VERIFY PASS full | npm run verify | log verify.log`; 840 tests, fail 0, skip 0. Có warning cũ ImportGoalFileModal và annotation build, không lách cổng.
- BE targeted `PickupIntegrationTest,OpenApiSnapshotTest`: 6 tests, fail/error/skip 0 trên PostgreSQL Testcontainers. Snapshot cộng thêm contacts/handedOverAt và schema DailyHealthContact, không đổi endpoint/request.
- RED: PickupIntegrationTest sau trả canRecord=true; GREEN canRecord=false, giờ trả đúng; lần từ chối trả vẫn ghi được, liên hệ đúng nguồn, teacher khác lớp bị chặn.
- Excel RED thiếu multi-sheet; GREEN parser đọc hai sheet, tiếng Việt/số/chuỗi giống công thức, không mất dòng. UI thật 44 ngày học/15 trẻ, tổng Có mặt 600 ở cả hai sheet, khớp UI (20 dòng/trang).
- Chrome nhập 385, 38.5, 38,5 đều hiển thị 38.5; không lưu bản ghi sức khỏe thử vào DB trong lượt này.
- Chrome mở liên hệ không còn vùng trắng khi thiếu dữ liệu. Nguồn có số xác minh bằng adapter + BE integration, chưa xác minh browser với BE vừa khởi động lại.
- Chủ đề đã xác nhận ở Chrome: dropdown và badge đều Đã xác nhận, không ô lưu ý/nút xác nhận. Handler regression giữ response/list chậm để kiểm khóa input, dùng response xác nhận khóa ngay và đợi list tải xong mới toast.
- DateInput thay native input ở ngày áp dụng giờ chốt; payload vẫn ISO. Chưa kiểm bằng tài khoản HT trên browser trong lượt này.
- BE `node scripts/verify.mjs`: `VERIFY PASS full | tests 1039 fail 0 err 0 skip 0 | archunit ok | snapshot ok | spotless ok | 672s | log target/verify.log`. Surefire có dòng cảnh báo kết thúc fork sau 30 giây nhưng kết quả cuối full gate exit 0, không test skip/fail.
- Review độc lập cuối không phát hiện P1/P2; kiểm nhãn dùng chung, chuẩn hóa và focus reload.

## Cách kiểm thử lại
1. HT → Cấu hình thời gian → Giờ chốt: ngày áp dụng hiển thị dd/mm/yyyy; chọn lịch/nhập tay và kiểm ngày sai hoặc ngoài năm bị báo lỗi.
2. GV → Tổng hợp điểm danh → chọn khoảng >31 ngày, trang 20 dòng → Xuất Excel: một lớp có Theo ngày/Theo trẻ, đủ toàn khoảng; chọn nhiều lớp có Theo ngày/Theo lớp.
3. GV → Điểm danh → chọn trẻ có mặt → sức khỏe: nhập 385/38.5/38,5; đều hiển thị 38.5. Không nhập nhiệt độ vẫn giữ luồng nhắc chưa đo hiện có.
4. Chọn Có dấu hiệu → Liên hệ: đối chiếu với hồ sơ; có số/thiếu số/không liên hệ và lỗi API phải phân biệt. Đổi trẻ không hiện số trẻ cũ.
5. Xác nhận trả trẻ ở Đón trẻ → quay lại sức khỏe: không thêm lần mới; lịch sử vẫn xem. POST trực tiếp mới bị 5008. Lần xác minh không trả không khóa. Dùng trẻ demo và môi trường test vì trả trẻ không hỗ trợ hủy.
6. Phiếu bé ngoan: badge Đủ điều kiện · chưa phát chỉ đếm eligible chưa có ticket, không bao gồm đã phát. Phát phiếu giữ nghiệp vụ hiện có.
7. Chủ đề nháp có thể xác nhận: mạng chậm → ô mục tiêu/lưu ý/bộ lọc bị khóa trong lúc lưu; xác nhận xong detail và dropdown cùng Đã xác nhận, không sửa/in trạng thái cũ. Lưu thất bại giữ nội dung.

## Giới hạn và phần chờ
- User chọn CHỜ loại nhiệt kế thực tế: chưa sửa dải nhập, nên lỗi nhập 99°C chưa được đóng. Không ghi dải 30–45°C là chuẩn Bộ Y tế.
- Học kỳ: tổng hợp điểm danh, đơn nghỉ, báo cáo chất lượng năm và đánh giá kỳ đã có. Màn theo ngày không cần thêm bộ lọc học kỳ. Tổng hợp phiếu hiện năm/tháng; muốn tổng theo học kỳ cần contract BE hỗ trợ khoảng kỳ, không cộng số liệu ở UI.
- Không chạy lại toàn bộ ba role qua browser; test source/integration không được gọi là full E2E.
- Chưa commit/push; giữ cấu hình và các file WIP có sẵn của user.
