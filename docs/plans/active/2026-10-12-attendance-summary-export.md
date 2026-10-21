---
title: Tổng hợp điểm danh — khoảng ngày dài, phân trang và Excel hai sheet
status: in-progress
owner: FE
jira: G94-179
branch: feature/G94-179-FE-FEAT-42-design-ui
modules: [attendance]
rules: [AUTH-08]
risk: medium
created: 2026-10-12
updated: 2026-10-12
---

# Tổng hợp điểm danh và suất ăn

## Context

`src/pages/attendance/AttendanceSummaryPage.jsx:30` kiểm giới hạn 31 ngày và `:40` xuất CSV dù nút gọi Excel. Repository demo cũng kiểm khoảng ngày ở `src/services/attendance/mock/attendanceMockRepository.js:470`. Bảng Theo ngày render cả khoảng; Theo trẻ render cả lớp. BE attendance chưa có contract summary/export (`BE:docs/modules/attendance.md`).

## Quyết định đã chốt

Người dùng 2026-10-12 yêu cầu giữ lọc từ ngày–đến ngày, mở hơn 31 ngày, chỉ phân trang Theo ngày; Theo trẻ không cần phân trang. Xuất hai sheet phù hợp. Người dùng cho phép thêm ExcelJS để làm mẫu trước khi nối BE. Chỉ FE demo, không sửa BE/APP hoặc commit/push.

## Làm rõ nghiệp vụ

Actor: người có quyền xem tổng hợp lớp hiện tại, không mở rộng scope. AUTH-08 ACCEPTED (`BE:docs/business/BUSINESS_RULES.md`) là tham chiếu cho phạm vi báo cáo; số suất dùng dữ liệu summary, không lấy số trẻ có mặt thay suất ăn. Giới hạn 31 ngày hiện là FE/mock, chưa thấy rule tương ứng trong card BE.

### Câu hỏi mở

Không còn câu hỏi về luồng; cần người dùng duyệt kế hoạch này trước đổi dependency. Policy khoảng ngày và phân trang API thật phải BE chốt riêng.

## Acceptance criteria

- AC-1: giữ Từ ngày/Đến ngày dạng dd/mm/yyyy; khoảng trên 31 ngày hợp lệ trong demo. Chặn ngày không tồn tại, đảo khoảng và tương lai, không truy vấn khi người dùng gõ dở.
- AC-2: Theo ngày có trang trước/sau, số trang và chọn 10/20/50 dòng, mặc định 20; đổi lớp/khoảng/kích thước về trang đầu. Theo trẻ giữ cả lớp. Tổng số/biểu đồ vẫn cho toàn kỳ, không đổi theo trang.
- AC-3: nút Xuất Excel xuất một .xlsx thật gồm Theo ngày và Theo trẻ, toàn bộ bộ lọc đã tải thành công. Không xuất dữ liệu cũ khi đang tải, bộ lọc sai hoặc request lỗi.
- AC-4: workbook có lớp, khoảng ngày, thời điểm xuất và nhãn demo; header rõ, cột số giữ kiểu số, ngày hiển thị dd/mm/yyyy. Trẻ có mã/tên; dữ liệu chưa điểm danh không thành Vắng. Xuất không bao gồm hồ sơ sức khỏe hoặc liên hệ phụ huynh.
- AC-5: dùng service/repository hiện tại, không đặt endpoint mới; bảo toàn loading/empty/error/403/404, lỗi xuất có thông báo. Thư viện tải khi cần xuất, không làm tăng bundle khởi động nếu tránh được.

## Key decisions

| Quyết định | Chọn                                 | Phương án khác        | Vì sao                                                       |
| ---------- | ------------------------------------ | --------------------- | ------------------------------------------------------------ |
| Xuất       | Bộ lọc hiện tại, hai sheet           | Modal chọn lại khoảng | Tránh hai bộ lọc mâu thuẫn, cô biết đang xuất dữ liệu nào    |
| Phân trang | Theo ngày, client trong demo         | Theo cả trẻ           | Ngày tăng theo kỳ, danh sách lớp nhỏ và cần đối chiếu cả lớp |
| Format     | ExcelJS .xlsx, đã được user cho phép | CSV hiện tại          | Hai sheet, dữ liệu số và định dạng ổn định                   |

## Phases

### Phase 1 — Bộ lọc và phân trang

Files: AttendanceSummaryPage.jsx, attendanceValidation.js, attendanceConstants.js, attendanceMockRepository.js; tài liệu feature.
Thay DateInput chung; bỏ giới hạn 31; validation đủ; phân trang Theo ngày; không render/export summary không khớp bộ lọc. Có thể index attendance theo child/date trong repository demo để tránh tìm tuyến tính cho từng ô khi khoảng dài.
Tests: khoảng 60 ngày, vài tháng/một năm, ngày sai/đảo/tương lai, đổi bộ lọc không hiện số cũ; paging không thay tổng. Exit: `node scripts/verify.mjs` phải VERIFY PASS full, `node scripts/check-ai-layer.mjs` exit 0. Dừng chờ review.

### Phase 2 — Xuất hai sheet

Files: package.json/package-lock.json, helper xuất Excel dành attendance, AttendanceSummaryPage.jsx, tài liệu feature/plan. Không đổi helper CSV chung hoặc màn khác.
Cài ExcelJS sau duyệt; tải động khi xuất, ghi text bằng cell string (không formula), thêm metadata/header/cột số, freeze header, autofilter. Không đổi contract thật.
Tests: mở workbook demo và đọc lại kiểm sheet/kiểu số/số dòng/toàn khoảng, xuất lúc ở trang 2 vẫn đủ dữ liệu, chặn stale/loading/error và lỗi xuất. Exit: verify/AI layer/diff check; browser desktop/mobile, ảnh bằng chứng. Dừng chờ review.

## Test matrix

| AC         | Test                                               | Phase | Kết quả                                                               |
| ---------- | -------------------------------------------------- | ----- | --------------------------------------------------------------------- |
| AC-1       | Smoke validation/repository khoảng dài và ngày lỗi | 1     | PASS: trên 31 ngày/cả năm; sai/đảo/tương lai bị chặn                  |
| AC-2       | Browser paging/đổi bộ lọc và kiểm totals           | 1     | PASS: 51 ngày; trang 2, đổi 20 về 10 dòng reset trang; tổng không đổi |
| AC-3, AC-4 | Đọc lại workbook và so với summary toàn kỳ         | 2     | Chưa chạy                                                             |
| AC-5       | Scope/error tests, lint/build và responsive        | 1, 2  | Chưa chạy                                                             |

## Rủi ro và rollback

Demo hiện tải toàn khoảng rồi phân trang UI, không giả vờ đã có server pagination. API thật cần ngày/page/size, tổng toàn kỳ và export toàn bộ cùng scope/snapshot. Khoảng cực dài có thể tốn bộ nhớ: kiểm thử năm học, không tuyên bố hiệu năng vô hạn. Dữ liệu lớp hiện hành/học sinh đã chuyển lớp chưa được lịch sử hóa đầy đủ trong demo nên không dùng file này làm quyết toán chính thức. Rollback chỉ các file thuộc scope, không reset storage hoặc bỏ thay đổi trước của user.

## Validation log

- Nguồn hiện trạng ghi ở Context, không sử dụng rule PENDING làm rule đã chốt.
- Phạm vi hơn 8 file được chia hai phase; không thay dependency ngoài ExcelJS.
- Mỗi AC có test và mỗi phase có exit verify; scope quyền không đổi.
- Không có request tới endpoint tự đặt, không sửa BE/APP.

## Progress log

### 2026-10-12 — Làm rõ cột Suất ăn trong Phase 1

Người dùng xác nhận cột Suất ăn theo tích Tham gia ăn bên điểm danh. Demo summary đếm lượt trẻ/ngày, không cộng lặp theo bữa; Theo ngày, Theo trẻ, tổng và CSV đồng nhất. Giữ số bữa riêng trong dữ liệu mock, không đổi MealCount/bếp. Contract BE thật cần phân biệt hai đơn vị này; chưa sửa BE/APP. Phase 2 chưa triển khai.

### 2026-10-12 — Chờ duyệt

Chưa sửa source/cài dependency cho task này. Người dùng đã chốt luồng và cho phép ExcelJS; kế hoạch đang draft để duyệt theo cổng làn L. Không commit.

### 2026-10-12 — Người dùng duyệt, bắt đầu Phase 1

Người dùng xác nhận làm demo UI để BE dựa theo triển khai rồi nối API. Kế hoạch được duyệt; triển khai Phase 1 trước, kiểm chứng và chờ review theo exit đã chốt. Chưa commit.

### 2026-10-12 — Phase 1 kiểm chứng, chờ review

Bỏ giới hạn 31 ngày ở validation và mock, dùng DateInput chung và phân trang riêng Theo ngày. Summary chỉ hiển thị/xuất khi khớp bộ lọc hợp lệ đã tải thành công. Mock index bản ghi theo trẻ/ngày, không thay quyền hoặc endpoint.

Smoke chạy với đồng hồ cố định 12/10/2026: khoảng nhiều tháng/cả năm, tổng ngày bằng tổng trẻ, chưa điểm danh không thành Vắng, scope lớp khác trả 403. Browser localhost: 51 ngày, trang 2/3 và 2/6, đổi kích thước về trang 1; nhập 31/02/2026 ẩn summary/nút xuất. Ảnh bằng chứng lưu ngoài repo tại outputs/attendance-summary-pagination.png trong workspace Codex. `node scripts/verify.mjs` full PASS. Chưa kiểm responsive ở Phase 1; Phase 2 sẽ kiểm desktop/mobile và workbook thật. ExcelJS chưa cài, export hiện vẫn CSV cũ, không tuyên bố hoàn tất AC-3/AC-4. Dừng chờ review theo exit Phase 1; không commit/push.
