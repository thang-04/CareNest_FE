---
id: FE-BUG-261016-utc-today-date-validation
type: bug
screens: [children-enrollment, health-measurement-form, health-follow-ups]
be_modules: []
rules: []
status: fixed
date: 2026-10-16
keywords: [ngày tương lai, Ngày không được ở tương lai, UTC, múi giờ, timezone, toISOString, todayInput, 7h sáng]
similar_to: []
---

# FE-BUG-261016-utc-today-date-validation — chọn ngày hôm nay từ 0h tới 7h sáng bị báo "ở tương lai"

## Symptom
Từ 0h tới 7h sáng giờ Việt Nam, chọn ngày hôm nay trong form trẻ (ngày sinh), form kết quả khám (ngày đo) hoặc form phiếu theo dõi thì ô ngày báo lỗi:
```text
Ngày sinh không được ở tương lai
Ngày đo không được ở tương lai
Ngày không được ở tương lai
```

## Điều kiện tái hiện
Máy ở múi giờ UTC+7, mở form trước 7h sáng, chọn ngày hôm nay (ô ngày cho chọn vì `max` dùng giờ máy).

## Attempts — đã thử
| # | Cách thử | Kết quả | Vì sao không đúng / bài học |
| --- | --- | --- | --- |
| 1 | Đọc code khi sửa validation phiếu theo dõi | `today()` trong `src/utils/children/childrenValidation.js` dùng `new Date().toISOString().slice(0, 10)` | Ngày UTC chậm hơn ngày giờ máy 1 ngày từ 0h tới 7h sáng |

## Root cause
FE. `today()` của validation lấy ngày UTC, còn ô chọn ngày (`max={todayInput()}`) và người dùng dùng ngày giờ máy.

## Fix
`today` trong `src/utils/children/childrenValidation.js` dùng `todayInput` (`src/utils/format.js`), ngày theo giờ máy.

Cùng mẫu lỗi còn ở chỗ khác, chưa sửa vì ngoài phạm vi:
- `src/models/School.js:52` (`ageInMonths`, giá trị mặc định của `on`)
- `src/pages/education-plan/GoalsThemesPage.jsx:10`
- `src/pages/education-plan/GoalFormPage.jsx:154`
- `src/pages/education-plan/GoalDetailPage.jsx:172`

## Regression test
Repo chưa có framework unit test. `node scripts/verify.mjs` đạt; kịch bản backend giả dùng ngày giờ máy cho các ngày nhập.

## Ảnh hưởng
Form trẻ (ngày sinh), form kết quả khám (ngày đo), form phiếu theo dõi. Các trang education-plan còn dùng ngày UTC.

## Lesson
Ngày "hôm nay" trên giao diện luôn lấy theo giờ máy (`todayInput`), không cắt từ `toISOString()`.
