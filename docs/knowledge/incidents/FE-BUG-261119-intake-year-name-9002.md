---
id: FE-BUG-261119-intake-year-name-9002
type: bug
screens: [children-enroll, children-readmit, children-import]
be_modules: [child]
rules: [G94-180/CHD-11]
status: fixed
date: 2026-11-19
keywords: [tiếp nhận trẻ, Lưu hồ sơ tiếp nhận, 9002, MALFORMED_REQUEST, Dữ liệu gửi lên không đúng định dạng, schoolYearId, tên năm học, toBeSchoolYear, axiosClient]
similar_to: [BUG-261102-proxy-overrides-x-request-id]
---

# FE-BUG-261119-intake-year-name-9002 — Lưu hồ sơ tiếp nhận báo "Dữ liệu gửi lên không đúng định dạng"

## Symptom
FE nối BE, đăng nhập Hiệu trưởng, header ở năm 2026-2027 (đang hoạt động). Ở màn Tiếp nhận trẻ, bước cuối, bấm "Lưu hồ sơ tiếp nhận" thì hiện lỗi:
```text
Thất bại — Không lưu được hồ sơ
Dữ liệu gửi lên không đúng định dạng
POST /api/children/enrollments → 400 {"errorCode":9002}
```
Ở bước Xếp lớp, danh sách lớp cũng không tải được: `GET /api/children/placement-classes?schoolYearId=2026-2027` trả 400, mã 9002.

## Điều kiện tái hiện
- FE nối BE. Module children gọi BE qua `axiosClient`.
- BE chạy profile `dev`, đăng nhập Hiệu trưởng.
- Mở `/children/enroll`, nhập đủ form rồi lưu.

Lưu hồ sơ lỗi với mọi năm học. Mở lại hồ sơ và nhập Excel chỉ lỗi khi chọn năm sắp diễn ra.

## Attempts — đã thử (cập nhật mỗi phiên điều tra, để phiên sau không lặp lại)
Gọi thẳng BE bằng token client `carenest-dev`, tài khoản `principal`:

| # | Cách thử | Kết quả | Vì sao không đúng / bài học |
| --- | --- | --- | --- |
| 1 | `POST /api/children/enrollments`, body `{"schoolYearId":"2026-2027"}` | 400, `errorCode` 9002 | BE không đọc được body, nên lỗi xảy ra trước mọi kiểm tra nghiệp vụ |
| 2 | Cùng body, đổi thành `"schoolYearId":1` | 400 kèm lỗi theo từng ô (`fullName`, `dateOfBirth`, …) | BE đọc được body, vậy lỗi chỉ do kiểu dữ liệu của `schoolYearId` |
| 3 | `GET /api/children/placement-classes?schoolYearId=2026-2027`, rồi với `=1` | Lần lượt 9002 và 200 | Danh sách lớp ở bước Xếp lớp lỗi cùng lý do |

## Root cause
Lỗi nằm ở FE.

Khi nối BE, header năm học (`SchoolYearContext`) dùng tên năm làm `id`. Chỉ `beClient` tự đổi tên năm sang id số. Module children gọi BE qua `axiosClient`, nên không được đổi tự động. `childrenApi.js` chỉ gọi `toBeSchoolYear` ở danh sách trẻ và cấu trúc lớp.

Những chỗ gửi thẳng tên năm:
- `EnrollChildPage` (commit 072e2fbb, 18/11) gửi `schoolYearId: intakeYear?.id`, tức "2026-2027", mỗi lần lưu. Trang này cũng gọi `usePlacementClasses(intakeYear?.id)`.
- Mở lại hồ sơ (commit 2537bb06) gửi tên năm sắp diễn ra.
- Nhập Excel (commit 4e74faed) gửi tên năm sắp diễn ra.

BE khai các trường này là `Long`: `EnrollChildRequest`, `ReadmitChildRequest`, `ImportRequest` và `@RequestParam Long schoolYearId` của placement-classes. Vì vậy body hoặc tham số không đọc được, và `GlobalExceptionHandler.handleMalformedRequest` trả 9002 `MALFORMED_REQUEST`.

Test không phát hiện lỗi vì test FE chạy trên mock, mà mock nhận tên năm. Test BE dùng id số.

## Fix
Sửa trong `src/services/children/api/childrenApi.js`: `enrollChild`, `getPlacementClasses`, `readmitChild` và `importChildren` đổi `schoolYearId` bằng `toBeSchoolYear` trước khi gửi. Cách này giống `listChildren`, `getClassOptions` và `healthCheckApi`. Sửa ở adapter thì mọi màn gọi đều đúng, không phải sửa từng trang.

## Regression test
File `tests/children/children-api-be.test.mjs` có 4 test "… gửi id năm học BE", cho lưu hồ sơ, danh sách lớp để xếp, mở lại hồ sơ và nhập Excel. Trước khi sửa, 4 test này fail vì gửi "2026-2027" hoặc "2027-2028". Sau khi sửa, cả 4 pass.

## Ảnh hưởng
- Màn Tiếp nhận trẻ, với mọi năm học.
- Mở lại hồ sơ và Nhập Excel vào năm sắp diễn ra.

BE không cần đổi. Phần lưu hồ sơ và danh sách lớp cũng có trên `origin/dev`, từ PR #101.

## Lesson
Module gọi BE qua `axiosClient` phải đổi tên năm học sang id BE ngay ở adapter, bằng `toBeSchoolYear`. Việc này áp dụng cho mọi tham số và trường năm học, kể cả trường trong body. Test adapter cần chạy với tên năm, không chỉ với id số.
