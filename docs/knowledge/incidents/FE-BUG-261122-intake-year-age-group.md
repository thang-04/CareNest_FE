---
id: FE-BUG-261122-intake-year-age-group
type: bug
screens: [children]
rules: [G94-180/CHD-11, G94-180/CHD-13]
status: fixed
date: 2026-11-22
keywords: [tiếp nhận, xếp lớp, năm học tiếp nhận, nhóm tuổi, Tất cả nhóm tuổi, lockAgeGroup, đổi năm]
---

# Tiếp nhận: đổi "Năm học tiếp nhận" không tính lại nhóm tuổi, danh sách hiện lớp mọi nhóm

## Symptom
Tiếp nhận trẻ sinh 10/03/2026, sang bước Xếp lớp. Chuyển "Năm học tiếp nhận" sang 2027-2028 thì nhóm tuổi không đổi. Quay lại 2026-2027 thì vẫn hiện danh sách lớp. Ô Nhóm tuổi bị khóa ở "Tất cả nhóm tuổi", nên hiện lớp của mọi nhóm. Kèm cảnh báo sai "Năm học chưa áp dụng nhóm tuổi phù hợp…". Đúng ra: 2026-2027 thuộc nhóm 3–12 tháng, 2027-2028 thuộc nhóm 13–24 tháng, và cả hai nhóm chưa có lớp.

## Root cause
- `src/pages/children/EnrollChildPage.jsx`: khi đổi ô năm, code đặt nhóm tuổi về rỗng và không tính lại. Chỉ lúc sang bước Xếp lớp (`toPlacement`) mới tính, mà ô năm lại nằm ngay trong bước đó.
- Có ngày sinh thì ô Nhóm tuổi bị khóa (`lockAgeGroup`). Nhóm rỗng ⇒ `ClassPlacementFields` không lọc lớp theo nhóm.
- Nhóm tuổi của năm mới tải không đồng bộ (`useClassOptions`), nên không tính lại được ngay trong `onChange`.

## Fix
Thêm effect: có ngày sinh và nhóm tuổi của năm đang chọn đã tải xong ⇒ đặt nhóm tuổi theo `suggestAgeGroupId` của năm đó. Sửa thêm câu "trong năm học đang <năm>" thành "trong năm học <năm>" (`ClassPlacementFields.jsx`).

## Attempts
- Tính lại ngay trong `onChange` của ô năm: không được, vì lúc đó `ageGroups` vẫn là của năm cũ.

## Regression test
`tests/children/intake-year-age-group.test.mjs`.

## Ảnh hưởng
Chỉ trang Tiếp nhận (gồm mở lại hồ sơ). Màn Xếp lớp không đổi năm. Code gốc (đổi năm, khóa nhóm tuổi) do Cần viết; ca này đã được nêu là A8 trong file test tác động 22/11.
