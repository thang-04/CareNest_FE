---
id: FE-BUG-261018-kitchen-empty-demo-history
type: bug
screens: [mock-data, kitchen-forecast, kitchen-stock-issues, kitchen-stock-counts, attendance, children, menu-planning, education-plan, facility, account]
be_modules: []
rules: []
status: fixed
date: 2026-10-18
keywords: [mock, seed, localStorage, collection rỗng, lịch sử kho]
similar_to: []
---

# FE-BUG-261018-kitchen-empty-demo-history — DB bếp cũ giữ collection rỗng

## Symptom
Mock localStorage tồn tại nhưng một số màn thiếu dữ liệu demo khi collection đã được lưu thành array rỗng; người dùng báo một số màn rơi vào lỗi chung. Màn forecast tải được trong local mock hiện tại, nên chưa xác nhận cùng root cause với thông báo lỗi nguyên văn.

## Điều kiện tái hiện
Mock mode; localStorage có đủ các collection bếp dưới dạng array nhưng một số array lịch sử rỗng (trạng thái có thể có sau khi schema seed được thêm/cập nhật). Gọi repository đọc trang kho.

## Attempts — đã thử
| # | Cách thử | Kết quả | Vì sao không đúng / bài học |
| --- | --- | --- | --- |
| 1 | Mở `/kitchen/forecast` bằng mock auth trên Chrome với local storage hiện tại | Hiển thị dữ liệu tuần, không thấy lỗi chung | Không tái hiện trạng thái DB cũ có history arrays rỗng |
| 2 | Regression test khởi tạo mock DB, đặt history collections về `[]`, rồi đọc kho | Fail tại assertion phiếu kiểm kê mẫu; `readSeeded()` thấy mọi collection là array nên không gọi seed/backfill | Phải kiểm tra version seed demo, không chỉ kiểm tra kiểu collection |
| 3 | Chạy test sau khi thêm migration version và backfill từng collection rỗng | Pass; có lịch sử kiểm kê, giao dịch nhập, phiếu xuất, kiểm nhận, lưu mẫu; giữ forecast người dùng | Backfill cần idempotent và không thay collection đang có |
| 4 | Bổ sung assertion idempotence | Lần đầu so tổng số phiếu hai campus với kết quả riêng Campus 1, tạo fail giả; sửa assertion lọc theo campus và test pass | So phạm vi dữ liệu assertion với API đang kiểm tra |

## Root cause
Nhiều repository chỉ dùng `db[key] ||= seed` hoặc kiểm tra giá trị truthy, nên array rỗng trong localStorage cũ chặn seed; ví dụ `hasAll()` tại `src/services/kitchen/mock/kitchenMockRepository.js:539` xem các collection rỗng là đã khởi tạo. Các trang nhận danh sách rỗng thay vì fixture demo. Generic error nguyên văn chưa tái hiện trong browser mock.

## Fix
`src/mocks/mockDatabase.js` thêm migration helper versioned cho dữ liệu gốc; các repository trường/lớp, nhân sự, quyền mặc định, phụ huynh, cấu hình trường, trẻ/sức khỏe, điểm danh, đón trẻ, đánh giá, thực đơn, kế hoạch giáo dục, cơ sở vật chất và kiểm kê dùng seed hiện có để backfill một lần. Bếp có migration riêng vì history phụ thuộc tồn, thực đơn và số suất. Chỉ collection rỗng/thiếu được lấp; collection có dữ liệu cùng OTP, audit log, permission override, AI draft do người dùng tạo được giữ nguyên.

## Regression test
`legacy base DB backfills empty demo lists and preserves lists with records` và `school repository backfills empty class and child collections in a legacy DB` tại `tests/mocks/mock-seed-migration.test.mjs`; kitchen backfill test tại `tests/kitchen/mock-seed-backfill.test.mjs`. Full verify pass sau thay đổi cuối.

## Ảnh hưởng
Các route đọc seed demo có thể được bổ sung dữ liệu ở lần truy cập đầu sau khi cập nhật; dữ liệu có sẵn không bị ghi đè. Không đổi API BE/APP; dữ liệu bổ sung chỉ là fixture giả trong mock.

## Lesson
Một collection `[]` hợp lệ về kiểu vẫn có thể là DB cũ chưa nhận seed demo mới; migration seed cần marker và chỉ bổ sung khi collection rỗng.
