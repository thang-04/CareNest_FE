---
id: FE-BUG-261024-menu-ai-week-verification
type: bug
screens: [menu-planning]
be_modules: [nutrition]
rules: []
status: fixed
date: 2026-10-24
keywords: [ai-week, verify, thực đơn tuần, trùng tuần, TT-20261102-MGN]
similar_to: []
---

# FE-BUG-261024-menu-ai-week-verification — Test AI soạn tuần trùng dữ liệu

## Symptom

Khi xuất sơ đồ đón trẻ, `node scripts/verify.mjs` dừng ở nhóm menu: 96 test, 95 đạt, 1 không đạt. Test `tests/menu/ai-week.test.mjs:22` báo lỗi khi lưu bản nháp tại dòng 29:

```text
Nhóm tuổi này đã có thực đơn tuần TT-20261102-MGN cho tuần đã chọn. Hãy mở bản đã có.
```

## Điều kiện tái hiện

- Ngày chạy 2026-10-24, workspace hiện tại có sẵn thay đổi ngoài tác vụ sơ đồ.
- Chạy cổng chuẩn `node scripts/verify.mjs`; task sơ đồ không chỉnh source ứng dụng hay test.
- Dữ liệu của bài kiểm thử và mã thực đơn là dữ liệu giả, không phải hồ sơ thật.

## Attempts — đã thử

| # | Cách thử | Kết quả | Vì sao không đúng / bài học |
| --- | --- | --- | --- |
| 1 | Chạy cổng chuẩn trong sandbox | `spawn EPERM`, chưa chạy được npm | Hạn chế tạo tiến trình con, chưa phải bằng chứng lỗi ứng dụng |
| 2 | Chạy cùng cổng ngoài sandbox, đọc `verify.log` | `VERIFY FAIL full`; menu 95/96, lỗi trùng tuần như trên | Cổng dừng trước nhóm đón trẻ, lint và build; không suy luận các nhóm chưa chạy là đạt |
| 3 | Chạy riêng `pickup-call-note.test.mjs` và `pickup-seed-size.test.mjs` với test loader có sẵn | 2/2 đạt, không skip | Xác minh riêng luồng đón trẻ đang mô tả; không sửa lỗi thực đơn ngoài phạm vi |
| 4 | Đọc fixture, hàm sinh seed và cách xác định tuần học | Fixture cố định 02/11/2026 trùng tuần nháp seed vào ngày chạy 24/10/2026 | Xác định xung đột phụ thuộc ngày bằng source và mã thực đơn trong log; chưa sửa test |
| 5 | 2026-10-27 (task Hiệu trưởng tiếp nhận trẻ): chạy lại riêng `ai-week.test.mjs` | Vẫn 4/5, cùng lỗi `TT-20261102-MGN` | Lỗi không phụ thuộc thay đổi đang làm; còn trùng tới khi tuần 02/11 đã qua |
| 6 | Đổi 4 tuần cố định (02/11–23/11) thành tuần tính theo hôm nay: từ 2 tuần sau tuần học hiện tại (`addDays(schoolWeekStart(todayInput()), 14)`, +7, +14, +21) | 5/5; `node scripts/verify.mjs` → `VERIFY PASS full` | Seed chỉ sinh tuần trước, tuần này, tuần sau nên từ 2 tuần sau luôn trống; tuần chưa qua nên không vướng "tuần đã qua" |

## Root cause

Fixture phụ thuộc ngày: `tests/menu/ai-week.test.mjs:18` cố định tuần `2026-11-02`; dòng 29 yêu cầu tạo mới thực đơn nhóm `ag-4`. Trong khi đó, `src/mocks/menuPlanningSeed.js:554` sinh tuần nháp của chính nhóm này ở tuần kế tiếp. `schoolWeekStart` tại `src/models/menu-planning/menuPlanningConstants.js:198` tính cuối tuần sang tuần học tới: ngày chạy thứ Bảy 24/10/2026 cho tuần hiện tại 26/10, tuần nháp kế tiếp 02/11. Vì vậy seed đã có `TT-20261102-MGN`, khớp lỗi trùng tại `menuPlanningMockRepository.js:1279`. Đây là kết luận từ đối chiếu source và log; chưa thực hiện bản sửa hay kiểm thử với thời gian cố định.

## Fix

2026-10-27: chỉ sửa test `tests/menu/ai-week.test.mjs` — tuần thử tính theo ngày chạy, bắt đầu 2 tuần sau tuần học hiện tại (seed `buildRecentWeeklyMenus` chỉ có tuần trước, tuần này, tuần sau). Không đổi seed hay quy tắc lưu thực đơn.

## Regression test

Cả 5 ca của `tests/menu/ai-week.test.mjs` đạt ngày 2026-10-27 (trước sửa: ca dòng 22 không đạt); cổng `VERIFY PASS full`.

## Ảnh hưởng

Cổng đầy đủ dừng ngay tại nhóm menu; các nhóm sau chưa được kiểm chứng qua cổng này. XML, bố cục SVG và hai test đón trẻ được kiểm riêng. Chưa có bằng chứng lỗi contract BE; BE remote không truy cập được trong lượt này.

## Lesson

Khi xuất tài liệu, báo riêng bằng chứng kiểm sơ đồ và kết quả cổng repo. Kiểm tra xung đột tuần giữa fixture và seed trước khi sửa nghiệp vụ thực đơn. Test chạm dữ liệu seed sinh theo hôm nay thì ngày thử cũng tính theo hôm nay, không cố định.
