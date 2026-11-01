---
id: FE-BUG-261101-use-async-stale-scope
type: bug
screens: [school-teachers, school-classes, school-placement, education-plan]
be_modules: [school-structure, education-plan]
rules: []
status: fixed
date: 2026-11-01
keywords: [useAsync, đổi điểm trường, đổi năm học, dữ liệu cũ, stale, deps, phân công giáo viên]
similar_to: []
---

# FE-BUG-261101-use-async-stale-scope — Đổi điểm trường/năm học: bảng vẫn là dữ liệu phạm vi cũ và thao tác được

## Symptom
`/school/teachers`: chọn Cơ sở B (`?campus=2`), bảng vẫn hiện lớp của Cơ sở A khoảng 2,5 s, không chỉ báo, nút phân công bấm được. Tương tự ở Nhóm tuổi & lớp, Xếp lớp năm học, đổi năm ở Kế hoạch giáo dục (review E2E 2026-11-01, mục đổi phạm vi).

## Điều kiện tái hiện
Hiệu trưởng, API trễ ≥1 s, đổi bộ lọc điểm trường hoặc năm học ở header.

## Attempts — đã thử
| # | Cách thử | Kết quả | Vì sao không đúng / bài học |
| --- | --- | --- | --- |
| 1 | Sửa từng trang (`loading ? <LoadingState/> : …`) | Không làm | Lỗi nằm ở hook dùng chung: 92 chỗ gọi, mỗi trang tự chọn `loading` hay `loading && !data` |
| 2 | Khóa phạm vi bằng `JSON.stringify(deps)` | Bỏ | deps có thể chứa object/hàm; dùng token `useMemo(() => ({}), deps)` so `Object.is` như React |

## Root cause
FE. `src/hooks/useAsync.js` giữ `data` của lần tải trước khi `deps` đổi và chỉ bật `loading` trong effect (sau render đầu) ⇒ trang render dữ liệu phạm vi cũ như dữ liệu hiện tại.

## Fix
`useAsync` gắn phạm vi cho `data`/`error` (`src/hooks/asyncState.js` `deriveAsyncState`): đổi deps ⇒ `data` null (cũ ở `stale`), `loading` bật ngay render đầu, thêm `initialLoading`/`refreshing`; cùng phạm vi giữ hành vi cũ. Plan: `docs/plans/active/2026-11-01-e2e-review-p1-fixes.md`.

## Regression test
`tests/hardening/use-async-scope.test.mjs`.

## Ảnh hưởng
Mọi màn dùng `useAsync` với deps theo bộ lọc: khi đổi bộ lọc sẽ thấy khung chờ thay vì dữ liệu cũ (khung chờ chỉ hiện sau 300 ms). Trang muốn giữ khung cũ thì đọc `stale` và khóa nút ghi.

## Lesson
Dữ liệu server phải gắn với khóa phạm vi đã tải; "giữ dữ liệu cũ khi tải lại" chỉ đúng khi cùng phạm vi.
