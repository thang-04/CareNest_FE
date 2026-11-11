---
title: Excel điểm danh, liên hệ phụ huynh và ngày tháng
status: done
owner: Cần
jira: G94-179 / FE-FEAT-42
branch: feature/G94-179-FE-FEAT-42-school-config-api
modules: [attendance, school-config, assessment]
rules: [ATT-01, ATT-04]
risk: medium
created: 2026-11-05
updated: 2026-11-05
---
# Excel điểm danh, liên hệ phụ huynh và ngày tháng

## Context
- `src/pages/attendance/AttendanceSummaryPage.jsx`: export hiện ghép dữ liệu vào một sheet, thiếu Theo trẻ ở phạm vi lớp.
- `src/services/daily-health/api/dailyHealthApi.js`: adapter BE trả `contacts: []`, chưa lấy liên hệ từ hồ sơ. Không thể kết luận hồ sơ không có số chỉ từ kết quả này.
- `src/pages/school-config/CutoffSettingPage.jsx`: ngày áp dụng dùng native date input, không bảo đảm hiển thị dd/mm/yyyy theo locale trình duyệt.
- `src/utils/dailyHealthValidation.js`: mới kiểm tra hai chữ số, một số thập phân; BE DailyHealthRequest hiện cho 10.0–99.9.

## Quyết định đã chốt
1. User yêu cầu sửa Excel, lấy liên hệ từ hồ sơ trẻ, đồng nhất ngày và rà học kỳ (05/11/2026).
2. Không sửa vai trò/quyền; không đổi dữ liệu điểm danh, cách tính suất ăn hay số liệu đánh giá.
3. Không thêm dependency; mở rộng bộ ghi XLSX hiện có và giữ tương thích các caller cũ.

## Làm rõ nghiệp vụ
- Actor: GV/PHT/HT, chỉ dữ liệu API cho phép theo phạm vi hiện có (ATT-01 CONFIRMED).
- Flow: chọn phạm vi/ngày → API tổng hợp → xuất toàn bộ khoảng lọc, không chỉ trang đang xem.
- ATT-04 CONFIRMED không đổi: không mở quyền sửa trẻ đang có đơn nghỉ.
- Liên hệ chỉ đọc hồ sơ/người giám hộ liên kết, không tạo danh bạ riêng, không tự gửi thông báo.
- Ngày hiển thị dd/mm/yyyy; request API giữ ISO yyyy-mm-dd.
- Nhiệt độ: cảnh báo lâm sàng khác giới hạn nhập. Không coi giới hạn kỹ thuật là quy định Bộ Y tế.

### Câu hỏi mở
- [x] User duyệt các sửa hiển thị/Excel/liên hệ và khóa sức khỏe bằng tin nhắn “thêm đi bạn và sửa cái này đi bạn”, 05/11/2026.
- Quyền sửa BE/FE đã được user chốt qua bảng yêu cầu. Dải nhập nhiệt độ tách thành quyết định chờ trả lời; chưa triển khai phần này trước khi chốt.

## Acceptance criteria
- AC-1: chọn một lớp, xuất workbook gồm Theo ngày và Theo trẻ, số liệu đủ khoảng lọc và khớp API; giữ trẻ lịch sử.
- AC-2: phạm vi nhiều lớp xuất Theo ngày và Theo lớp, khớp hai bảng màn hình; không đổi tên số liệu theo lớp thành theo trẻ.
- AC-3: mở liên hệ đọc nguồn hồ sơ có quyền; hiển thị rõ chưa có số, tải lỗi hoặc đang tải, không nhầm lỗi API với hồ sơ rỗng.
- AC-4: các ngày đầy đủ trong ba module hiển thị dd/mm/yyyy, API giữ ISO; không đổi ô chọn tháng thành ngày.
- AC-5: chỉ bổ sung lọc học kỳ cho danh sách/tổng hợp nhiều ngày thực sự thiếu; tái dùng cấu hình học kỳ, không hardcode mốc tháng. Các màn theo ngày giữ chọn ngày.
- AC-6 (đã thu hẹp theo user): chuẩn hóa nhập 385/38.5/38,5 thành 38.5; để trống vẫn chưa đo. Không thay dải nhập BE khi user đã chọn chờ loại nhiệt kế.

## Key decisions
| Quyết định | Đề xuất | Phương án khác | Lý do |
| --- | --- | --- | --- |
| Workbook | Hai sheet theo hai bảng của phạm vi đang xem | Luôn tải chi tiết từng trẻ của tất cả lớp | Khớp màn hình, tránh gọi thêm hàng loạt API và cộng trùng trẻ chuyển lớp |
| Nhiệt độ | Chốt dải nhập theo thiết bị, kiểm tra tại BE và FE | Chỉ chặn trên FE | FE không bảo vệ API/App |
| Học kỳ | Rà và bổ sung có mục đích | Thêm mọi màn | Màn theo ngày không cần hai bộ lọc cạnh tranh |

## Phases
### Phase 1 — Các sửa đã được user duyệt
- Thực hiện Excel hai sheet, DateInput, liên hệ hồ sơ và khóa sau trả trẻ, nhãn phiếu và tải lại danh sách chủ đề sau xác nhận.
- Tách validation nhiệt độ thành bước độc lập chờ câu trả lời; không tự chốt dải đo.
- Liên repo: [plan BE](../../../../CareNest_BE/docs/plans/completed/2026-11-05-daily-health-pickup-context.md).
- Phạm vi >8 file do gồm regression tests và hợp đồng DTO; nhóm sửa sức khỏe có plan BE riêng, nhóm export/ngày/đánh giá là client-only.
- Tests: AC-1/2 workbook parser; AC-3 adapter/service quyền và sau trả; AC-4 render/date; AC-5 rà source; kiểm xác nhận chủ đề tải cả danh sách và chi tiết, khóa trong lúc lưu.
- Exit: `node scripts/verify.mjs` ở hai repo và `node scripts/check-ai-layer.mjs`; báo output thật cùng skip/fail, review trước thay đổi thêm ngoài yêu cầu.

## Test matrix
| AC | Tầng | Kết quả |
| --- | --- | --- |
| AC-1/2 | Workbook parser và tải thật qua Chrome | Đạt 2/2 test và 44 ngày/15 trẻ |
| AC-3 | Adapter + BE integration + empty UI | Đạt; chưa UI với BE vừa restart |
| AC-4 | Dùng DateInput đã có, full FE gate | Đạt source/gate; chưa browser HT |
| AC-5 | Rà source và UI summary | Không thêm filter trùng; ticket kỳ cần contract riêng |
| AC-6 | Normalize format test và Chrome | Đạt; giới hạn số đo hoãn theo user |

## Rủi ro & rollback
Giữ tương thích API export một sheet. Không sửa dữ liệu lịch sử. Không đổi ngưỡng y tế chỉ dựa bài tổng hợp hoặc giả định giới hạn thiết bị. Rollback bằng diff từng thay đổi của task, giữ nguyên thay đổi có sẵn của user.

## Progress log
### 2026-11-05 — Chờ duyệt
- Chưa sửa source, chưa commit. Đã xác minh adapter đang gán contacts rỗng và export một sheet.
- Đã đọc nguồn chuyên môn bệnh viện về ngưỡng sốt phụ thuộc vị trí đo; chưa có nguồn quy định dải nhập liệu phần mềm.

- User 05/11/2026 yêu cầu thực hiện toàn bộ bảng sửa và khóa sau trả trẻ; bắt đầu phần đã chốt. Riêng nhiệt độ đang hỏi bằng câu hỏi bất đồng bộ.

- User chọn chờ loại nhiệt kế thực tế: giữ nguyên dải validation số hiện tại, chỉ thêm chuẩn hóa nhập 385 → 38.5; không báo lỗi 99°C đã sửa. Không đổi các ngưỡng cảnh báo hiện có.


### 2026-11-05 — Phase 1 hoàn tất phần được duyệt
- Chưa commit/push. FE: `VERIFY PASS full | npm run verify | log verify.log` (840 tests, 0 fail/skip).
- BE: `VERIFY PASS full | tests 1039 fail 0 err 0 skip 0 | archunit ok | snapshot ok | spotless ok | 672s | log target/verify.log`.
- Review độc lập không có P1/P2. Nhiệt độ min/max hoãn theo lựa chọn user, không phải phần đã sửa.
- Source và contract giữ lịch sử, không thay vai trò/quyền/App. Không restart BE đang mở ở IntelliJ; chưa full UI ba role trong lượt sửa này.
