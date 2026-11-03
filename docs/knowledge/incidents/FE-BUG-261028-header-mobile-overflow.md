---
id: FE-BUG-261028-header-mobile-overflow
type: bug
screens: [layout-header, education-plan]
be_modules: []
rules: []
status: fixed
date: 2026-10-28
keywords: [header, mobile, overflow, 390px, notification]
similar_to: [FE-BUG-261020-layout-css-loaded-before-components]
---

# Header tràn ngang ở viewport 390px

## Symptom

Chromium, viewport 390 × 844, mock Phó hiệu trưởng: document scrollWidth 424px, clientWidth 390px. Nút thông báo có cạnh phải khoảng 422.55px, badge khoảng 423.55px.

## Điều kiện tái hiện

Browser context riêng, dữ liệu giả; mở danh sách `/education/goals` hoặc chi tiết kế hoạch. Không cần vào chế độ sửa.

## Attempts — đã thử

| # | Cách thử | Kết quả | Bài học |
| --- | --- | --- | --- |
| 1 | Đo sau thay đổi preview bảng | Document rộng 424px; khối `.ga-page` vẫn nằm trọn trong 390px | Cần tách nội dung trang khỏi header |
| 2 | Điều hướng sang danh sách kế hoạch chưa sửa source | Vẫn 424/390px | Hiện tượng cũng có ở màn danh sách, không riêng bảng preview mới |

## Root cause

Chip năm học `.header__year` để `flex: none`, ô chọn bên trong rộng theo lựa chọn dài nhất ("2027 - 2028 · Sắp diễn ra") nên không co; nút Tạo nhanh và chuông bị đẩy ra ngoài màn (đo 2026-10-31: document 424px ở 360/375/390px).

## Fix

`src/layouts/layout.css` khối ≤640px: chip `flex: 0 1 auto; min-width: 0`, ô chọn `width: 100%`, cắt chữ một dòng; `.header__center` `flex: 1 0 auto` để kính lúp không bị ép về 0 và chip co trước. Máy tính không đổi.

## Regression test

Mock (tests/e2e/ui) và BE thật ở 360/375/390px: scrollWidth = clientWidth trên trang chủ và danh sách kế hoạch; bảng nhiều cột vẫn cuộn trong `.table-wrap`.
