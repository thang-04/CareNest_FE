---
id: FE-BUG-261020-layout-css-loaded-before-components
type: bug
screens: [layout-header]
be_modules: []
rules: []
status: workaround
date: 2026-10-20
keywords: [css order, layout.css, components.css, header, select năm học, width 100%, specificity, responsive]
similar_to: []
---

# FE-BUG-261020-layout-css-loaded-before-components — Rule trong `layout.css` bị `.btn`/`.select` đè

## Symptom

Các rule đặt trong header không có hiệu lực:
- Select năm học không rộng 196px (desktop) hay 150px (≤1024px) như `layout.css` quy định, mà chiếm 100% khối chứa nó (137px ở 768px).
- Nút "Tạo nhanh" ở điện thoại vẫn còn `padding: 16px`, icon "+" bị ép còn khoảng 2.7px.

Kết quả liệt kê rule khớp (đọc `document.styleSheets` trong trình duyệt):

```text
SEL (max-width: 1024px) .header__year-select  width: 150px
SEL                     .input, .select, .textarea  width: 100%   ← nạp sau nên thắng
BTN                     .btn  padding: ...                       ← nạp sau nên thắng
```

## Điều kiện tái hiện

Mở bất kỳ trang nào trong `MainLayout`, ở bản dev hoặc bản build. Đo `getComputedStyle(.header__year-select).width`.

## Attempts — đã thử

| # | Cách thử | Kết quả | Vì sao không đúng / bài học |
| --- | --- | --- | --- |
| 1 | Thêm `.header__create { padding: 0 }`, `.header__year-select { width: 112px }` trong `@media (max-width: 640px)` | Không ăn | Cùng độ ưu tiên với `.btn`/`.select`, mà file của chúng nạp sau |
| 2 | Tiền tố `.header .header__create`, `.header .header__year-select` + `flex: none` | Đạt ở 360/390px | Tăng độ ưu tiên; không đổi giao diện desktop |

## Root cause

`src/main.jsx` import `./App` trước `@/styles/index.css`. Vì vậy `layout.css` (import trong `MainLayout.jsx`, được kéo vào qua `App` → routes) được chèn vào trang **trước** `components.css`. Khi 2 rule cùng độ ưu tiên, rule chung trong `components.css` thắng rule riêng trong `layout.css`.

## Fix

Workaround: các rule mới trong `layout.css` có đè class chung (`.btn`, `.select`, `.input`…) thì thêm tiền tố `.header` (hoặc khối cha) để tăng độ ưu tiên. Đã áp ở `layout.css` (khối `@media (max-width: 640px)`).

Chưa sửa tận gốc. Đổi thứ tự import trong `main.jsx` sẽ làm các rule cũ của `layout.css`/`auth.css` vốn đang bị đè bắt đầu có hiệu lực, ví dụ select năm học rộng lại 196px. Như vậy là đổi giao diện desktop, phải làm thành việc riêng và so ảnh trước/sau.

## Regression test

Chưa có test tự động. Kiểm tay trên browser: ở 360px, `.header__create` rộng 36px và icon "+" rộng 17px; `.header__year-select` rộng 128px.

## Ảnh hưởng

Mọi rule trong `src/layouts/*.css` cùng độ ưu tiên với class trong `components.css`/`utilities.css`. Không liên quan BE.

## Lesson

Trong file CSS nạp theo layout, muốn chỉnh class dùng chung thì phải tăng độ ưu tiên bằng khối cha; không được giả định file nạp sau sẽ thắng.

## Bổ sung 2026-10-20 (Phase 2 mobile-baseline)

Cùng loại lỗi, xảy ra trong chính `components.css` và giữa `components.css` với file module:
- `@media (max-width: 1280px)` (khoảng dòng 2223) gập `.general-grid`, `.general-grid--inter`, `.split-2`, `.history-layout` về 1 cột. Nhưng các class này **được định nghĩa sau** khối media trong cùng file, nên rule gập không bao giờ có hiệu lực.
- `.wizard-bottom-grid`, `.review-grid`, `.assign-grid` định nghĩa ở `modules/facility-transfer.css`, nạp sau `components.css`, nên đè rule gập 1280px.
- Workaround: rule ≤640px đặt ở **cuối** `components.css` và ngay trong file module. Mốc 1280px để nguyên, vì khôi phục sẽ đổi giao diện 1024–1280px.
- `menu-planning.css`: khối `@media (max-width: 640px) { .td-food-info { … 1 cột } }` (khoảng dòng 269) nằm **trước** rule gốc `.td-food-info` / `.td-food-info .info-list { 140px … }` (khoảng dòng 1811). Hệ quả ở 360px, trang chi tiết thực phẩm (`/menu/foods/:id`): `dd` rộng **0px** nên giá trị không hiện; trang còn tràn 366px. Sửa bằng khối ≤640px đặt ngay sau rule gốc.
- Bài học khi kiểm: chỉ đo "trang có tràn ngang không" là chưa đủ. Phải kiểm thêm phần tử có chữ mà rộng < 4px (nội dung bị ép về 0).

## Bổ sung 2026-10-20 (Đổi mật khẩu)
- `modules/account.css` cũng có thể nạp **trước** `components.css`: các trang công khai (Quên mật khẩu, Đặt lại mật khẩu, OTP) import file này ngay khi tải route. Hệ quả: `.page-actions.ac-actions` (cùng độ ưu tiên) thua `.page-actions:has(.btn--primary)`, nên thanh nút trong thẻ ở `/account/password` và form sửa Hồ sơ vẫn thành thanh kính nổi, lệch lề.
- Cách thử thất bại: chỉ dựa vào "file module nạp sau". Đo `getComputedStyle` vẫn thấy `position: sticky`.
- Workaround: tăng độ ưu tiên selector (`.card .page-actions.ac-actions`, `.card > .card__body.page-actions.ac-actions`), không dựa vào thứ tự nạp.
