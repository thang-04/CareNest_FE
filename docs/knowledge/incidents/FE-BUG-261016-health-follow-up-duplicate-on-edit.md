---
id: FE-BUG-261016-health-follow-up-duplicate-on-edit
type: bug
screens: [health-measurement-form, health-follow-ups]
be_modules: [health]
rules: [HLT-01]
status: fixed
date: 2026-10-16
keywords: [phiếu theo dõi, follow-up, Cần theo dõi sát, CLOSE_WATCH, sửa kết quả, phiếu trùng, thông báo lặp]
similar_to: [FE-CASE-261014-health-role-flow-alignment]
---

# FE-BUG-261016-health-follow-up-duplicate-on-edit — sửa kết quả của phiếu đã đóng mở thêm phiếu mới

## Symptom
Giáo viên sửa một kết quả khám ở mức "Cần theo dõi sát" (chỉ sửa ghi chú) sau khi phiếu theo dõi của kết quả đó đã đóng. Hệ thống mở thêm một phiếu "Chờ trao đổi phụ huynh" và gửi lại thông báo "Trẻ cần theo dõi sát" cho Hiệu trưởng và Phó hiệu trưởng. Link phiếu ở dòng kết quả trong Sổ sức khỏe vẫn trỏ về phiếu đã đóng.

## Điều kiện tái hiện
Mock backend, giáo viên lớp của trẻ:
1. Nhập kết quả ngoài đợt (kết quả ngoài đợt không bị khóa) ở mức "Cần theo dõi sát" ⇒ phiếu mở.
2. Đóng phiếu, ghi lý do.
3. Sửa ghi chú của chính kết quả đó ⇒ có thêm phiếu thứ hai.

Kết quả trong đợt đang diễn ra cũng bị, nếu phiếu được đóng trước khi đóng đợt.

## Attempts — đã thử
| # | Cách thử | Kết quả | Vì sao không đúng / bài học |
| --- | --- | --- | --- |
| 1 | Kịch bản gọi thẳng backend giả (bundle esbuild, localStorage giả, trong scratchpad): lưu, đóng phiếu, sửa ghi chú | Trước khi sửa: 2 phiếu (`CLOSED`, `WAITING_PARENT_CONTACT`), 4 thông báo. Sau khi sửa: 1 phiếu, 2 thông báo | Tái hiện được, xác nhận root cause |

## Root cause
FE mock. `trackFollowUp` (`src/services/children/mock/healthCheckRule.js`) chạy cả khi tạo lẫn khi sửa kết quả (`saveMeasurement`). Hàm chỉ tìm phiếu **chưa đóng** của trẻ. Kết quả đã nằm trong một phiếu đã đóng thì không tìm thấy, nên hàm mở phiếu mới.

## Fix
`trackFollowUp` bỏ qua kết quả đã thuộc một phiếu bất kỳ, kể cả phiếu đã đóng. Chỉ một kết quả mới (lần khám sau) ở mức "Cần theo dõi sát" mới mở phiếu mới, khớp quy tắc đã chốt và câu chữ trong hộp xác nhận đóng phiếu. Mỗi kết quả thuộc tối đa một phiếu.

## Regression test
Repo chưa có framework unit test. Đã chạy kịch bản backend giả trong scratchpad, không lưu vào repo:
- Sửa ghi chú không mở phiếu mới.
- Lần khám sau vẫn mở phiếu mới.
- Bộ kịch bản cũ 44/44 đạt; nâng cấp DB cũ đạt; số liệu các đợt đã đóng không đổi.

## Ảnh hưởng
Chỉ ảnh hưởng mock FE. Khi BE làm HLT-09 (đề xuất trong plan `docs/plans/completed/2026-10-15-health-check-campaign-assessment.md`), cần cùng quy tắc: sửa kết quả không tạo phiếu mới nếu kết quả đã gắn với một phiếu.

## Lesson
Logic "tự tạo bản ghi khi lưu" chạy cả ở nhánh sửa phải kiểm tra bản ghi nguồn đã được xử lý chưa, không chỉ kiểm tra bản ghi đang mở.
