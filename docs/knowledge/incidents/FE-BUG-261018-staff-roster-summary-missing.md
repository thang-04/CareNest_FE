---
id: FE-BUG-261018-staff-roster-summary-missing
type: bug
screens: [staff-directory, staff-assignments]
be_modules: [identity-access, school-structure]
rules: [AUTH-08]
status: fixed
date: 2026-10-18
keywords: [nhân sự, phân công theo nơi, card tổng quan, route]
similar_to: []
---

# Card tổng quan Nhân sự biến mất khi mở Phân công theo nơi

## Symptom

Từ Danh sách nhân sự, bấm “Phân công theo nơi” thì bốn card tổng quan không còn hiện. Nội dung roster vẫn tải bình thường.

## Điều kiện tái hiện

Chrome local mock, Hiệu trưởng: mở `/school/staff`, thấy bốn card; mở `/school/staff/assignments`, đợi roster tải xong, không còn card.

## Attempts

| # | Cách thử | Kết quả | Bài học |
| --- | --- | --- | --- |
| 1 | Mở trực tiếp route phân công trước khi sửa và đợi hết loading | Roster hiện, không có container “Tổng quan nhân sự” | Đây là thiếu UI theo route, không phải lỗi dữ liệu hay loading |
| 2 | Dùng component card chung ở cả hai route và đổi campus mock | Cả hai route có card; campus 1 và 2 trả số khác nhau đúng phạm vi | Truy vấn tổng quan phải nhận campus của route hiện tại |

## Root cause

FE: `StaffHubPage.jsx` đặt card trực tiếp trong JSX của route `/school/staff`; `StaffRosterPage.jsx` là route riêng và không render card. Thay đổi card ở lượt trước chỉ chạm route danh sách, nên lỗi lộ ra khi chuyển sang cách xem phân công.

## Fix

Tách `StaffSummaryCards` dùng chung cho danh sách và phân công; truyền `campusId` của roster và chờ chọn được campus trước khi hỏi dữ liệu. Khi BE contract chưa sẵn sàng, giữ nguyên màn chờ kết nối.

## Regression test

Chrome local mock: trước sửa, `/school/staff/assignments` không có card sau khi tải; sau sửa, từ `/school/staff` bấm “Phân công theo nơi” thấy bốn card, quay lại danh sách vẫn thấy bốn card. Đổi campus trong roster: số tổng/giáo viên thay đổi theo campus. `node scripts/verify.mjs` kiểm build và test repo.

## Ảnh hưởng

Hai cách xem Nhân sự của Hiệu trưởng/Phó hiệu trưởng. Không đổi BE contract hoặc APP.

## Lesson

UI dùng chung trong một khu có nhiều route phải được kiểm ở từng route và qua thao tác chuyển route, không chỉ trang mặc định.
