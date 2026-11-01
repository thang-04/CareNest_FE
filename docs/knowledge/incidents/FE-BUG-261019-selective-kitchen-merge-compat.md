---
id: FE-BUG-261019-selective-kitchen-merge-compat
type: bug
screens: [kitchen, menu-planning, dashboard, attendance]
be_modules: [nutrition, attendance]
rules: [ATT-02, AUTH-08, NUT-01, NUT-03]
status: fixed
date: 2026-10-19
keywords: [selective merge, meal sessions, MORNING, legacy preparation, seed migration, confirmed count]
similar_to: [FE-BUG-261018-merge-children-pickup-bindings]
---

# FE-BUG-261019-selective-kitchen-merge-compat — Ghép bếp mới làm lệch consumer cũ

## Symptom

Review tĩnh phát hiện constant bếp có thêm MORNING làm đổi điều kiện kitchenReady trong attendance không có source diff; màn số suất mới bỏ lớp chưa có menu. Test tích hợp phát hiện helper legacy thiếu import nhãn bữa. Test nguồn còn yêu cầu đổi sidebar/chốt ngày/xóa handover trái quyết định ghép.

## Điều kiện tái hiện

Ghép dinh dưỡng/bếp e69d376 vào dev 43e680b nhưng giữ attendance/auth/sidebar/phân công dev. Dùng mock giả, không dữ liệu thật. Xem plan `../../plans/active/2026-10-18-selective-nutrition-permission-merge.md`.

## Attempts — đã thử

| #   | Cách thử                                                                       | Kết quả                                                                                                                | Bài học                                                                          |
| --- | ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| 1   | Nhập module nguồn và chạy menu/kitchen/build                                   | Thiếu export legacy dashboard; test đòi chốt ngày hoặc sidebar mới; mẫu Excel chưa được chép                           | Không đổi protected code để chiều test nguồn; chuyển test sang AC đã duyệt       |
| 2   | Nối session cấu hình và review độc lập                                         | Phát hiện consumer attendance còn dùng MEAL_SESSIONS hai bữa; weekly forecast giả định LUNCH; wrapper cũ sai shape/URL | Byte-exact source không chứng minh được tương thích dependency                   |
| 3   | Tách contract legacy, thêm adapter cho counts/forecast/route/history           | Menu 43/43; integration 9/10, lỗi thiếu import MEAL_SESSION_LABELS                                                     | Giữ source số suất và dữ liệu cũ; kiểm tra luồng legacy thực sự, không chỉ build |
| 4   | Bổ sung import, test legacy confirm và điều chỉnh migration/test nguồn theo AC | Đang verify cuối Phase 1                                                                                               | Chỉ ghi fixed sau kết quả mới nhất                                               |

Ngày 2026-10-19: đã bổ sung regression doanh thu campus có nhóm MORNING-only và nhóm LUNCH/AFTERNOON (130, không cộng trùng); filter bếp hỗ trợ ba bữa, updater legacy giữ hai bữa. Kết quả mới: menu 43/43, kitchen 33/33, integration 11/11; `node scripts/verify.mjs` → VERIFY PASS full. Browser smoke Principal đọc thực đơn tuần, số suất, quy trình bếp và kho khô; chưa kiểm mutation/role khác hoặc API thật. AI-layer ban đầu lỗi vì thêm bảng index riêng khiến parser chỉ nhận bảng đầu; đã đưa incident vào bảng chung, 0 lỗi/17 cảnh báo baseline.

## Root cause

Contract phía client khác nhau giữa hai nhánh: attendance phụ thuộc `models/kitchen/kitchenConstants.js` cho readiness; bếp mới dựa trên snapshot theo bữa và tuần; caller dashboard cũ cần wrapper `record/hasMenu` thay raw rows. Không phải thay đổi BE.

## Fix

Tách ALL_MEAL_SESSIONS mới khỏi danh sách readiness legacy, lấy session theo lớp/năm học cho bếp; giữ raw count khi chưa có menu; forecast không giả định LUNCH và tôn trọng cờ không ăn. Giữ xử lý nốt chế biến legacy chỉ khi DB đã có collection cũ; ID route cũ chuyển sang query id. Migration không seed lại collection rỗng hoặc xuất lại các ngày đã chốt trước nâng cấp.

## Regression test

`tests/integration/selective-merge/kitchen-compat.test.mjs`; các bộ `tests/menu/` và `tests/kitchen/`. Output cuối và review ghi ở Progress log của plan; chưa xác nhận browser/API thật trong incident này.

## Ảnh hưởng

Chỉ client mock FE; không sửa BE/App. Contract thật vẫn chờ BE, không suy luận tính đúng API từ test mock.

## Lesson

Merge chọn lọc phải kiểm tra consumer gián tiếp, trạng thái dữ liệu cũ và URL cũ; không chỉ giữ nguyên file được bảo vệ hoặc giải conflict văn bản.
