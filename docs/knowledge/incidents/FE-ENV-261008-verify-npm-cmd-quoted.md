---
id: FE-ENV-261008-verify-npm-cmd-quoted
type: env
screens: []
be_modules: []
rules: []
status: fixed
date: 2026-10-08
keywords: [verify, verify.mjs, npm.cmd, npm-cli.js, MODULE_NOT_FOUND, Windows, VERIFY FAIL]
similar_to: []
---

# FE-ENV-261008-verify-npm-cmd-quoted — `node scripts/verify.mjs` FAIL trên Windows dù code pass

## Symptom
`node scripts/verify.mjs` in `VERIFY FAIL full | npm run verify | log verify.log`. Trong `verify.log`:
```text
Error: Cannot find module 'D:\CAPSTONE_FALL26\CareNest_CODE\CareNest_FE\node_modules\npm\bin\npm-cli.js'
```
Chạy thẳng `npm run verify` thì lint + format:check + build đều pass.

## Điều kiện tái hiện
Windows 11, Node 24.16.0, npm cài ở `C:\Program Files\nodejs\npm.cmd`. Chạy `node scripts/verify.mjs` ở root repo FE.

## Attempts — đã thử (cập nhật mỗi phiên điều tra, để phiên sau không lặp lại)
| # | Cách thử | Kết quả | Vì sao không đúng / bài học |
| --- | --- | --- | --- |
| 1 | `node scripts/verify.mjs` | FAIL, `npm-cli.js` MODULE_NOT_FOUND trong `node_modules` của repo | npm.cmd tìm npm-cli.js theo thư mục repo thay vì thư mục cài Node |
| 2 | `npm run verify` trực tiếp | Pass (`✓ built`) | Workaround; nhưng stop hook không coi đây là dòng VERIFY |
| 3 | Bỏ ngoặc kép quanh `npm.cmd` khi tên không có dấu cách (`scripts/verify.mjs`) | `VERIFY PASS full` | Đúng nguyên nhân |

## Root cause
`scripts/verify.mjs` spawn `"npm.cmd" run verify` với `shell: true`. cmd gọi `.cmd` bằng tên trong ngoặc kép, không có đường dẫn ⇒ `%~dp0` trong `npm.cmd` là thư mục hiện tại ⇒ tìm `node_modules/npm/bin/npm-cli.js` trong repo. Bằng chứng: bỏ ngoặc ⇒ `VERIFY PASS full` (2026-10-09).

## Fix
`scripts/verify.mjs`: chỉ bọc ngoặc khi `exe` có dấu cách (`const cmd = /\s/.test(exe) ? \`"${exe}"\` : exe`). Script dùng chung ba repo ⇒ cần đồng bộ sang `CareNest_BE`, `CareNest_APP` (chưa làm, chờ user cho phép sửa repo khác).

## Regression test
`node scripts/verify.mjs` trên Windows phải in `VERIFY PASS full` khi `npm run verify` pass.

## Ảnh hưởng
Mọi phiên trên Windows: stop hook báo verify FAIL dù code pass. Có thể lặp ở `CareNest_BE`/`CareNest_APP` nếu dùng cùng script nhánh `package.json`.

## Lesson
Trên Windows, đừng gọi `.cmd` bằng tên trong ngoặc kép qua `shell: true` — `%~dp0` sẽ sai.
