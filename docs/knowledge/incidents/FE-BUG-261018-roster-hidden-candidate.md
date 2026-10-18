---
id: FE-BUG-261018-roster-hidden-candidate
type: bug
screens: [staff-roster]
be_modules: [identity-access, school-structure]
rules: [AUTH-16]
status: fixed
date: 2026-10-18
keywords: [candidate, search, stale selection, assignment]
similar_to: []
---

# FE-BUG-261018-roster-hidden-candidate — Có thể lưu người không còn hiện trong tìm kiếm

## Symptom

Trong modal phân công, chọn một giáo viên rồi tìm từ khóa không có kết quả: màn báo “Không có nhân sự phù hợp” nhưng nút “Lưu phân công” vẫn bật.

## Điều kiện tái hiện

Web mock, HT, `/school/staff/assignments`: mở phân công một lớp, chọn người, tìm từ khóa không khớp ai. Không bấm lưu để tránh thay đổi dữ liệu demo.

## Attempts — đã thử

| # | Cách thử | Kết quả | Bài học |
| --- | --- | --- | --- |
| 1 | Chọn người rồi tìm rỗng | Nút Lưu vẫn bật dù radio biến mất | `personId` tồn tại độc lập với kết quả mới |
| 2 | Reset chọn khi tìm; chỉ cho lưu ID đang hiện, không lỗi/đang tải | Nút Lưu disabled trên kết quả rỗng | Kiểm điều kiện tại cả nút và hàm submit |

## Root cause

`src/pages/school-config/StaffRosterPage.jsx` giữ `personId` sau khi đổi query; điều kiện lưu chỉ kiểm ID khác rỗng, không kiểm ID thuộc page kết quả hiện tại.

## Fix

Xóa lựa chọn khi gửi tìm kiếm; `selectedCandidate` yêu cầu người được chọn nằm trong response hiện tại, khác người gọi, chưa được phân công ở nơi này, và request không đang tải/lỗi. Nút và submit cùng dùng điều kiện đó.

## Regression test

UI mock: trước fix tìm rỗng vẫn thấy nút Lưu bật; sau fix cùng bước thấy nút disabled. `node scripts/verify.mjs` chạy sau sửa cuối theo Verification.

## Ảnh hưởng

Chỉ modal phân công theo nơi FE; BE vẫn kiểm quyền/phạm vi nhưng không biết người dùng đã đổi bộ lọc trên màn.

## Lesson

Lựa chọn trong danh sách phân trang/tìm kiếm phải được vô hiệu hóa khi nguồn lựa chọn đổi; submit phải xác nhận lựa chọn vẫn thuộc kết quả hiện hành.
