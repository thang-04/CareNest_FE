---
id: FE-ENV-261015-vite-stale-intermediate-module
type: env
screens: [health-trends]
be_modules: []
rules: []
status: fixed
date: 2026-10-15
keywords: [màn hình trắng, white screen, ReferenceError, is not defined, Vite, HMR, cache, Windows]
similar_to: []
---

# FE-ENV-261015-vite-stale-intermediate-module — trắng màn Xu hướng sức khỏe do Vite giữ bản trung gian

## Symptom
Mở `/children/health-trends?childId=...` ra màn hình trắng. Console:
```text
ReferenceError: GROWTH_CHART_AXES is not defined
    at HealthTrendPage (HealthTrendPage.jsx?t=1792026101860:468:15)
```

## Điều kiện tái hiện
Dev server `npm run dev` đang chạy (Windows); sửa `HealthTrendPage.jsx` + `childrenConstants.js` bằng script ghi file nhiều lần liên tiếp (đổi import `GROWTH_CHART_AXES` → `growthAxesFor` trước, đổi chỗ dùng sau).

## Attempts — đã thử
| # | Cách thử | Kết quả | Vì sao không đúng / bài học |
| --- | --- | --- | --- |
| 1 | `node scripts/verify.mjs` | PASS (lint, prettier, build) | Build tĩnh đọc source cuối; không phản ánh module dev server đã cache |
| 2 | Chrome headless qua CDP, đăng nhập mock, mở trang, bắt `Runtime.exceptionThrown` | Bắt được ReferenceError; source hiện tại không còn tên đó | Lỗi nằm ở module dev server đang phục vụ |
| 3 | Ghi lại file (cùng nội dung) ⇒ Vite biên dịch lại; `curl` module không còn tên cũ; probe lại VP/Principal/Teacher | Trang hiện bình thường, không exception | Fix |

## Root cause
Môi trường dev (FE). Script ghi `HealthTrendPage.jsx` nhiều lần trong vài ms; watcher Vite trên Windows gộp sự kiện, biên dịch bản trung gian (import đã đổi, `axis={GROWTH_CHART_AXES.height}` chưa đổi) và không biên dịch lại bản cuối.

## Fix
Ghi lại file để Vite biên dịch lại (hoặc khởi động lại dev server) và tải lại trang. Không cần sửa source.

## Regression test
Chưa có test runner trong repo. Kiểm tay bằng script CDP: các route `/children`, `/children/new`, `/children/:id`, `/children/:id/health`, `/children/health-trends` với 3 vai trò — không exception.

## Ảnh hưởng
Chỉ môi trường dev của người đang chạy `npm run dev`; bản build không bị.

## Lesson
Khi sửa bằng script, ghi mỗi file một lần với nội dung cuối; gặp trắng màn mà source đúng ⇒ kiểm module dev server đang phục vụ trước khi sửa code.
