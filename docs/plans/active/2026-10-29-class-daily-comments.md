---
title: Nhận xét chung lớp trong đánh giá ngày và tổng quan
status: in-progress
owner: Nhữ Đình Cần
jira: G94-179
branch: feature/G94-179-FE-FEAT-42-school-config-api
modules: [assessment]
rules: [OBS-15, OBS-17, OBS-19]
risk: high
created: 2026-10-29
updated: 2026-10-29
---
# Nhận xét chung lớp

Plan chính: [BE daily assessment](../../../../CareNest_BE/docs/plans/active/2026-10-28-daily-assessment.md). Người dùng đã duyệt đề xuất bằng "bạn làm đi" ngày 29/10/2026.

- GV: ô nhận xét chung lớp dưới bảng Hoạt động chung; cùng nút Lưu, ghi riêng khi không có trẻ thay đổi cũng được. Giữ lần sửa lưu mặc định đã hoàn thành.
- PHT/HT: xem trong chi tiết lớp; tổng quan có chỉ dấu số nhận xét, ngày/tuần/tháng xem danh sách ngày kèm người ghi/thời gian.
- BE sở hữu quyền, khóa và dữ liệu; FE dùng cờ sheet và lỗi từ BE. Không thêm route/role, không APP/thông báo/AI.
- Contract thêm `classComment` optional vào General, response sheet có `classComment`, overview/detail có `classComments`. Adapter bỏ field khi chưa sửa để không xóa nhận xét lớp cũ.
- Mock cùng contract; không lưu nhận xét lớp vào nhận xét từng trẻ và không tăng số trẻ đã đánh giá.

## AC

1. Lưu lần đầu cả trẻ/defaults + nhận xét; sửa nhận xét riêng, tải lại giữ dữ liệu; thiếu field giữ nguyên, chuỗi rỗng xóa nội dung.
2. Ghi nhận xét không làm trẻ có cờ/đã đánh giá; danh sách tuần/tháng là nhận xét từng ngày.
3. Loading/lỗi/ngày khóa/năm đóng khóa nhập phù hợp; lỗi vẫn giữ draft, trường có label và giới hạn 500.
4. PHT scope campus, HT toàn trường; metadata người cập nhật và giờ hiện đúng, không lộ lớp khác.

## Validation / Progress

- Đã tra DESIGN §6.3: dùng card, field, textarea, hint và error sẵn có. Component riêng assessment cho ô nhập/danh sách, không tạo UI kit mới.
- 29/10: bắt đầu theo phê duyệt của người dùng; không sửa dependency/Git; full verify FE có lỗi menu trước task, kiểm chứng DB phụ thuộc Docker.
- Review phát hiện transport đổi `classComment: ''` thành null. Test qua Axios adapter giả tái hiện 5 đạt/1 lỗi; bổ sung option `preserveEmptyStrings` riêng request PUT này, không đổi mặc định các request khác. Đây là sửa kỹ thuật cần thiết để đúng contract xóa nội dung đã duyệt.
- Triển khai: `DailyAssessmentPage.jsx:352` có ô lớp/ngày dưới bảng, dùng chung Lưu và giữ draft khi lỗi; `ClassAssessmentOverviewPage.jsx:58` có danh sách nhận xét trong chi tiết, bảng có liên kết số nhận xét. Adapter/mock cùng metadata và semantics thiếu/null/rỗng; không tạo kết quả trẻ từ nhận xét lớp.
- Kiểm chứng 29/10: dashboard + hardening **56/56**, gồm 6 ca nhận xét lớp/transport và 5 ca lưu mặc định; ESLint, check-design, build và Prettier các file trong phạm vi đạt. BE full **403/403**, không skip; PostgreSQL integration, V28, ArchUnit và snapshot OpenAPI đạt. Review riêng FE/BE đã hoàn tất, lỗi transport được sửa và có test hồi quy.
- Cổng toàn FE vẫn **VERIFY FAIL** tại test menu có sẵn `AI soạn tuần` (97/98 đạt, trùng thực đơn tuần `2026-11-02`); không sửa dữ liệu seed/module menu ngoài phạm vi. `check-ai-layer` hai repo exit 0. Sẽ chạy lại verify/check-ai sau cập nhật tài liệu này; kết quả cuối ở output bàn giao.
- Còn chưa kiểm chứng: UI trình duyệt và môi trường BE đang chạy của người dùng. V28 mới chạy trên PostgreSQL tạm của test; cần restart BE dev để Flyway áp trên DB dev. Chưa commit/push. Giữ plan in-progress vì cổng toàn FE và kiểm tra UI chưa hoàn tất.
- Sau merge Tiền cùng ngày: migration nhận xét lớp nay là **V33** (đánh giá ngày V32), giữ nguyên V27–V31 đã commit của nguồn. Kết quả bên trên là baseline trước merge; xem [plan merge](2026-10-29-merge-tien-education.md) để có kiểm chứng mới, chưa áp vào DB người dùng.

- 30/10/2026: người dùng yêu cầu nhận xét chung không giới hạn ký tự. Bỏ maxLength/Size và guard 500 riêng classComment, entity TEXT; migration mới V34 đổi cột sang TEXT, không sửa V33 đã có. Test lưu/đọc 10000 ký tự; các giới hạn nhận xét từng trẻ không thay đổi. Chưa áp DB người dùng. Kiểm chứng cuối trong verify.log/target/verify.log.
