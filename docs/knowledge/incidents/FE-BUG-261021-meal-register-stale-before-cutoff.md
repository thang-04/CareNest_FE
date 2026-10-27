---
id: FE-BUG-261021-meal-register-stale-before-cutoff
type: bug
screens: [meal-count, attendance-entry]
be_modules: [attendance, nutrition]
rules: [NUT-03, ATT-07]
status: fixed
date: 2026-10-21
keywords: [sổ báo ăn, chưa điểm danh, chưa hoàn thành, Chồi 1, demo xác nhận sẵn, needsReconfirmation, pendingClasses]
similar_to: []
---

# FE-BUG-261021-meal-register-stale-before-cutoff — Sổ báo ăn vẫn "Chưa hoàn thành" sau khi giáo viên đã lưu điểm danh

## Symptom
PHT / HT mở Sổ báo ăn hôm nay: Lớp Chồi 1 có mặt 0, "Chưa ĐD" 6, cột Điểm danh "Chưa hoàn thành", cả 3 bữa ✓ đã xác nhận —
trong khi giáo viên Chồi 1 đã lưu điểm danh (màn Điểm danh: "Có mặt đã lưu: 6", "Đang mở").

## Điều kiện tái hiện
Mock, DB demo mới, hôm nay là ngày học, trước giờ chốt. Giáo viên Lê Minh Anh lưu điểm danh Lớp Chồi 1 → PHT mở `/attendance/meal-count`.

## Attempts
| # | Cách thử | Kết quả | Vì sao không đúng / bài học |
| --- | --- | --- | --- |
| 1 | Xem `materializeCounts` / `pastSchoolDays` | Không tạo số hôm nay trước giờ chốt | Số hôm nay đến từ chỗ khác |
| 2 | Đọc `history` của mealCounts hôm nay | AGGREGATED + CONFIRMED ngay lúc seed | Do `ensureDemoToday` (demo xác nhận sẵn, để trống Chồi 1) |

## Root cause
FE mock. `ensureDemoToday` (`attendanceMockRepository.js`) tổng hợp và xác nhận sổ hôm nay ngay khi mở app, trừ Chồi 1. Khi giáo viên lưu điểm danh
trước giờ chốt, `saveClassAttendance` chỉ đưa số mới vào "chờ xác nhận lại" khi có lần mở lại (`info.unlock`), nên sổ đã xác nhận giữ số cũ.

## Fix
`saveClassAttendance`: điểm danh đổi mà sổ của ngày đã tổng hợp (có mở lại **hoặc** đã có mealCounts) ⇒ `pendingClasses` + `needsReconfirmation`, báo PHT;
không sửa ngầm số đã xác nhận (NUT-03, ADR-0005). Kiểm: lưu 5 trẻ Chồi 1 ⇒ bữa trưa/chiều "Chờ xác nhận", Chồi 1 có mặt 5, chưa ĐD 0.

## Phòng tránh
Dữ liệu demo bỏ qua luồng thật (xác nhận sẵn) phải đi kèm đường cập nhật tương ứng khi người dùng sửa dữ liệu nguồn.
