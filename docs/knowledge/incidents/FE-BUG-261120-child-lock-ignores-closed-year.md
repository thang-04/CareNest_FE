---
id: FE-BUG-261120-child-lock-ignores-closed-year
type: bug
screens: [children-edit, children-profile, children-list, health-checks, health-record, parent-accounts]
be_modules: [child, health]
rules: [CFG-YR-01, G94-180/CHD-12]
status: fixed
date: 2026-11-20
keywords: [năm học đã kết thúc, CLOSED, chỉ xem, Sửa hồ sơ, Lưu thay đổi, Tạo đợt khám, yearLocked, yearReadOnly, useChildYearLock]
similar_to: []
---

# FE-BUG-261120-child-lock-ignores-closed-year — Năm học đã kết thúc vẫn sửa hồ sơ trẻ, vẫn tạo đợt khám

## Symptom
Tester báo (Jira G94-395 BUG-24, G94-424 BUG-45): header chọn năm **2025–2026 · Đã kết thúc**, vẫn mở được **Sửa hồ sơ** và nút **Lưu thay đổi**; màn Đợt khám, kỳ cân đo vẫn hiện hai nút **Tạo đợt khám**.

## Điều kiện tái hiện
HT hoặc PHT, header chọn năm có trạng thái `CLOSED`. Mở `/children/:id/edit` hoặc `/children/health-checks`.

## Attempts — đã thử (cập nhật mỗi phiên điều tra, để phiên sau không lặp lại)
| # | Cách thử | Kết quả | Vì sao không đúng / bài học |
| --- | --- | --- | --- |
| 1 | Grep `yearLocked`, `yearReadOnly` trong `src/pages/children` | Màn trẻ, sức khỏe chặn ghi bằng `useSchoolYear().yearLocked`; chỉ Tiếp nhận, Nhập Excel, Xếp lớp xét thêm `yearReadOnly` | `yearLocked` của header chỉ là năm sắp diễn ra chưa tới ngày mở chuẩn bị (CHD-12) |

## Root cause
FE. Cờ khóa của module trẻ bỏ sót năm đã kết thúc, trái `BE:docs/business/BUSINESS_RULES.md` CFG-YR-01 (năm CLOSED chỉ đọc ở mọi module, FE ẩn thao tác ghi theo `yearReadOnly`).

## Fix
Hook `src/hooks/children/useChildYearLock.js` = `yearLocked || yearReadOnly`; 12 trang và 2 danh sách nhập theo lớp lấy cờ khóa từ hook này. `YearLockedNotice` thêm câu năm đã kết thúc "Năm học đã kết thúc. Bạn chỉ có thể xem thông tin <subject>." kèm nút chuyển về năm đang hoạt động. Danh sách trẻ giữ `prepLocked` (CHD-12) cho thẻ, câu "Sắp nhập học".

BE: không cần đổi. Hồ sơ trẻ không gắn năm học; BE chặn sửa hồ sơ, khai báo của trẻ đã nghỉ (`CHILD_ALREADY_LEFT`). Đợt khám mới phải bắt đầu từ hôm nay nên không rơi vào năm đã kết thúc.

## Regression test
`tests/children/closed-year-lock.test.mjs`, `tests/children/year-locked-notice.test.mjs` (fail trước fix, pass sau fix).

## Ảnh hưởng
Màn Đón trẻ không đổi (việc trong ngày luôn theo năm đang hoạt động).

## Lesson
Khóa ghi theo năm học phải xét cả năm đã kết thúc (CFG-YR-01) lẫn năm chưa tới ngày mở chuẩn bị (CHD-12); dùng `useChildYearLock` cho màn trẻ, sức khỏe.
