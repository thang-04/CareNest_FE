---
id: FE-CASE-261027-ai-week-seed-date
type: edge-case
screens: [menu-planning]
be_modules: []
rules: []
status: fixed
date: 2026-10-27
keywords: [ai-week, seed, duplicate-week, 20261102]
similar_to: []
---

# Test AI tuần trùng dữ liệu seed theo ngày chạy

## Symptom

Verify toàn FE ngày 27/10/2026 dừng ở tests/menu/ai-week.test.mjs, test lưu kết quả AI cho tuần 2026-11-02: "Nhóm tuổi này đã có thực đơn tuần TT-20261102-MGN cho tuần đã chọn. Hãy mở bản đã có."

## Attempts

| Lần | Cách | Kết quả |
| --- | --- | --- |
| 1 | Chạy verify chuẩn khi làm tự lưu giáo dục | Test thực đơn thất bại; source thực đơn chưa thay đổi |
| 2 | Đối chiếu fixture WEEK và seed recent-week | Fixture cố định 2026-11-02, seed lấy tuần theo Date hiện tại nên có thể trùng |

## Root cause

Test giả định tuần cố định luôn trống, nhưng mock seed/topUpRecentWeeklyMenus lấy ngày hiện tại. Việc xóa localStorage trong beforeEach không reset cache của mockDatabase.

## Fix

Đề nghị cố định riêng Date trong test bằng clock giả của node:test; giữ seed và validation trùng tuần trong production. Không dùng tuần ngẫu nhiên hoặc bỏ kiểm tra để qua gate.

## Regression test

Chạy riêng ai-week.test.mjs và verify chuẩn sau thay đổi; chưa có kết quả cuối tại thời điểm ghi nhận.

## Lesson

Test có seed theo ngày phải kiểm soát Date, không giả định tuần cố định chưa tồn tại.

## Kết quả kiểm chứng 27/10/2026

BE `VERIFY PASS full | tests 380 fail 0 err 0 skip 0 | archunit ok | snapshot ok | spotless ok`; FE verify chuẩn đạt sau sửa fixture Date. Bộ giáo dục gồm ca queue/retry/validation/offline mô phỏng, recovery và API stale revision; browser mock xác nhận tự lưu, bàn giao quyền, hai tab và mở lại có bản phục hồi. Không coi đây là kiểm chứng browser trên backend thật hoặc SLA mạng production.
