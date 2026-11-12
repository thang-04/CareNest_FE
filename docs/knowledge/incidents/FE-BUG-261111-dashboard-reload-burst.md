---
id: FE-BUG-261111-dashboard-reload-burst
type: bug
screens: [dashboard, education-plan]
be_modules: [education-plan]
rules: []
status: fixed
date: 2026-11-11
keywords: [Không kết nối được máy chủ, Không thể kết nối máy chủ, ERR_ABORTED, Đang tải dữ liệu, chậm, nghẽn, writeDb, DB_CHANGED_EVENT, useAsync, refreshOnDataChange, useWidget, getEducationPlans, Hiệu trưởng]
similar_to: [FE-BUG-261024-attendance-ready-write-loop]
---

# FE-BUG-261111-dashboard-reload-burst — Trang kế hoạch giáo dục của Hiệu trưởng báo "Không kết nối được máy chủ" sau khi đăng nhập

## Symptom

E2E (BE thật + thực đơn mock): Hiệu trưởng đăng nhập rồi mở trang kế hoạch giáo dục, khoảng 1/5 lần trang hiện "Không kết nối
được máy chủ" hoặc đứng ở "Đang tải dữ liệu…" hơn 30 giây; chạy lại thì đạt.

## Attempts — đã thử

| # | Cách thử | Kết quả | Bài học |
| --- | --- | --- | --- |
| 1 | Đo thời gian request ở log BE | Request lâu nhất 2,1 s, không 5xx | BE không chậm; vấn đề ở số lượng request |
| 2 | Nghe `requestfailed` trong Playwright | Nhiều `ERR_ABORTED` cho `/education-plans/goals`, `/school-years` | Request xếp hàng quá 15 s thì axios hủy ⇒ status 0 |
| 3 | Nới timeout danh sách kế hoạch lên 60 s | Hết báo lỗi nhưng trang vẫn đứng lâu | Chỉ che triệu chứng |
| 4 | Đếm request + vá `window.dispatchEvent` đếm `DB_CHANGED_EVENT` khi đứng yên ở trang chủ 20 s | 242 request chi tiết kế hoạch; 13 sự kiện từ `getPublishedMenu` → `getDayInfo` → `writeDb` | Nguồn là chuỗi ghi mock khi đọc |

## Root cause

Trang chủ Hiệu trưởng: khối thực đơn (mock) lần đầu đọc ghi dữ liệu giả của ngày 13 lần (`schoolMockRepository`,
`attendanceMockRepository`, `kitchenMockRepository`), mỗi lần `writeDb` phát `DB_CHANGED_EVENT`. Mọi `useAsync` có
`refreshOnDataChange` (mọi khối của trang chủ, `EducationPlanProvider`) tải lại ngay mỗi sự kiện ⇒ 13 lần tải lại cả trang,
mỗi lần `getEducationPlans` kéo danh sách + chi tiết từng kế hoạch (~17 request) ⇒ hơn 250 request dồn cục, trình duyệt chỉ
6 kết nối nên request sau xếp hàng quá timeout.

## Fix

`src/hooks/useAsync.js`: sự kiện "dữ liệu đổi" đi qua `coalesce` (`src/hooks/coalesce.js`, 500 ms) ⇒ một loạt lần ghi liền
nhau chỉ tải lại một lần. Đo lại: 242 → 44 request chi tiết trong 20 s (tải đầu + một lần sau khi mock bổ sung xong). Timeout
60 s cho danh sách kế hoạch/tài liệu lớp giữ lại (`educationPlanApi.js`, `LIST_TIMEOUT`) vì `getAll` vẫn tải chi tiết từng kế
hoạch.

Bổ sung cùng ngày: trang chủ (Hiệu trưởng, Tổ trưởng, khối "Lớp hôm nay", `dashboardService`) gọi `getEducationPlans` chỉ để lấy
`themes`/`lessons` — API thật luôn trả rỗng hai phần này nhưng vẫn tải chi tiết từng kế hoạch năm/tổ. Đổi sang
`getEducationLessons` (mock: lấy từ repo; API: trả rỗng, không gọi mạng).

## Regression test

`tests/hardening/coalesce-data-change.test.mjs` (13 lần kích hoạt ⇒ 1 lần tải; hủy khi rời màn). Toàn bộ e2e chạy lại sau
khi đổi phần nền.

## Sửa gốc (12/11/2026)

- BE: một lần mở chi tiết kế hoạch năm/tổ gọi ~260 lần tra phân công + ~50 lần đọc cấu hình duyệt (~500 truy vấn, 0,5–0,8 s).
  `utils/RequestMemo` nhớ kết quả trong một request GET cho `StaffAssignmentServiceImpl` (hasActivePrincipal/TeamLeader,
  findActiveTeamLeader/TeacherAgeGroupIds, findActiveCampusIds), `SchoolStructureServiceImpl.findAgeGroups`,
  `EduWorkflowServiceImpl.loadSettingsPolicyNode` ⇒ ~170–190 ms. Chỉ GET (request ghi không dùng bộ nhớ ⇒ không đọc dữ liệu cũ).
- FE: `getAll` chỉ trả bản tóm tắt (`summary: true`, `goalCount`, `themeCount`); trang cần nội dung gọi `useGoalDetails(ids)`
  (trang lớp qua `useClassPlanContext`, xem/sửa kế hoạch, Kế hoạch quá hạn, Duyệt, tổng hợp toàn trường). `mergeGoals` giữ chi
  tiết đã tải khi danh sách làm mới mà kế hoạch không đổi. Trang sửa chỉ chờ chi tiết ở lần mở đầu (không dựng lại biểu mẫu đang
  sửa); lập kế hoạch tổ tải trước chi tiết kế hoạch năm học nguồn (nội dung chép từ đó).
- Đo (e2e, BE 8081): trang chủ HT 3,2 s → 1,1 s; vào module 3,9–6,7 s → 1,5–1,9 s; trang lớp chỉ 1 request chi tiết.

## Còn lại

Các hàm quyền vẫn được gọi nhiều lần trong một request (chỉ còn log, không truy vấn); muốn gọn hơn thì tính quyền một lần cho
cả response.
