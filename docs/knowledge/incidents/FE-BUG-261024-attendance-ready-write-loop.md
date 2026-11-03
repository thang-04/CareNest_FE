---
id: FE-BUG-261024-attendance-ready-write-loop
type: bug
screens: [dashboard, children, attendance]
be_modules: []
rules: []
status: fixed
date: 2026-10-24
keywords: [treo, đơ, loading, skeleton, freeze, hang, writeDb, DB_CHANGED_EVENT, useAsync, thứ Bảy, cuối tuần, leaveRequests, ensureLeaveDemo]
similar_to: [FE-BUG-261023-pickup-seed-quota]
---

# FE-BUG-261024-attendance-ready-write-loop — Tab treo, trang chủ kẹt khung chờ vào thứ Bảy

## Symptom

User (Phó hiệu trưởng, mock) mở `localhost:5173` thứ Bảy 24/10/2026: trang chủ kẹt khung chờ ở mọi thẻ, bấm menu không phản hồi. Thanh địa chỉ đã đổi sang `/children` nhưng màn hình vẫn là trang chủ. Console không có lỗi.

## Điều kiện tái hiện

`VITE_USE_MOCK=true`, ngày hiện tại là thứ Bảy hoặc Chủ nhật, DB demo có đơn báo nghỉ `SUBMITTED` phủ hôm nay (seed `ensureLeaveDemo` tạo sẵn). Đăng nhập tài khoản demo bất kỳ có trang chủ gọi điểm danh/suất ăn. Không dùng dữ liệu thật.

## Attempts — đã thử

| # | Cách thử | Kết quả | Bài học |
| --- | --- | --- | --- |
| 1 | Playwright MCP đăng nhập Phó hiệu trưởng, đo `page.evaluate` | Lần đầu 3,1 s; lần sau công cụ treo 1800 s | Main thread bị chiếm liên tục, không phải lỗi render đơn lẻ |
| 2 | Chạy `tests/dashboard`, `tests/hardening` trong node | 36/36 pass | Test chỉ gọi mỗi hàm một lần; không có listener tải lại nên không lộ vòng lặp |
| 3 | Script Playwright riêng, CDP `Debugger.pause` 3 lần khi tab treo | Stack luôn là `ready → writeDb → handler (useAsync)`, qua `getAttendanceSummary`, `getDayInfo`, `getMealCounts` | Vòng ghi DB ↔ tải lại, không phải vòng `while` |

## Root cause

FE mock: `ready()` trong `src/services/attendance/mock/attendanceMockRepository.js` gọi `writeDb(ensureLeaveDemo)` khi còn đơn báo nghỉ phủ hôm nay mà trẻ chưa có điểm danh. `ensureLeaveDemo` lại bỏ qua đơn khi không phải ngày học, trẻ không `ACTIVE`, hoặc campus đã tổng hợp suất ăn. Hai điều kiện lệch nhau nên mỗi lần đọc đều ghi cả DB và phát `DB_CHANGED_EVENT`. Mọi `useAsync` trên trang nghe sự kiện, tải lại im lặng, gọi `ready()` và lại ghi. Lộ ra vào thứ Bảy 24/10/2026 vì ngày thường lần ghi đầu tạo điểm danh nên điều kiện tắt.

## Fix

Tách `leavesToRecord(db, today)` dùng chung cho `ready()` và `ensureLeaveDemo`, nên `ready()` chỉ ghi khi thực sự có đơn sẽ được ghi thành điểm danh. Không đổi luật nghiệp vụ báo nghỉ. Bài học chung: mọi `ready()`/`ensure*` trong mock repo phải bất biến (gọi lần hai không ghi), vì `writeDb` phát sự kiện làm UI tải lại.

## Regression test

- `tests/hardening/attendance-ready-idempotent.test.mjs`: thứ Bảy, đọc lần hai không phát `DB_CHANGED_EVENT`; ngày học, đơn báo nghỉ của trẻ `LEFT` không làm mỗi lần đọc ghi DB. Fail trước sửa (1 lần ghi mỗi lần đọc), pass sau sửa.
- Chrome headless local mock (24/10/2026): sau đăng nhập Phó hiệu trưởng, số lần ghi DB dừng ở 22 (seed đầu) từ giây 5 đến giây 10; trang chủ hết khung chờ; điều hướng `/children` hiện "Danh sách trẻ". Không kiểm API thật.
