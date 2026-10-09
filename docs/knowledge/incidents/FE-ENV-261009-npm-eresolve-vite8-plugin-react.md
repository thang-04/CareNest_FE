---
id: FE-ENV-261009-npm-eresolve-vite8-plugin-react
type: env
screens: [build, npm install]
be_modules: []
rules: []
status: workaround
date: 2026-10-09
keywords: [npm install, ERESOLVE, peer dependency, vite 8, "@vitejs/plugin-react", legacy-peer-deps]
similar_to: []
---

# FE-ENV-261009-npm-eresolve-vite8-plugin-react — `npm install <gói>` lỗi ERESOLVE vì vite 8 lệch peer với plugin-react 4

## Symptom

Cài bất kỳ gói mới (lần gặp: `@tabler/icons-react`) đều dừng ở bước giải peer dependency, không do gói đang cài:

```text
npm error code ERESOLVE
npm error While resolving: @vitejs/plugin-react@4.7.0
npm error Found: vite@8.3.3
npm error peer vite@"^4.2.0 || ^5.0.0 || ^6.0.0 || ^7.0.0" from @vitejs/plugin-react@4.7.0
```

## Điều kiện tái hiện

`package.json` có `"vite": "^8.3.3"` và `"@vitejs/plugin-react": "^4.3.4"` (đang trong thay đổi chưa commit trên `dev`), chạy `npm install <gói>` trên Windows, npm 10+.

## Attempts — đã thử (cập nhật mỗi phiên điều tra, để phiên sau không lặp lại)

| #   | Cách thử                                             | Kết quả                                                       | Vì sao không đúng / bài học                                                   |
| --- | ---------------------------------------------------- | ------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| 1   | `npm install @tabler/icons-react@^3.48.0`            | ERESOLVE như trên                                             | Xung đột có sẵn giữa vite và plugin-react, không liên quan gói mới            |
| 2   | `npm install … --legacy-peer-deps`                   | Cài được, không đổi phiên bản gói khác; build/verify PASS     | Chỉ là cách tránh; peer vẫn lệch                                              |
| 3   | `npm uninstall lucide-react … --legacy-peer-deps`    | Gỡ được                                                       | Mọi lệnh npm sửa cây phụ thuộc đều cần cờ này cho tới khi nâng plugin-react   |

## Root cause

`@vitejs/plugin-react@4.7.0` khai báo peer `vite` tối đa `^7.0.0`, còn repo đã nâng `vite` lên `^8.3.3` mà chưa nâng plugin-react. npm 7+ coi lệch peer là lỗi chặn. Bằng chứng: output ERESOLVE ở trên, `package.json` dòng `"vite"` và `"@vitejs/plugin-react"`.

## Fix

Tạm: thêm `--legacy-peer-deps` cho lệnh `npm install`/`npm uninstall`. Fix thật (cần user duyệt vì đổi dependency): nâng `@vitejs/plugin-react` lên bản hỗ trợ vite 8, hoặc giữ vite 7 cho tới khi plugin hỗ trợ.

## Regression test

`npm install` (không cờ) chạy sạch sau khi nâng plugin-react; `node scripts/verify.mjs` PASS.

## Ảnh hưởng

Chỉ môi trường cài gói của FE. Không ảnh hưởng BE/APP.

## Lesson

Nâng công cụ build (vite) phải nâng cùng lúc plugin của nó; ERESOLVE khi cài gói lạ thường là xung đột peer có sẵn, đọc dòng "While resolving" trước khi nghi gói mới.
