---
id: FE-CASE-261016-health-follow-up-child-withdrawn
type: edge-case
screens: [health-follow-ups, children-list]
be_modules: [health, child]
rules: [HLT-01]
status: fixed
date: 2026-10-16
keywords: [phiếu theo dõi, follow-up, trẻ nghỉ học, chuyển trường, withdraw, LEFT, 403, phiếu treo]
similar_to: [FE-BUG-261016-health-follow-up-duplicate-on-edit]
---

# FE-CASE-261016-health-follow-up-child-withdrawn — trẻ nghỉ học khi phiếu theo dõi còn mở thì không ai đóng được phiếu

## Symptom
Phó hiệu trưởng hoặc Hiệu trưởng cho một trẻ nghỉ học khi trẻ còn phiếu theo dõi chưa đóng. Sau đó giáo viên lớp cũ vẫn thấy phiếu nhưng không còn nút cập nhật. Gọi đóng phiếu trả lỗi:
```text
403 Bạn không có quyền thực hiện thao tác này.
```
Phiếu ở trạng thái đang mở mãi và luôn được tính vào số "Chờ trao đổi phụ huynh" (danh sách phiếu, hộp xác nhận đóng đợt).

## Điều kiện tái hiện
Mock backend, dữ liệu demo:
1. Hiệu trưởng cho trẻ `ch_011` nghỉ học. Trẻ này có phiếu `fu_ch_011` ở trạng thái "Chờ trao đổi phụ huynh".
2. Giáo viên lớp của trẻ mở phiếu: `canUpdate = false`; gọi đóng phiếu bị 403.

## Attempts — đã thử
| # | Cách thử | Kết quả | Vì sao không đúng / bài học |
| --- | --- | --- | --- |
| 1 | Kịch bản backend giả trong scratchpad: cho trẻ nghỉ học rồi giáo viên đóng phiếu | 403, phiếu vẫn `WAITING_PARENT_CONTACT` | Xác nhận hành vi |

## Root cause
Lệch giữa quy tắc và code. Plan ghi phiếu đóng được ở mọi trạng thái, ví dụ khi trẻ chuyển trường. Nhưng:
- `canUpdateFollowUp` (`src/utils/children/childrenPermissions.js`) đòi trẻ chưa nghỉ học.
- Hiệu trưởng và Phó hiệu trưởng chỉ có quyền xem phiếu.
- `withdrawChild` không xử lý phiếu đang mở và không nhắc giáo viên đóng phiếu trước.

## Fix
User chọn tự đóng phiếu (2026-10-16, PROPOSED), plan `docs/plans/completed/2026-10-16-health-follow-up-long-lived.md`:
- `withdrawChild` gọi `closeFollowUpsOfWithdrawnChild` (`src/services/children/mock/healthCheckRule.js`): đóng phiếu đang mở, lý do "Trẻ nghỉ học: <lý do nghỉ>", sự kiện `CLOSED` có `auto: 'CHILD_WITHDRAWN'`.
- Hộp xác nhận cho nghỉ học báo trước khi trẻ có phiếu mở (`openFollowUpId` trong dữ liệu trẻ).
- Nâng cấp dữ liệu demo (seed v4) đóng phiếu còn mở của trẻ đã nghỉ học từ trước.

## Regression test
Kịch bản backend giả trong scratchpad (không lưu vào repo): cho trẻ nghỉ học thì phiếu `CLOSED` đúng lý do; DB v3 có trẻ đã nghỉ mà phiếu còn mở thì phiếu được đóng khi nâng cấp.

## Ảnh hưởng
BE cần cùng quy tắc khi làm HLT-09 và luồng cho trẻ nghỉ học.

## Lesson
Khi thêm một bản ghi có vòng đời theo trẻ, cần xét các trạng thái kết thúc của trẻ (nghỉ học, chuyển lớp) ngay khi thiết kế quyền.
