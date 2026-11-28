---
id: FE-BUG-261120-no-refresh-after-be-write
type: bug
screens: [children-placement, health-check-detail]
be_modules: [child, health]
rules: []
status: fixed
date: 2026-11-20
keywords: [chuyển lớp, xếp lớp, Lớp hiện tại, hủy đợt khám, Đã hủy đợt khám, không cập nhật, phải tải lại trang, refreshOnDataChange, DB_CHANGED_EVENT, axiosClient]
similar_to: [FE-BUG-261111-dashboard-reload-burst]
---

# FE-BUG-261120-no-refresh-after-be-write — Ghi thành công nhưng màn không cập nhật tới khi tải lại trang

## Symptom
Tester báo trên bản nối BE (Jira G94-396 BUG-25, G94-438 BUG-57):
- Xếp lớp › Chuyển lớp: toast "Đã chuyển lớp – … đã vào Lớp Lá 1" nhưng cột **Lớp hiện tại** vẫn là lớp cũ.
- Chi tiết đợt khám: toast "Đã hủy đợt khám." nhưng trạng thái vẫn **Đang diễn ra**, còn nút Sửa thông tin / Hủy đợt / Đóng sớm. Tải lại trang thì đúng.

## Điều kiện tái hiện
FE nối BE (`VITE_USE_MOCK=false`), HT hoặc PHT. Chuyển lớp một trẻ ở `/children/placement`, hoặc hủy một đợt khám chưa có kết quả ở `/children/health-checks/:id`. Ở chế độ mock không tái hiện.

## Attempts — đã thử (cập nhật mỗi phiên điều tra, để phiên sau không lặp lại)
| # | Cách thử | Kết quả | Vì sao không đúng / bài học |
| --- | --- | --- | --- |
| 1 | Đọc `useAsync`: `refreshOnDataChange` nghe `DB_CHANGED_EVENT` và `storage` | Chỉ mock DB (`mockDatabase.writeDb`) phát sự kiện | Ở mock mọi lần ghi tự làm màn tải lại, nên test mock không thấy lỗi |
| 2 | Đọc `beClient.call` | Chỉ phát sự kiện khi ghi `/school-years`, `/locations`, `/classes` | Module trẻ, sức khỏe gọi qua `axiosClient`, không phát gì |

## Root cause
FE. Trang dựa vào sự kiện đổi dữ liệu của mock để tự tải lại sau khi ghi; nối BE thì sự kiện không có. `ClassPlacementPage.doPlace` và `HealthCheckDetailPage.run`/`doReopen` không gọi `reload()` sau khi ghi thành công.

## Fix
Gọi `reload({ silent: true })` sau khi ghi thành công:
- `ClassPlacementPage`: tải lại danh sách trẻ và `usePlacementClasses` (sĩ số lớp nguồn, lớp đích).
- `HealthCheckDetailPage`: sau hủy, đóng sớm, mở lại; `Roster` có `key` gồm trạng thái đợt nên danh sách nhập theo lớp dựng lại và tải lại quyền nhập.

Không sửa `axiosClient`/`beClient` (vùng dùng chung): phát sự kiện sau mọi lần ghi sẽ làm mọi màn đang mở tải lại.

## Regression test
`tests/children/refresh-after-write.test.mjs` (fail trước fix, pass sau fix).

## Ảnh hưởng
Màn khác của module trẻ ghi qua `axiosClient` mà chỉ dựa `refreshOnDataChange` có thể lặp lỗi này khi nối BE. Không cần BE đổi.

## Lesson
Màn ghi dữ liệu phải tự `reload()` sau khi ghi thành công; `refreshOnDataChange` chỉ là tiện ích của mock.
