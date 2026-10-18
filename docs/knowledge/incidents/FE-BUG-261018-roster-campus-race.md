---
id: FE-BUG-261018-roster-campus-race
type: bug
screens: [staff-roster]
be_modules: [identity-access, school-structure]
rules: [AUTH-08, AUTH-16]
status: fixed
date: 2026-10-18
keywords: [roster, campus, stale response, race]
similar_to: []
---

# FE-BUG-261018-roster-campus-race — Phản hồi campus cũ có thể đè campus mới

## Symptom

Review source phát hiện khi chọn nhanh điểm trường A rồi B, request A trả muộn có thể ghi roster A vào màn đang chọn B. Nếu thao tác phân công lúc đó, `campusId` hiện tại và người trong roster cũ có thể không khớp. Chưa quan sát thao tác ghi sai ở BE thật.

## Điều kiện tái hiện

Hai request roster có độ trễ đảo thứ tự: B hoàn thành trước A. Bài test dùng Promise trì hoãn có kiểm soát, không dùng dữ liệu thật.

## Attempts — đã thử

| # | Cách thử | Kết quả | Bài học |
| --- | --- | --- | --- |
| 1 | Cho hai request cập nhật cùng state theo thời điểm hoàn thành | Test đỏ: `['c2', 'c1']` | `useAsync` hiện có không loại response cũ theo khóa campus |
| 2 | Cổng request mới nhất + kiểm `campusId` trong response | Test xanh: chỉ nhận `c2`; response sai campus báo lỗi | Cần chặn cả stale response lẫn data sai identity |

## Root cause

`useStaffRoster` trước đây dùng `useAsync`, nên request không có generation guard; `StaffRosterPage` trước đây cũng không so `roster.campusId` với campus đang chọn.

## Fix

`src/utils/account/rosterRequestGate.js` chỉ cho request mới nhất cập nhật state và kiểm campus trong response. Hook roster dùng gate; trang chỉ render roster khớp campus, đóng modal khi đổi campus và kiểm campus trước khi kết thúc phân công.

## Regression test

`tests/auth/roster-request.test.mjs`: test delayed A/B và response sai campus đã đỏ trước fix, xanh sau fix. `node scripts/verify.mjs` chạy sau sửa cuối theo Verification.

## Ảnh hưởng

FE phân công theo nơi; BE vẫn kiểm quyền và scope nhưng HT có quyền cả hai campus nên FE phải tự giữ đúng ngữ cảnh màn.

## Lesson

Server state phụ thuộc khóa lựa chọn như campus phải gắn identity vào request và kiểm response trước khi cho thao tác ghi.
