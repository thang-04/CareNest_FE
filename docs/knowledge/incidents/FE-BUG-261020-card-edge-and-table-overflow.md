---
id: FE-BUG-261020-card-edge-and-table-overflow
type: bug
screens: [attendance-day-unlocks, attendance-meal-count, attendance-summary, menu-setup, children-list, facility-proposals, education-branches]
be_modules: []
rules: []
status: workaround
date: 2026-10-20
keywords: [dính mép card, card__body, padding, tràn ngang, bảng bị cắt cột, cuộn ngang, chữ xuống 3 dòng, nowrap, table-layout fixed]
similar_to: []
---

# FE-BUG-261020-card-edge-and-table-overflow — nội dung dính mép card, bảng bị cắt cột ở 1440px

## Symptom
User: "ở /attendance/day-unlocks đang bị dính liền nội dung với card to". Rà tự động thêm: bảng "Theo lớp" (Tổng hợp điểm danh) và bảng Sĩ số suất ăn bị cắt cột phải cuộn ngang; Danh sách trẻ, Đề xuất mua sắm (vai Hiệu trưởng) mất cột Thao tác; tiêu đề "Tổng quan theo nhóm tuổi" (Thiết lập dinh dưỡng) dính mép; "Tháng 9" ở Chủ đề nhánh bẻ 2 dòng.

## Điều kiện tái hiện
1440×900, mock. PHT: `/attendance/day-unlocks`, `/attendance/summary`, `/attendance/meal-count`, `/menu/setup`. HT: `/children`, `/facility/proposals` (thêm cột Điểm trường/Campus). GV: `/education/branches`.

## Attempts — đã thử
| # | Cách thử | Kết quả | Vì sao không đúng / bài học |
| --- | --- | --- | --- |
| 1 | Chụp từng màn sau đợt đồng bộ CSS | Bỏ sót lỗi chỉ xuất hiện ở vai khác (HT có thêm cột) | Phải rà theo vai, không chỉ 1 tài khoản |
| 2 | Script đo DOM (agent-browser eval) trên mọi route menu × 5 vai: phần tử lá cách mép `.card` < 8px; `.table-wrap` scrollWidth > clientWidth; chip/nút tràn ô; ô chữ ≤40 ký tự ≥3 dòng (đếm `Range.getClientRects`); trang tràn ngang | Bắt đủ lỗi trên | Ô có `rowSpan`/div con có thể báo dư; hàng `.notif-item` full-bleed là đúng thiết kế |

## Root cause
FE, có từ trước đợt đồng bộ (HEAD cũng vậy) và lộ thêm khi badge có icon rộng hơn:
- `.card` không có padding; card nào không bọc `.card__body` (`<form className="card">` ở `AttendanceDayUnlockPage.jsx`, `section.card.td-overview` ở `NutritionSetupPage.jsx`) thì nội dung chạm mép.
- `.table th { white-space: nowrap }` làm bảng số liệu nửa khung phình quá cột; vai HT có thêm cột Điểm trường/Campus.
- Bảng `ga-goal-table` dùng `table-layout: fixed`; cột Tháng mượn width cột Xóa (64px).

## Fix
- `AttendanceDayUnlockPage.jsx`: fieldset thêm `card__body`; `.dd-unlock-fields` bỏ `padding: 0`.
- `menu-planning.css` `.td-overview` padding như `card__body`.
- `attendance.css`: `.dd-summary` 2 cột đều.
- `ChildrenListPage.jsx`, `ProposalListPage.jsx`: thử gộp Điểm trường/Campus, Ngày gửi thành dòng phụ ⇒ **user bác** ("mỗi thông tin 1 cột"), đã tách lại; thêm `table--wrap-head`. Vai HT còn dư ngang ~25px (Danh sách trẻ) và ~4px (Đề xuất) — chưa xử lý, chờ user chọn cách.
- `BranchPlanPage.jsx` + `education-plan.css`: cột Tháng `.ga-col-month`, chữ `nowrap` ở div con (td bị `white-space: normal` của bảng Word ghi đè).
- Modifier chung `.table--wrap-head` (`components.css`) cho bảng nhiều cột số: Tổng hợp, Sĩ số suất ăn, Đề xuất, Thực phẩm; bỏ `.td-food-table { min-width: 980px }`.
- Đánh giá hằng ngày: thêm `table--grid` (Phase 3 plan docx) làm lề ô 8/12px ép cột tên trẻ/nhận xét ⇒ `.table.table--grid.dg-sheet` giữ lề gọn 4px như trước.

## Regression test
Chưa có test tự động UI. Kiểm: chạy lại script đo trên mọi route menu × 5 vai ⇒ 0 lỗi thật.

## Ảnh hưởng
Mọi `.card` không dùng `.card__body`; mọi bảng nửa khung có tiêu đề cột dài; danh sách hiển thị thêm cột theo vai.

## Lesson
Card không tự có lề: nội dung phải nằm trong `.card__body` (hoặc class module có padding). Bảng có cột chỉ hiện theo vai ⇒ kiểm ở vai nhiều cột nhất; không gộp cột để cho vừa.
