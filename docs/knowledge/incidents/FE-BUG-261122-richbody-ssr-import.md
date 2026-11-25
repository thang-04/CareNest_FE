---
id: FE-BUG-261122-richbody-ssr-import
type: bug
screens: [announcement-compose, announcement-templates, announcement-detail]
be_modules: [notification]
rules: []
status: fixed
date: 2026-11-22
keywords: [RichBody, DOMPurify, SSR, addHook]
similar_to: []
---

# RichBody lỗi khi render server của test

## Symptom

Test render form thông báo/mẫu qua Vite SSR không nạp được `RichBody.jsx`:

```text
TypeError: __vite_ssr_import_0__.default.addHook is not a function
```

## Điều kiện tái hiện

Chạy `announcement-model.test.mjs` hoặc `template-modal.test.mjs` trong Node. Form hoặc trang chi tiết import `RichBody`; DOMPurify ở Node không có instance trình duyệt.

## Attempts — đã thử

| # | Cách thử | Kết quả | Bài học |
| --- | --- | --- | --- |
| 1 | Chạy test trong sandbox chỉ đọc worktree | Vite không ghi được `.vite-temp` (EPERM) | Chạy lại test với quyền ghi worktree để thấy lỗi code thật |
| 2 | Chạy lại test với quyền ghi | Import `RichBody` ném lỗi `addHook is not a function` | Hook phải đăng ký sau khi có DOMPurify instance của trình duyệt |
| 3 | Chỉ đăng ký hook/lọc HTML khi có `document` và `sanitize` | 33 test liên quan đạt | SSR dùng `body` chữ thường, trình duyệt lọc và hiển thị `bodyHtml` |

## Root cause

`RichBody.jsx` gọi `DOMPurify.addHook` ngay lúc import. Bản export của DOMPurify trong Node là factory, không có `addHook`; test Vite SSR import component trước khi render.

## Fix

`src/components/ui/RichBody.jsx` tạo `purifier` chỉ khi có `document` và `DOMPurify.sanitize`. SSR trả về nội dung chữ thường; trình duyệt tiếp tục lọc HTML và ép thuộc tính liên kết.

## Regression test

`node --import ./scripts/register-auth-test-loader.mjs --test --test-reporter=dot tests/notifications/announcement-model.test.mjs tests/notifications/announcement-mock.test.mjs tests/notifications/rich-text.test.mjs tests/notifications/template-modal.test.mjs` — 33 đạt sau fix; trước fix 2 test import form lỗi.

## Ảnh hưởng

Các form, trang chi tiết và bản xem trước thông báo có thể import `RichBody` trong test SSR. Không đổi contract BE/APP.

## Lesson

Component có lọc HTML cần chịu được môi trường không có DOM khi module được import.
